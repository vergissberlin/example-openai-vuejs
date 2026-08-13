// Runtime configuration. The container image overwrites this file when it
// starts, from the API_BASE_URL environment variable.
//
// Empty on purpose: `pnpm dev` and statically hosted builds have nothing to
// generate it, and an empty object makes src/config.ts fall through to the
// value vite compiled in. Shipping the file rather than omitting it keeps the
// `<script>` tag in index.html from 404ing in development.
window.__APP_CONFIG__ = {}
