FROM oven/bun AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run db:generate
RUN bun run build

FROM oven/bun
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./

ENV HOST=0.0.0.0
ENV PORT=4321

VOLUME ["/app/data"]

CMD ["bun", "run", "dist/server/entry.mjs"]
