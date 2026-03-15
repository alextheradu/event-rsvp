FROM oven/bun:1 AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
ENV HOST=0.0.0.0
ENV PORT=4321
VOLUME ["/app/data"]
CMD ["node", "dist/server/entry.mjs"]
