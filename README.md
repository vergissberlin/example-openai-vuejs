# example-vuejs-openai

This is a simple example of how to use [OpenAI](https://openai.com/) with [Vue.js](https://vuejs.org/).

[![Build and deploy application](https://github.com/vergissberlin/example-openai-vuejs/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/vergissberlin/example-openai-vuejs/actions/workflows/build-and-deploy.yml)

The client talks to a small backend
([example-openai-server](https://github.com/vergissberlin/example-openai-server))
that holds the OpenAI API key. No key is ever stored in this application.

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

- [ ] Make model select- and configurable
- [ ] Add more models for code and image generation
- [x] Loading animation
- [ ] Change favicon and title
- [ ] Add more tests
- [ ] Add more documentation
- [ ] Use components from [Vitesse](https://github.com/antfu/vitesse)
- [ ] Add more types
