# Architecture

A short map of how the client is put together and why.

## Layers

```
views/          route-level components (ChatView, ImageView, AboutView, NotFoundView)
components/     layout/ (shell, sidebar) · chat/ (message) · settings/ · ui/ (modal, toasts)
composables/    useTheme
stores/         pinia: conversations · settings · prompts · toasts
services/       chat/ (client, sse, errors) · markdown · persistence
types/          the chat domain model
```

Views own no state beyond what is local to a form. Everything shared lives in
a store; anything touching the network or the DOM's dangerous corners lives in
a service, where it can be unit-tested without mounting a component.

## Domain model

A conversation is a list of `Message`s with a role, an id, a timestamp and a
status (`streaming`, `done`, `error`, `aborted`).

The original code kept a conversation as a flat `string[]` and inferred the
speaker from whether an entry sat at an even or odd index, rendering with an
`even:` CSS variant. That left nowhere to put a system prompt, per-message
state, or a stable list key — two identical messages collided, because the
list was keyed by message text.

## Connections

`services/chat/client.ts` speaks two wire protocols behind one generator
signature, so nothing upstream branches on which backend is in use:

| Protocol | Endpoint | Notes |
| --- | --- | --- |
| `openai` | `POST /v1/chat/completions` (`stream: true`) | Real streaming and multi-turn history. Also fits any other OpenAI-compatible endpoint. |
| `legacy` | `GET /text/?prompt=` | What the deployed backend answers today. One shot, yielded as a single chunk. Multi-turn is emulated by flattening the conversation into the prompt, which is lossy and bounded by the maximum url length. |

`legacy` is the default until the rebuilt backend is live; the switch is in
Settings → Connection.

SSE is parsed from the response body rather than through `EventSource`, which
can neither POST nor set an `Authorization` header. The parser is written
against arbitrary chunk boundaries — events split across reads, several events
per read, multi-byte characters split mid-character — because a stream gives no
guarantees about where a read ends.

Failures are typed (`auth`, `rate_limit`, `server`, `bad_request`, `network`,
`aborted`) so the UI can say something actionable. A stream that breaks after
it has begun cannot change its HTTP status, so an in-band `event: error` frame
is handled as well.

## Rendering

Assistant output goes `markdown-it` → `highlight.js` → **DOMPurify** → DOM.
Model output is untrusted: it echoes back whatever a user pastes in. Raw HTML
is disabled in the parser too, so the sanitiser is a safety net rather than the
only defence. User input is never parsed as markdown.

The renderer is a lazily imported chunk. Statically imported it tripled the
entry bundle, which every visitor would pay before a single message existed.

Maths is a second lazy step on top: KaTeX with its stylesheet and fonts is
larger than the rest of the renderer combined, and most conversations contain
no formula, so it is fetched only when a message actually looks like it has
one. The `$` pre-check that decides this is deliberately loose — it only
decides whether to download, and the plugin makes the real call about what is
a formula.

Delimiter handling comes from a maintained plugin rather than hand-written
rules, because the awkward cases — an escaped `\$`, a currency amount, a `$`
inside a code span — are where a home-grown parser goes wrong, and they show
up constantly in chat output.

One trap worth knowing about: the plugin is CommonJS, and vite's browser
pre-bundle wraps it as `{ default: { default: fn } }` while vitest's SSR
transform gives `{ default: fn }`. Handing `md.use` the wrong one registers
nothing and fails silently, which is why maths has an end-to-end test and not
only unit tests.

## Persistence

`services/persistence.ts` wraps values in `{ version, data }` so a later change
to the stored shape can migrate rather than misread. Reads are total —
unavailable storage, malformed JSON and unknown versions all fall back. Writes
report failure, so a full quota surfaces as a toast instead of silently losing
data.

Conversation writes are debounced, and flushed on `pagehide` and on visibility
change — without that, closing the tab right after a reply lost it.

## API keys

The bundled backend holds the OpenAI key server-side, so the default path needs
no key in the browser at all.

A custom endpoint does need one, and it is stored under its own storage key,
never inside the settings blob. That is structural rather than procedural:
export and any future settings sync cannot carry the key by accident, because
it was never in that object. The default lifetime is the tab session; keeping
it indefinitely is opt-in and labelled as such.

A key in a browser is only as safe as the page it sits on, which is why the
markdown sanitiser landed before the key input existed.

## Deployment

GitHub Actions builds the image and pushes it to GHCR; Coolify pulls it and
runs it from `compose.yaml`. nginx serves the output from the root of its own
domain, and the SPA fallback lives in `nginx.conf`, so a reloaded `/c/<id>`
resolves through the router instead of 404ing.

The backend runs on a separate subdomain, which means CORS applies: the
client's origin has to appear in the server's `ALLOWED_ORIGINS`.

### Configured at startup, not at build

Vite inlines `VITE_*` values when it compiles. For a published image that is
the wrong end: the urls would have to be known before anyone knows where the
image runs, which makes a *public* image useful to exactly one deployment.

So the image is configured when it starts. `docker/40-runtime-config.sh` runs
from nginx's `/docker-entrypoint.d/` and renders two things:

| Variable | Becomes | Read by |
| --- | --- | --- |
| `API_BASE_URL` | `/config.js`, setting `window.__APP_CONFIG__` | `src/config.ts`, at runtime |
| `PUBLIC_URL` | the Open Graph tags in `index.html` | crawlers, without JavaScript |

The Open Graph tags cannot go through `config.js` — crawlers do not execute the
page's JavaScript, so those urls have to be present in the served HTML. Hence
two mechanisms rather than one.

`src/config.ts` prefers the runtime value, falls back to the compiled-in one,
then to the local backend. That keeps `pnpm dev` and statically hosted builds
working unchanged: nothing generates a config file there, and `public/config.js`
ships an empty object so the `<script>` tag does not 404.

Three details that each caused a wrong-but-working state while this was built:

- **`config.js` must not be cached.** It carries no fingerprint and its content
  differs between deployments of the very same image, so `no-store` rather than
  `no-cache`.
- **The entry document is not in the document root.** The Dockerfile moves it to
  `/opt/app-template`, because a copy still holding `%PUBLIC_URL%` sitting in
  the served directory is one misrouted request away from being served. Failing
  is fine; serving a page with a broken url in its head is not.
- **`/` needs its own nginx location.** The `index` directive resolves against
  the document root, which deliberately has no entry document, and `try_files
  $uri/` would match the root directory before ever reaching the rendered one.

The build still knows both variables for the non-container path. The image is
built with the sentinel `VITE_PUBLIC_URL=runtime`, which tells the plugin in
`vite.config.ts` to leave the placeholder alone; the entrypoint refuses to start
if it does not find one, so an image built any other way fails loudly instead of
serving a url from whenever it was compiled.

This used to deploy to GitHub Pages, which served the app from the
`/example-openai-vuejs/` subpath and needed a `public/404.html` redirect to
survive a reloaded deep link. Both are gone, and Pages is switched off.
