/**
 * The chat domain model.
 *
 * This replaces the original representation, where a conversation was a flat
 * `string[]` and the speaker was inferred from whether an entry sat at an even
 * or odd index. That left no room for ids, timestamps, per-message state or a
 * system prompt, all of which the features below need.
 */

export type Role = 'system' | 'user' | 'assistant'

/**
 * Lifecycle of a single message.
 *
 * `streaming` matters to the UI: it is the state in which the stop button is
 * shown and the content grows token by token.
 */
export type MessageStatus = 'streaming' | 'done' | 'error' | 'aborted'

export interface Message {
	id: string
	role: Role
	content: string
	createdAt: number
	status: MessageStatus
	/** Human-readable failure reason, set when `status` is `error`. */
	error?: string
	/** Model that produced this message; absent on user messages. */
	model?: string
}

export interface Conversation {
	id: string
	/** Derived from the first user message unless renamed explicitly. */
	title: string
	messages: Message[]
	createdAt: number
	updatedAt: number
	pinned: boolean
	/** Overrides the global default system prompt for this conversation. */
	systemPrompt?: string
	model?: string
}

/** A reusable prompt prefix, e.g. the personas the original demo shipped. */
export interface PromptPreset {
	id: string
	/** Typed after `/` in the composer to apply the preset. */
	command: string
	title: string
	prompt: string
	/** Built-in presets ship with the app and cannot be deleted. */
	builtin: boolean
}

export function createMessage(
	role: Role,
	content: string,
	overrides: Partial<Message> = {}
): Message {
	return {
		id: crypto.randomUUID(),
		role,
		content,
		createdAt: Date.now(),
		status: 'done',
		...overrides
	}
}

/**
 * Builds a conversation title from its first user message.
 *
 * Kept short enough to fit the sidebar without truncation doing the work.
 */
export function deriveTitle(content: string): string {
	const normalised = content.replace(/\s+/g, ' ').trim()
	if (!normalised) return 'New chat'
	return normalised.length > 48 ? `${normalised.slice(0, 47)}…` : normalised
}

export function createConversation(overrides: Partial<Conversation> = {}): Conversation {
	const now = Date.now()
	return {
		id: crypto.randomUUID(),
		title: 'New chat',
		messages: [],
		createdAt: now,
		updatedAt: now,
		pinned: false,
		...overrides
	}
}
