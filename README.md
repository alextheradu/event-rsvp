# RSVP

One-click RSVPs for YSWSes! This currently has over 300 users, with some events seeing as high as 80 verified RSVPs! Join them now: https://rsvp.hackclub.community or https://rsvp.soon.it.

Form customizations automatically appear in Slack when posting a link, along with an inline button to RSVP without leaving Slack. Users signing up are automatically validated to be YSWS eligible. 

View RSVP counts of any YSWS at /api/stats, e.g. `rsvp.soon.it/fraud` at `rsvp.soon.it/api/stats?slug=fraud`. Responses are in the form: `{"count": 42}`.

## Dev

```bash
bun install
bun run dev
```

## Run

```bash
docker compose up -d
```

## Contributing

PRs are welcome! Please message on Slack first if it's a non-trivial change.


## AI Usage

This project contains significant AI usage with interface design and bugfixing.
