/**
 * Runtime configuration, read from vite's env at build time.
 *
 * These values are baked into the client bundle, so they must never hold
 * secrets. The OpenAI API key stays in the backend.
 */

/** Base url of the backend, without a trailing slash. */
export const apiBaseUrl: string = (
	import.meta.env.VITE_API_BASE_URL || 'https://example-openai-server-production.up.railway.app'
).replace(/\/+$/, '')
