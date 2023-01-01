# example-vuejs-openai

This is a simple example of how to use [OpenAI](https://openai.com/) with [Vue.js](https://vuejs.org/).

[![Build and deploy application](https://github.com/vergissberlin/example-openai-vuejs/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/vergissberlin/example-openai-vuejs/actions/workflows/build-and-deploy.yml)

## Project Setup

```sh
yarn
```

### Compile and Hot-Reload for Development

```sh
yarn dev
```

### Type-Check, Compile and Minify for Production

```sh
yarn build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
yarn test:unit
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
yarn build

# Runs the end-to-end tests
yarn test:e2e
# Runs the tests only on Chromium
yarn test:e2e --project=chromium
# Runs the tests of a specific file
yarn test:e2e tests/example.spec.ts
# Runs the tests in debug mode
yarn test:e2e --debug
```

### Lint with [ESLint](https://eslint.org/)

```sh
yarn lint
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
