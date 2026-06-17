# Multi-stage build for the RetailFixIt API (Azure Container Apps target).
FROM node:20-alpine AS base
WORKDIR /app

# --- deps: install workspace dependencies ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install --omit=dev=false

# --- build ---
FROM deps AS build
# Source only — node_modules stays from deps (see .dockerignore).
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @retailfixit/shared \
  && npm run build --workspace @retailfixit/api

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/index.js"]
