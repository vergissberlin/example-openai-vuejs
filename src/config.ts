/**
 * Where the client finds its backend.
 *
 * Two sources, in order of precedence:
 *
 * 1. `window.__APP_CONFIG__`, written by `/config.js`. The container image
 *    generates that file when it starts, so one published image can serve any
 *    deployment.
 * 2. `import.meta.env.VITE_API_BASE_URL`, compiled in by vite. This is the
 *    path for `pnpm dev` and for hosting the built output statically, where
 *    nothing generates a config file.
 *
 * Neither may hold a secret: both end up in the browser. The OpenAI API key
 * stays in the backend.
 */

declare global {
	interface Window {
		__APP_CONFIG__?: { apiBaseUrl?: string }
	}
}

/** Used when neither source says anything — the local dev backend. */
const DEV_API_BASE_URL = 'http://localhost:3000'

/**
 * Exported for the tests, which need to vary both sources. Production code
 * wants the `apiBaseUrl` constant below.
 */
export function resolveApiBaseUrl(
	runtime: string | undefined = globalThis.window?.__APP_CONFIG__?.apiBaseUrl,
	buildTime: string | undefined = import.meta.env.VITE_API_BASE_URL
): string {
	return (runtime || buildTime || DEV_API_BASE_URL).replace(/\/+$/, '')
}

/** Base url of the backend, without a trailing slash. */
export const apiBaseUrl: string = resolveApiBaseUrl()
