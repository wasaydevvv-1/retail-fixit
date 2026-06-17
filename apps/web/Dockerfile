# Build the SPA and serve as static assets (Azure Container Apps / nginx).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install
# Source only — node_modules stays from install (see .dockerignore).
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# Vite bakes these at build time (.env is excluded by .dockerignore).
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_AZURE_AD_TENANT_ID
ARG VITE_AZURE_AD_CLIENT_ID
ARG VITE_AZURE_AD_API_SCOPE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AZURE_AD_TENANT_ID=$VITE_AZURE_AD_TENANT_ID
ENV VITE_AZURE_AD_CLIENT_ID=$VITE_AZURE_AD_CLIENT_ID
ENV VITE_AZURE_AD_API_SCOPE=$VITE_AZURE_AD_API_SCOPE
RUN npm run build --workspace @retailfixit/shared \
  && npm run build --workspace @retailfixit/web

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.docker.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
