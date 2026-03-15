FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
ENV HOST=0.0.0.0
ENV PORT=4321
VOLUME ["/app/data"]
CMD ["bun", "run", "dist/server/entry.mjs"]
