# Build stage.
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Vite inlines VITE_* variables into the bundle at build time — they are not
# read at runtime. Setting this as a plain container environment variable
# would have no effect at all, and the failure is silent: the app would just
# keep calling whatever url was baked in. In Coolify this belongs under Build
# Variables, not Environment Variables.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Same rule, and the same silent failure: this one ends up in the Open Graph
# tags, so getting it wrong means link previews point somewhere else entirely.
ARG VITE_PUBLIC_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL

RUN pnpm build-only

# Runtime stage: nothing but the static output and a web server.
FROM nginxinc/nginx-unprivileged:alpine AS runtime

# The unprivileged image already runs as a non-root user and listens on 8080.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
