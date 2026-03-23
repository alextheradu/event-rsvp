# RSVP

RSVP for YSWSes! See https://rsvp.hackclub.community or https://rsvp.soon.it.

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
