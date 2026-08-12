/**
 * Versioned browser-storage helpers.
 *
 * Everything is wrapped in an envelope carrying a schema version, so a future
 * change to the stored shape can migrate old data instead of throwing it away
 * or — worse — reading it back as the wrong type.
 *
 * All reads are total: unavailable storage (private mode, disabled cookies),
 * malformed JSON and unknown schema versions all fall back to the caller's
 * default rather than throwing. Writes are the opposite — a failed write is
 * reported so the caller can tell the user their data is not being saved.
 */

const KEY_PREFIX = 'example-openai-vuejs'

export const SCHEMA_VERSION = 1

interface Envelope<T> {
	version: number
	data: T
}

export type StorageKind = 'local' | 'session'

export class PersistenceError extends Error {
	constructor(
		message: string,
		readonly kind: 'quota' | 'unavailable' | 'unknown'
	) {
		super(message)
		this.name = 'PersistenceError'
	}
}

/**
 * Returns the requested storage, or null when the browser denies access.
 *
 * Touching `window.localStorage` throws outright in some privacy modes, so
 * even the lookup has to be guarded.
 */
function getStorage(kind: StorageKind): Storage | null {
	try {
		return kind === 'local' ? window.localStorage : window.sessionStorage
	} catch {
		return null
	}
}

function namespaced(key: string): string {
	return `${KEY_PREFIX}:${key}`
}

/**
 * Migrates a stored payload to the current schema version.
 *
 * Returning null means "unusable, fall back to the default".
 */
export type Migration<T> = (data: unknown, version: number) => T | null

export function load<T>(
	key: string,
	fallback: T,
	migrate?: Migration<T>,
	kind: StorageKind = 'local'
): T {
	const storage = getStorage(kind)
	if (!storage) return fallback

	const raw = storage.getItem(namespaced(key))
	if (raw === null) return fallback

	let envelope: Envelope<T>
	try {
		envelope = JSON.parse(raw) as Envelope<T>
	} catch {
		return fallback
	}

	if (typeof envelope !== 'object' || envelope === null || !('version' in envelope)) {
		return fallback
	}

	if (envelope.version !== SCHEMA_VERSION) {
		const migrated = migrate?.(envelope.data, envelope.version)
		return migrated ?? fallback
	}

	return envelope.data
}

export function save<T>(key: string, data: T, kind: StorageKind = 'local'): void {
	const storage = getStorage(kind)
	if (!storage) {
		throw new PersistenceError('Browser storage is not available.', 'unavailable')
	}

	const envelope: Envelope<T> = { version: SCHEMA_VERSION, data }

	try {
		storage.setItem(namespaced(key), JSON.stringify(envelope))
	} catch (error) {
		// Chrome/Safari/Firefox all report a full quota differently; the name
		// is the only reliable signal across them.
		const name = error instanceof Error ? error.name : ''
		const isQuota = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'

		throw new PersistenceError(
			isQuota
				? 'Browser storage is full, so this change was not saved.'
				: 'Could not write to browser storage.',
			isQuota ? 'quota' : 'unknown'
		)
	}
}

export function remove(key: string, kind: StorageKind = 'local'): void {
	getStorage(kind)?.removeItem(namespaced(key))
}
