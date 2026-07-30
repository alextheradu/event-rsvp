import { App } from "@slack/bolt";
import { db } from "../lib/db";
import { getFormBySlug } from "../lib/forms";
import { createRsvp } from "../lib/rsvp";
import { slack } from "../lib/slack";
import { resolveSlackUser } from "../lib/users";

if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
	console.warn("slack: bot and app token required");
	process.exit(0);
}

const deps = {
	db,
	slack,
	allowIneligible: process.env.NODE_ENV !== "production",
};

const publicUrls = (process.env.PUBLIC_URL || "https://rsvp.alexradu.co")
	.split(",")
	.map((url) => url.trim().replace(/\/$/, ""))
	.filter(Boolean);

if (publicUrls.length === 0) {
	throw new Error("PUBLIC_URL must contain at least one valid URL");
}

const escapedHosts = publicUrls.map((url) =>
	url.replace(/^https?:\/\//, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
);
const linkRegex = new RegExp(
	`^https?://(?:${escapedHosts.join("|")})/([\\w-]+)$`,
);

const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	appToken: process.env.SLACK_APP_TOKEN,
	socketMode: true,
});

app.event("link_shared", async ({ event, client }) => {
	const unfurls: Record<string, object> = {};

	for (const link of event.links) {
		const match = linkRegex.exec(link.url);
		if (!match) continue;

		const form = getFormBySlug(db, match[1]);
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

	if (Object.keys(unfurls).length === 0) return;

	const unfurlArgs = event.unfurl_id
		? {
				unfurl_id: event.unfurl_id,
				source: event.source as "composer" | "conversations_history",
			}
		: { channel: event.channel, ts: event.message_ts };

	const result = await client.chat.unfurl({ ...unfurlArgs, unfurls });
	if (!result.ok) console.error("slack: chat.unfurl failed", result.error);
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
				? `You're already RSVP'd for *${form.title}*!`
				: `You're RSVP'd for *${form.title}*!`,
		);
		return;
	}

	const messages: Record<typeof result.reason, string> = {
		not_found: "This form is no longer open.",
		closed: "This form is no longer open.",
		own_form: "You can't RSVP to your own event.",
		ineligible: "You're not currently eligible to RSVP for events.",
	};
	await ephemeral(messages[result.reason]);
});

await app.start();
console.log("slack: running");
