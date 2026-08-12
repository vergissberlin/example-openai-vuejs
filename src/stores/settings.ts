import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { apiBaseUrl } from '../config'
import { load, save, remove, PersistenceError, type StorageKind } from '../services/persistence'
import type { ChatConnection, Protocol } from '../services/chat/client'
import { useToastsStore } from './toasts'

const STORAGE_KEY = 'settings'

/**
 * The API key lives under its own storage key, never inside the settings
 * blob. That is deliberate: export/import and any future settings sync then
 * cannot carry the key by accident — there is no filter to forget.
 */
const API_KEY_STORAGE_KEY = 'api-key'

export type ThemePreference = 'light' | 'dark' | 'system'

/**
 * Where the API key is kept between reloads.
 *
 * `memory` loses it on reload but never touches disk; `session` clears when
 * the tab closes; `local` survives indefinitely and is the riskiest, so it is
 * opt-in rather than the default.
 */
export type KeyStorage = 'memory' | 'session' | 'local'

/**
 * `server` talks to our own backend, which holds the OpenAI key server-side —
 * no key in the browser. `custom` points at any other OpenAI-compatible
 * endpoint (Ollama, LM Studio, OpenAI itself) and needs a key from the user.
 */
export type ConnectionKind = 'server' | 'custom'

export interface ChatParams {
	temperature: number
	topP: number
	maxTokens: number | null
}

interface PersistedSettings {
	connectionKind: ConnectionKind
	customBaseUrl: string
	/**
	 * Wire protocol our own backend speaks.
	 *
	 * Still `legacy` — the deployed server only exposes `GET /text/?prompt=`.
	 * Flip this to `openai` once the rebuilt backend is live; the client
	 * already supports both.
	 */
	serverProtocol: Protocol
	keyStorage: KeyStorage
	model: string
	params: ChatParams
	theme: ThemePreference
	defaultSystemPrompt: string
	sendOnEnter: boolean
}

const DEFAULTS: PersistedSettings = {
	connectionKind: 'server',
	customBaseUrl: '',
	serverProtocol: 'legacy',
	keyStorage: 'session',
	model: 'gpt-4o-mini',
	params: { temperature: 0.7, topP: 1, maxTokens: null },
	theme: 'system',
	defaultSystemPrompt: '',
	sendOnEnter: true
}

function readStoredKey(kind: KeyStorage): string {
	if (kind === 'memory') return ''
	return load<string>(API_KEY_STORAGE_KEY, '', undefined, kind === 'local' ? 'local' : 'session')
}

export const useSettingsStore = defineStore('settings', () => {
	const stored = load<PersistedSettings>(STORAGE_KEY, DEFAULTS)
	// Merge rather than replace, so a settings blob written by an older build
	// still picks up defaults for fields it predates.
	const initial: PersistedSettings = {
		...DEFAULTS,
		...stored,
		params: { ...DEFAULTS.params, ...stored.params }
	}

	const connectionKind = ref<ConnectionKind>(initial.connectionKind)
	const customBaseUrl = ref(initial.customBaseUrl)
	const serverProtocol = ref<Protocol>(initial.serverProtocol)
	const keyStorage = ref<KeyStorage>(initial.keyStorage)
	const model = ref(initial.model)
	const params = ref<ChatParams>(initial.params)
	const theme = ref<ThemePreference>(initial.theme)
	const defaultSystemPrompt = ref(initial.defaultSystemPrompt)
	const sendOnEnter = ref(initial.sendOnEnter)

	const apiKey = ref(readStoredKey(initial.keyStorage))

	/** Base url actually used for requests. */
	function resolveBaseUrl(): string {
		if (connectionKind.value === 'custom' && customBaseUrl.value.trim()) {
			return customBaseUrl.value.trim().replace(/\/+$/, '')
		}
		return apiBaseUrl
	}

	/** Only the custom connection sends an Authorization header. */
	function resolveApiKey(): string | undefined {
		if (connectionKind.value !== 'custom') return undefined
		return apiKey.value.trim() || undefined
	}

	/** Everything the chat client needs, resolved from the current settings. */
	function resolveConnection(): ChatConnection {
		return {
			baseUrl: resolveBaseUrl(),
			apiKey: resolveApiKey(),
			// A user-supplied endpoint is OpenAI-compatible by definition;
			// only our own backend still speaks the legacy protocol.
			protocol: connectionKind.value === 'custom' ? 'openai' : serverProtocol.value
		}
	}

	function setApiKey(value: string) {
		apiKey.value = value
	}

	function persistKey() {
		// Clear both backing stores first: switching storage mode must not
		// leave a copy of the key behind in the one we moved away from.
		remove(API_KEY_STORAGE_KEY, 'local')
		remove(API_KEY_STORAGE_KEY, 'session')

		if (keyStorage.value === 'memory' || !apiKey.value) return

		const kind: StorageKind = keyStorage.value === 'local' ? 'local' : 'session'
		try {
			save(API_KEY_STORAGE_KEY, apiKey.value, kind)
		} catch (error) {
			if (error instanceof PersistenceError) useToastsStore().error(error.message)
		}
	}

	watch([apiKey, keyStorage], persistKey)

	watch(
		[
			connectionKind,
			customBaseUrl,
			serverProtocol,
			keyStorage,
			model,
			params,
			theme,
			defaultSystemPrompt,
			sendOnEnter
		],
		() => {
			const payload: PersistedSettings = {
				connectionKind: connectionKind.value,
				customBaseUrl: customBaseUrl.value,
				serverProtocol: serverProtocol.value,
				keyStorage: keyStorage.value,
				model: model.value,
				params: params.value,
				theme: theme.value,
				defaultSystemPrompt: defaultSystemPrompt.value,
				sendOnEnter: sendOnEnter.value
			}
			try {
				save(STORAGE_KEY, payload)
			} catch (error) {
				if (error instanceof PersistenceError) useToastsStore().error(error.message)
			}
		},
		{ deep: true }
	)

	return {
		connectionKind,
		customBaseUrl,
		serverProtocol,
		keyStorage,
		apiKey,
		model,
		params,
		theme,
		defaultSystemPrompt,
		sendOnEnter,
		resolveBaseUrl,
		resolveApiKey,
		resolveConnection,
		setApiKey
	}
})
