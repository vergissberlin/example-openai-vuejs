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

Built by GitHub Actions and published to GitHub Pages under
`/example-openai-vuejs/`. Pages has no SPA fallback, so `public/404.html`
stashes the requested url and hands it back to the app entry, which restores it
into the history before the router boots — otherwise reloading `/c/<id>` is a
hard 404.
