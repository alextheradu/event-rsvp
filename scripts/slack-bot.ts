import { App } from "@slack/bolt";
// @ts-ignore
import { Database } from "bun:sqlite";

if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
  console.warn("slack: bot and app token required");
  process.exit(0);
}

const sqlite = new Database(process.env.DATABASE_URL || "./data/rsvp.db");
sqlite.exec("PRAGMA journal_mode=WAL");
sqlite.exec("PRAGMA foreign_keys=ON");

const getForm = sqlite.prepare<
  {
    id: string;
    title: string;
    slug: string;
    is_open: number;
    description: string | null;
    slack_channel_id: string | null;
  },
  [string]
>(
  "SELECT id, title, slug, is_open, description, slack_channel_id FROM forms WHERE slug = ?",
);

const getUserBySlackId = sqlite.prepare<
  { id: string; is_allowed: number },
  [string]
>("SELECT id, is_allowed FROM users WHERE slack_id = ?");

const getExistingRsvp = sqlite.prepare<{ id: string }, [string, string]>(
  "SELECT id FROM rsvps WHERE form_id = ? AND user_id = ?",
);

const insertRsvp = sqlite.prepare(
  "INSERT INTO rsvps (id, form_id, user_id, created_at) VALUES (?, ?, ?, ?)",
);

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const publicUrl = (
  process.env.PUBLIC_URL || "https://rsvp.hackclub.community"
).replace(/\/$/, "");
// const publicUrl = "https://rsvp.hackclub.community".replace(/\/$/, "");
const escapedUrl = publicUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const linkRegex = new RegExp(`^${escapedUrl}/([\\w-]+)$`);

app.event("link_shared", async ({ event, client }) => {
  const unfurls: Record<string, object> = {};

  for (const link of event.links) {
    const match = linkRegex.exec(link.url);
    if (!match) continue;

    const slug = match[1];
    const form = getForm.get(slug);
    if (!form || !form.is_open) continue;

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

  const slackUserId = body.user.id;
  const channelId = (body as any).channel?.id;
  const slug = (body as any).actions?.[0]?.value;
  if (!slug || !channelId) return;

  const ephemeral = (text: string) =>
    client.chat.postEphemeral({ channel: channelId, user: slackUserId, text });

  const user = getUserBySlackId.get(slackUserId);
  if (!user) {
    await ephemeral(`You'll need to sign in first: ${publicUrl}`);
    return;
  }
  if (!user.is_allowed) {
    await ephemeral("You're not currently eligible to RSVP for events.");
    return;
  }

  const form = getForm.get(slug);
  if (!form || !form.is_open) {
    await ephemeral("This form is no longer open.");
    return;
  }

  if (getExistingRsvp.get(form.id, user.id)) {
    await ephemeral(`You're already RSVP'd for *${form.title}*!`);
    return;
  }

  insertRsvp.run(
    crypto.randomUUID(),
    form.id,
    user.id,
    Math.floor(Date.now() / 1000),
  );

  if (form.slack_channel_id) {
    await client.conversations
      .invite({ channel: form.slack_channel_id, users: slackUserId })
      .catch(() => {});
  }

  await ephemeral(`You're RSVP'd for *${form.title}*!`);
});

await app.start();
console.log("slack: running");
