# RSVP

One-click RSVPs for YSWSes! This currently has over 300 users, with some events seeing as high as 80 verified RSVPs! Join them now: https://rsvp.hackclub.community or https://rsvp.soon.it.

Form customizations automatically appear in Slack when posting a link, along with an inline button to RSVP without leaving Slack. Users signing up are automatically validated to be YSWS eligible. 

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

This starts two processes: `rsvp-web` (Next.js on 0.0.0.0:4321) and `rsvp-bot` (Slack worker).
Logs: `pm2 logs rsvp-web` / `pm2 logs rsvp-bot`.

On redeploy:

```bash
git pull && npm ci && npm run migrate && npm run build && pm2 reload ecosystem.config.cjs
```

## Contributing

PRs are welcome! Please message on Slack first if it's a non-trivial change.

## Credits

This project is a fork of the Hack Club `rsvp` tool. The original Astro implementation and its
design are the work of the upstream authors; this fork ports it to Next.js and builds on it.

## AI Usage

This project contains significant AI usage with interface design and bugfixing.
