import { App } from "@slack/bolt";
import { db } from "../lib/db";
import { getFormBySlug } from "../lib/forms";
import { getPublicOrigins } from "../lib/public-origin";
import { createRsvp } from "../lib/rsvp";
import { slack } from "../lib/slack";
import { createPublicFormLinkMatcher } from "../lib/slack-unfurl";
import { resolveSlackUser } from "../lib/users";
import { hackClubVerification } from "../lib/verification";
import { startWorkerLoop } from "../lib/worker-loop";

if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
	console.warn("slack: bot and app token required");
	process.exit(0);
}

const deps = {
	db,
	slack,
	allowIneligible: process.env.NODE_ENV !== "production",
};

const publicUrls = getPublicOrigins().all;
const getSlugFromLink = createPublicFormLinkMatcher(publicUrls);

const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	appToken: process.env.SLACK_APP_TOKEN,
	socketMode: true,
});

app.event("link_shared", async ({ event, client }) => {
	console.log(`slack: link_shared received (${event.links.length} link(s))`);
	const unfurls: Record<string, object> = {};

	for (const link of event.links) {
		const slug = getSlugFromLink(link.url);
		if (!slug) continue;

		const form = getFormBySlug(db, slug);
		if (!form?.isOpen) continue;

		unfurls[link.url] = {
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `*${form.title}*${form.description ? `\n${form.description}` : ""}`,
					},
				},
				{
					type: "actions",
					elements: [
						{
							type: "button",
							text: { type: "plain_text", text: "RSVP", emoji: true },
							value: form.slug,
							action_id: "rsvp_open",
							style: "danger",
						},
					],
				},
			],
		};
	}

	const unfurlCount = Object.keys(unfurls).length;
	if (unfurlCount === 0) {
		console.warn("slack: link_shared contained no open RSVP event links");
		return;
	}

	const unfurlArgs = event.unfurl_id
		? {
				unfurl_id: event.unfurl_id,
				source: event.source as "composer" | "conversations_history",
			}
		: { channel: event.channel, ts: event.message_ts };

	const result = await client.chat.unfurl({ ...unfurlArgs, unfurls });
	if (result.ok) {
		console.log(`slack: unfurled ${unfurlCount} RSVP link(s)`);
	} else {
		console.error("slack: chat.unfurl failed", result.error);
	}
});

app.action("rsvp_open", async ({ ack, body, client }) => {
	await ack();

	const actionBody = body as typeof body & {
		channel?: { id?: string };
		actions?: Array<{ value?: string }>;
	};
	const slackUserId = body.user.id;
	const channelId = actionBody.channel?.id;
	const slug = actionBody.actions?.[0]?.value;
	if (!slug || !channelId) return;

	const ephemeral = (text: string) =>
		client.chat.postEphemeral({ channel: channelId, user: slackUserId, text });

	const user = await resolveSlackUser(db, slack, slackUserId);
	if (!user) {
		await ephemeral("You're not currently eligible to RSVP for events.");
		return;
	}

	const form = getFormBySlug(db, slug);
	if (!form) {
		await ephemeral("This form is no longer open.");
		return;
	}

	const result = await createRsvp(deps, user.id, form.id);

	if (result.ok) {
		await ephemeral(
			result.alreadyRsvpd
				? result.status === "confirmed"
					? `You're already RSVP'd for *${form.title}*!`
					: `You're already on the waitlist for *${form.title}*.`
				: result.status === "confirmed"
					? `You're RSVP'd for *${form.title}*!`
					: `You're on the waitlist for *${form.title}*.`,
		);
		return;
	}

	const messages: Record<typeof result.reason, string> = {
		not_found: "This form is no longer open.",
		closed: "This form is no longer open.",
		cancelled: "This event was cancelled.",
		own_form: "You can't RSVP to your own event.",
		ineligible: "You're not currently eligible to RSVP for events.",
	};
	await ephemeral(messages[result.reason]);
});

await app.start();
const loop = startWorkerLoop(db, slack, hackClubVerification);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, async () => {
		await loop.stop();
		await app.stop();
		process.exit(0);
	});
}
console.log("slack: running");
