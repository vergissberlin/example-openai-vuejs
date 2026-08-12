import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { createConversation, createMessage, deriveTitle } from '../types/chat'
import type { Conversation, Message, Role } from '../types/chat'
import { load, save, PersistenceError } from '../services/persistence'
import { useToastsStore } from './toasts'

const STORAGE_KEY = 'conversations'

/** Writes are debounced so streaming does not hit storage on every token. */
const PERSIST_DEBOUNCE_MS = 300

export const useConversationsStore = defineStore('conversations', () => {
	const conversations = ref<Conversation[]>(load<Conversation[]>(STORAGE_KEY, []))
	const activeId = ref<string | null>(conversations.value[0]?.id ?? null)

	/** Pinned first, then most recently updated. */
	const ordered = computed<Conversation[]>(() =>
		[...conversations.value].sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
			return b.updatedAt - a.updatedAt
		})
	)

	const active = computed<Conversation | null>(
		() => conversations.value.find((c) => c.id === activeId.value) ?? null
	)

	function byId(id: string): Conversation | undefined {
		return conversations.value.find((c) => c.id === id)
	}

	function touch(conversation: Conversation) {
		conversation.updatedAt = Date.now()
	}

	function create(overrides: Partial<Conversation> = {}): Conversation {
		const conversation = createConversation(overrides)
		conversations.value.push(conversation)
		activeId.value = conversation.id
		return conversation
	}

	function setActive(id: string | null) {
		activeId.value = id
	}

	function remove(id: string) {
		const index = conversations.value.findIndex((c) => c.id === id)
		if (index === -1) return

		conversations.value.splice(index, 1)

		if (activeId.value === id) {
			// Fall through to the next most relevant chat rather than leaving
			// the view empty.
			activeId.value = ordered.value[0]?.id ?? null
		}
	}

	function rename(id: string, title: string) {
		const conversation = byId(id)
		if (!conversation) return
		conversation.title = title.trim() || 'New chat'
		touch(conversation)
	}

	function togglePin(id: string) {
		const conversation = byId(id)
		if (!conversation) return
		conversation.pinned = !conversation.pinned
		touch(conversation)
	}

	function clearAll() {
		conversations.value = []
		activeId.value = null
	}

	function appendMessage(
		conversationId: string,
		role: Role,
		content: string,
		overrides: Partial<Message> = {}
	): Message | null {
		const conversation = byId(conversationId)
		if (!conversation) return null

		const message = createMessage(role, content, overrides)
		conversation.messages.push(message)

		// The first user message names the chat, unless it has been renamed.
		if (role === 'user' && conversation.title === 'New chat') {
			conversation.title = deriveTitle(content)
		}

		touch(conversation)
		return message
	}

	function updateMessage(conversationId: string, messageId: string, patch: Partial<Message>) {
		const conversation = byId(conversationId)
		const message = conversation?.messages.find((m) => m.id === messageId)
		if (!conversation || !message) return

		Object.assign(message, patch)
		touch(conversation)
	}

	function removeMessage(conversationId: string, messageId: string) {
		const conversation = byId(conversationId)
		if (!conversation) return

		conversation.messages = conversation.messages.filter((m) => m.id !== messageId)
		touch(conversation)
	}

	/**
	 * Drops `messageId` and everything after it.
	 *
	 * Used by regenerate and edit-and-resend: both continue from a point in
	 * the conversation, which means the turns that followed are no longer
	 * valid.
	 */
	function truncateFrom(conversationId: string, messageId: string) {
		const conversation = byId(conversationId)
		if (!conversation) return

		const index = conversation.messages.findIndex((m) => m.id === messageId)
		if (index === -1) return

		conversation.messages = conversation.messages.slice(0, index)
		touch(conversation)
	}

	/** Matches on both the title and message contents. */
	function search(query: string): Conversation[] {
		const needle = query.trim().toLowerCase()
		if (!needle) return ordered.value

		return ordered.value.filter(
			(conversation) =>
				conversation.title.toLowerCase().includes(needle) ||
				conversation.messages.some((message) =>
					message.content.toLowerCase().includes(needle)
				)
		)
	}

	function importConversations(incoming: Conversation[], replace = false) {
		if (replace) {
			conversations.value = incoming
		} else {
			// Re-key imports so a re-import never overwrites existing chats.
			const existing = new Set(conversations.value.map((c) => c.id))
			const deduped = incoming.map((conversation) =>
				existing.has(conversation.id)
					? { ...conversation, id: crypto.randomUUID() }
					: conversation
			)
			conversations.value.push(...deduped)
		}
		activeId.value = ordered.value[0]?.id ?? null
	}

	let persistTimer: ReturnType<typeof setTimeout> | undefined
	let quotaReported = false

	watch(
		conversations,
		(value) => {
			clearTimeout(persistTimer)
			persistTimer = setTimeout(() => {
				try {
					save(STORAGE_KEY, value)
					quotaReported = false
				} catch (error) {
					// Only surface this once per failing streak — a full quota
					// would otherwise raise a toast on every keystroke.
					if (error instanceof PersistenceError && !quotaReported) {
						quotaReported = true
						useToastsStore().error(error.message)
					}
				}
			}, PERSIST_DEBOUNCE_MS)
		},
		{ deep: true }
	)

	return {
		conversations,
		activeId,
		ordered,
		active,
		byId,
		create,
		setActive,
		remove,
		rename,
		togglePin,
		clearAll,
		appendMessage,
		updateMessage,
		removeMessage,
		truncateFrom,
		search,
		importConversations
	}
})
