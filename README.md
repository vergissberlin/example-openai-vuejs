# example-vuejs-openai

This is a simple example of how to use [OpenAI](https://openai.com/) with [Vue.js](https://vuejs.org/).

[![CI](https://github.com/vergissberlin/example-openai-vuejs/actions/workflows/ci.yml/badge.svg)](https://github.com/vergissberlin/example-openai-vuejs/actions/workflows/ci.yml)

The client talks to a small backend
([example-openai-server](https://github.com/vergissberlin/example-openai-server))
that holds the OpenAI API key, so the default setup needs no key in the
browser. You can also point it at any other OpenAI-compatible endpoint —
Ollama, LM Studio, OpenAI itself — in which case you supply the key.

## Features

- Multiple conversations in a sidebar: create, rename, pin, delete, search,
  and one url per chat
- Token-by-token streaming with a stop button, plus regenerate, edit-and-resend,
  copy and delete on individual messages
- Markdown answers with syntax highlighting and copy-able code blocks, sanitised
  with DOMPurify, plus LaTeX via `$…$` and `$$…$$`
- Prompt presets applied with `/command`, including the personas the demo has
  always shipped
- Settings for the endpoint, model, temperature, top_p, max tokens and system
  prompt
- Light/dark/system theme, keyboard shortcuts, and a mobile drawer layout
- Chats persist in the browser and can be exported and imported as JSON

See [docs/architecture.md](docs/architecture.md) for how it fits together.

### A note on API keys

Using your own endpoint means the key is stored in the browser. It is kept
under its own storage key, never included in an export, and never sent to the
bundled backend — but any script running on the page could read it. It defaults
to being kept only for the tab session. On a shared or publicly deployed
instance, prefer the bundled backend, which keeps the key server-side.

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- [pnpm](https://pnpm.io/) — `corepack enable` picks up the pinned version automatically

## Project Setup

```sh
pnpm install
```

Copy `.env.example` to `.env.local` to point the client at a different
backend. Every `VITE_` variable ends up in the browser bundle, so none of
them may hold secrets.

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
pnpm test:unit
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
pnpm exec playwright install

# When testing on CI, must build the project first
pnpm build

# Runs the end-to-end tests
pnpm test:e2e
# Runs the tests only on Chromium
pnpm test:e2e --project=chromium
# Runs the tests of a specific file
pnpm test:e2e e2e/vue.spec.ts
# Runs the tests in debug mode
pnpm test:e2e --debug
```

### Lint with [ESLint](https://eslint.org/) and format with [Prettier](https://prettier.io/)

```sh
pnpm lint        # fixes what it can
pnpm lint:check  # reports only, this is what CI runs
pnpm format
```

## Container image

GitHub Actions builds the image and pushes it to the GitHub Container Registry
on every push to `main`, after lint, type-check, unit tests, end-to-end tests
and a smoke test against the running container have passed. Nothing reaches the
registry that did not go through CI first.

```
ghcr.io/vergissberlin/example-openai-vuejs:latest
ghcr.io/vergissberlin/example-openai-vuejs:sha-<commit>
```

`latest` moves; the `sha-` tag does not, which is what makes a rollback
possible. Built for `linux/amd64` only — on arm the pull fails outright with
`no matching manifest`, so you will know rather than wonder.

```sh
docker run --rm -p 8080:8080 \
  -e API_BASE_URL=https://api.example.com \
  -e PUBLIC_URL=https://chat.example.com \
  ghcr.io/vergissberlin/example-openai-vuejs:latest
```

> **One-time step after the first publish.** Packages start out private.
> Open the package page → *Package settings* → *Danger Zone* → *Change
> visibility* → **Public**. There is no workflow flag for this.

## Deployment (Coolify)

The app ships as a container: nginx serves the built output with an SPA
fallback, so client-side routes such as `/c/<id>` survive a reload.

In Coolify, create an application from this repository with the **Docker
Compose** build pack (`compose.yaml`), assign it a domain, and set two
**environment variables**:

| Name | Value |
| --- | --- |
| `API_BASE_URL` | the backend url, e.g. `https://api.example.com` |
| `PUBLIC_URL` | this app's own url, e.g. `https://chat.example.com` |

These are read when the container **starts**, not when the image is built, so
one published image serves any deployment and a url change is a restart rather
than a rebuild. The entrypoint refuses to start without them; a trailing slash
on either is stripped.

That is worth spelling out because vite normally works the other way round. It
inlines `VITE_*` values at compile time, so a variable of that name set on a
running container does nothing — and does nothing *silently*, since the app
still starts and serves, pointing at whatever url was compiled in. This image
sidesteps that: `API_BASE_URL` becomes `/config.js` at startup, and `PUBLIC_URL`
is substituted into the Open Graph tags, which have to be in the served HTML
because crawlers do not run the page's JavaScript.

The `VITE_*` variables still exist for `pnpm dev` and for hosting the built
output statically — see `.env.example`. The container ignores them.

The backend must allow this app's origin in its own `ALLOWED_ORIGINS`, since
the two run on separate subdomains. A missing entry there shows up as a CORS
error in the browser console and nothing else.

Deployment used to go to GitHub Pages, which served the app from a subpath and
needed a `404.html` redirect to make deep links work. Both are gone; CI now
only verifies the code and builds the image.

## ToDo

- [x] Make model select- and configurable
- [ ] Add more models for code and image generation
- [x] Loading animation
- [x] Change favicon and title
- [x] Add more tests
- [x] Add more documentation
- [ ] Use components from [Vitesse](https://github.com/antfu/vitesse)
- [x] Add more types
- [x] LaTeX rendering in answers
- [ ] Rebuild the backend as an OpenAI-compatible proxy, then switch the
      connection protocol to `/v1` by default
