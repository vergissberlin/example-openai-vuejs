import { describe, it, expect } from 'vitest'

import { resolveApiBaseUrl } from '../config'

/**
 * The precedence here is the whole point of the runtime-config mechanism, and
 * getting it wrong fails silently: the app keeps working, it just talks to the
 * wrong backend.
 */
describe('resolveApiBaseUrl', () => {
	it('prefers the runtime value the container generated', () => {
		expect(resolveApiBaseUrl('https://runtime.example.com', 'https://build.example.com')).toBe(
			'https://runtime.example.com'
		)
	})

	it('falls back to the compiled-in value when nothing generated a config', () => {
		expect(resolveApiBaseUrl(undefined, 'https://build.example.com')).toBe(
			'https://build.example.com'
		)
	})

	it('falls back to the local backend when neither source says anything', () => {
		expect(resolveApiBaseUrl(undefined, undefined)).toBe('http://localhost:3000')
	})

	it('ignores an empty runtime value rather than treating it as an answer', () => {
		// An unset variable that still reaches the template renders as '', and
		// an empty base url would send every request to the client's own origin.
		expect(resolveApiBaseUrl('', 'https://build.example.com')).toBe('https://build.example.com')
	})

	it('strips trailing slashes, so callers may write the url either way', () => {
		expect(resolveApiBaseUrl('https://runtime.example.com///', undefined)).toBe(
			'https://runtime.example.com'
		)
	})
})
