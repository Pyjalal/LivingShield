FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src/malaysia/catalogue.ts ./src/malaysia/catalogue.ts

USER node
EXPOSE 8080
CMD ["node", "server/index.ts"]
