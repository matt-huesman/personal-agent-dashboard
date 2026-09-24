FROM node:22-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# The build's analysis step imports server modules; db.ts needs a URL to load,
# but postgres.js doesn't connect until the first query, so a placeholder is safe.
RUN DATABASE_URL=postgres://build-placeholder pnpm build && pnpm prune --prod

# Runtime: the adapter-node bundle plus production deps only (drizzle-orm, postgres, zod).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "build"]
