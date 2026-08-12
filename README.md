# example-vuejs-openai

This is a simple example of how to use [OpenAI](https://openai.com/) with [Vue.js](https://vuejs.org/).

[![Build and deploy application](https://github.com/vergissberlin/example-openai-vuejs/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/vergissberlin/example-openai-vuejs/actions/workflows/build-and-deploy.yml)

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
  with DOMPurify
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

## ToDo

- [x] Make model select- and configurable
- [ ] Add more models for code and image generation
- [x] Loading animation
- [x] Change favicon and title
- [x] Add more tests
- [x] Add more documentation
- [ ] Use components from [Vitesse](https://github.com/antfu/vitesse)
- [x] Add more types
- [ ] LaTeX rendering in answers
- [ ] Rebuild the backend as an OpenAI-compatible proxy, then switch the
      connection protocol to `/v1` by default
