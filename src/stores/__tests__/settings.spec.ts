import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '../settings'

const SETTINGS_KEY = 'example-openai-vuejs:settings'
const API_KEY_KEY = 'example-openai-vuejs:api-key'

describe('settings store', () => {
	beforeEach(() => {
		localStorage.clear()
		sessionStorage.clear()
		setActivePinia(createPinia())
	})

	it('never writes the api key into the settings blob', async () => {
		const settings = useSettingsStore()

		settings.connectionKind = 'custom'
		settings.customBaseUrl = 'https://example.test'
		settings.setApiKey('sk-secret-value')
		await nextTick()

		const blob = localStorage.getItem(SETTINGS_KEY) ?? ''
		expect(blob).not.toContain('sk-secret-value')
		expect(blob).toContain('example.test')
	})

	it('defaults to session storage for the key, keeping it out of local storage', async () => {
		const settings = useSettingsStore()

		expect(settings.keyStorage).toBe('session')

		settings.setApiKey('sk-secret-value')
		await nextTick()

		expect(sessionStorage.getItem(API_KEY_KEY)).toContain('sk-secret-value')
		expect(localStorage.getItem(API_KEY_KEY)).toBeNull()
	})

	it('leaves no copy behind when the storage mode changes', async () => {
		const settings = useSettingsStore()

		settings.setApiKey('sk-secret-value')
		await nextTick()
		expect(sessionStorage.getItem(API_KEY_KEY)).not.toBeNull()

		settings.keyStorage = 'local'
		await nextTick()

		expect(localStorage.getItem(API_KEY_KEY)).toContain('sk-secret-value')
		expect(sessionStorage.getItem(API_KEY_KEY)).toBeNull()
	})

	it('does not persist the key at all in memory mode', async () => {
		const settings = useSettingsStore()

		settings.keyStorage = 'memory'
		settings.setApiKey('sk-secret-value')
		await nextTick()

		expect(sessionStorage.getItem(API_KEY_KEY)).toBeNull()
		expect(localStorage.getItem(API_KEY_KEY)).toBeNull()
		expect(settings.apiKey).toBe('sk-secret-value')
	})

	it('never sends a key to our own backend', () => {
		const settings = useSettingsStore()

		settings.setApiKey('sk-secret-value')
		settings.connectionKind = 'server'

		expect(settings.resolveApiKey()).toBeUndefined()

		settings.connectionKind = 'custom'
		expect(settings.resolveApiKey()).toBe('sk-secret-value')
	})

	it('ignores a blank custom base url and strips trailing slashes', () => {
		const settings = useSettingsStore()
		const fallback = settings.resolveBaseUrl()

		settings.connectionKind = 'custom'
		settings.customBaseUrl = '   '
		expect(settings.resolveBaseUrl()).toBe(fallback)

		settings.customBaseUrl = 'https://example.test/v1///'
		expect(settings.resolveBaseUrl()).toBe('https://example.test/v1')
	})
})
