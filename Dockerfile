# Build stage.
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# This image is configured when it starts, not when it is built, so that one
# published image works for any deployment. The sentinel tells the public-url
# plugin in vite.config.ts to leave the %PUBLIC_URL% placeholder in index.html
# for docker/40-runtime-config.sh to fill in.
#
# VITE_API_BASE_URL is deliberately not set either: src/config.ts prefers
# window.__APP_CONFIG__, which the same script generates. Building the image
# with either value baked in is what the entrypoint checks for and rejects.
ENV VITE_PUBLIC_URL=runtime

RUN pnpm build-only

# Runtime stage: nothing but the static output and a web server.
FROM nginxinc/nginx-unprivileged:alpine AS runtime

# The unprivileged image already runs as a non-root user (uid 101) and listens
# on 8080.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Three directories, on purpose:
#
#   /usr/share/nginx/html  fingerprinted assets. Root-owned, read-only,
#                          served directly.
#   /opt/app-template      the two files that still hold placeholders. Never
#                          served, so a broken startup cannot leak a page with
#                          an unsubstituted url in its head.
#   /opt/app-runtime       what the entrypoint renders. The only writable one.
#
# The base image has already dropped to uid 101, which cannot write to `/`, so
# this one step needs root. It switches back immediately below — running the
# server as root would give up what this base image exists to provide.
USER root
RUN mkdir -p /opt/app-template /opt/app-runtime \
	&& mv /usr/share/nginx/html/index.html /opt/app-template/index.html \
	&& rm -f /usr/share/nginx/html/config.js \
	&& chown 101:101 /opt/app-runtime

# The nginx image runs everything in here before starting the server.
COPY --chmod=555 docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
