import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { load, save, remove, PersistenceError, SCHEMA_VERSION } from '../persistence'

const NAMESPACED = 'example-openai-vuejs:demo'

describe('persistence', () => {
	beforeEach(() => {
		localStorage.clear()
		sessionStorage.clear()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('round-trips a value through a versioned envelope', () => {
		save('demo', { hello: 'world' })

		expect(JSON.parse(localStorage.getItem(NAMESPACED)!)).toEqual({
			version: SCHEMA_VERSION,
			data: { hello: 'world' }
		})
		expect(load('demo', null)).toEqual({ hello: 'world' })
	})

	it('returns the fallback when nothing is stored', () => {
		expect(load('demo', 'fallback')).toBe('fallback')
	})

	it('returns the fallback for malformed json rather than throwing', () => {
		localStorage.setItem(NAMESPACED, '{not json')

		expect(load('demo', 'fallback')).toBe('fallback')
	})

	it('returns the fallback for a payload without an envelope', () => {
		localStorage.setItem(NAMESPACED, JSON.stringify({ hello: 'world' }))

		expect(load('demo', 'fallback')).toBe('fallback')
	})

	it('runs the migration for an older schema version', () => {
		localStorage.setItem(NAMESPACED, JSON.stringify({ version: 0, data: ['a', 'b'] }))

		const migrate = vi.fn((data: unknown) => (data as string[]).join('-'))

		expect(load('demo', 'fallback', migrate)).toBe('a-b')
		expect(migrate).toHaveBeenCalledWith(['a', 'b'], 0)
	})

	it('falls back when the migration cannot handle the payload', () => {
		localStorage.setItem(NAMESPACED, JSON.stringify({ version: 0, data: 'junk' }))

		expect(load('demo', 'fallback', () => null)).toBe('fallback')
	})

	it('reports a full quota as a typed error', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			const error = new Error('full')
			error.name = 'QuotaExceededError'
			throw error
		})

		try {
			save('demo', 'value')
			expect.unreachable('save should have thrown')
		} catch (error) {
			expect(error).toBeInstanceOf(PersistenceError)
			expect((error as PersistenceError).kind).toBe('quota')
		}
	})

	it('keeps session and local storage separate', () => {
		save('demo', 'session-value', 'session')

		expect(load('demo', '', undefined, 'session')).toBe('session-value')
		expect(load('demo', '', undefined, 'local')).toBe('')
	})

	it('removes a stored value', () => {
		save('demo', 'value')
		remove('demo')

		expect(load('demo', 'gone')).toBe('gone')
	})
})
