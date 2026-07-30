# RSVP

One-click RSVPs for YSWSes! This currently has over 300 users, with some events seeing as high as 80 verified RSVPs! Join them now: https://rsvp.hackclub.community or https://rsvp.soon.it.

Form customizations automatically appear in Slack when posting a link, along with an inline button to RSVP without leaving Slack. Event hosts can require YSWS eligibility for RSVPs from the event's RSVP preferences.

View RSVP counts of any YSWS at /api/stats, e.g. `rsvp.soon.it/fraud` at `rsvp.soon.it/api/stats?slug=fraud`. Responses are in the form: `{"count": 42}`.

## Dev

```bash
npm install
npm run dev      # web app on http://localhost:4321
npm run bot      # Slack socket-mode worker, separate terminal
npm test         # domain unit tests
```

## Run

Requires a `.env` (see `.env.example`). `SESSION_SECRET` and `PUBLIC_URL` must be set — the app
refuses to start in production without them.

```bash
npm ci
npm run migrate         # apply database migrations (deploy step, not on every restart)
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

This starts two processes: `rsvp-web` (Next.js on 0.0.0.0:4321) and `rsvp-bot`
(Slack socket-mode client and durable queue worker). Logs: `pm2 logs rsvp-web` /
`pm2 logs rsvp-bot`.

The Slack app needs `chat:write`, `im:write`, `links:read`, `links:write`,
`users:read`, and the channel-type-specific join/invite scopes. In the Slack app
settings:

1. Enable Socket Mode and interactivity.
2. Under Event Subscriptions, subscribe to the `link_shared` bot event.
3. Under App unfurl domains, register every hostname in `PUBLIC_URL` without the
   protocol (for example, `rsvp.alexradu.co`).
4. Reinstall the app to the workspace after changing scopes or unfurl domains.

Slack only sends `link_shared` events for registered domains. The `rsvp-bot`
process must also be running for the event link to receive the inline RSVP
button. Channel access is granted only after a fresh Hack Club Auth verification
check.

Location autocomplete uses the server-only `GEOAPIFY_API_KEY`. Autocomplete UI
must retain the Geoapify/OpenStreetMap attribution. Manual location entry remains
available when the provider is disabled or unavailable.

Queue health and an explicit single-delivery retry:

```bash
npm run queue:status
npm run queue:retry -- <delivery-id>
```

These commands intentionally do not print message text or attendee identity.

Before a migration deploy, stop writes briefly and back up SQLite:

```bash
sqlite3 data/rsvp.db ".backup 'data/rsvp-before-phase2.db'"
npm ci
npm run migrate
npm run build
pm2 reload ecosystem.config.cjs
npm run queue:status
```

Verify both web and worker are online after reload. Code rollback is safe only to
a version that tolerates the additive schema; do not reverse live migrations.
Restore the backup only for migration corruption.

Feedback links are signed with a domain-separated key derived from
`SESSION_SECRET`. Rotating that secret invalidates outstanding feedback links, so
do not rotate it while a feedback form is open unless campaigns will be
intentionally reissued. Logs and analytics must never record feedback URLs,
answers, OAuth/Slack tokens, or raw location-provider responses.

## Contributing

PRs are welcome! Please message on Slack first if it's a non-trivial change.

## Credits

This project is a fork of the Hack Club `rsvp` tool. The original Astro implementation and its
design are the work of the upstream authors; this fork ports it to Next.js and builds on it.

## AI Usage

This project contains significant AI usage with interface design and bugfixing.
