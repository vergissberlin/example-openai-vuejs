import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConversationsStore } from '../conversations'

describe('conversations store', () => {
	beforeEach(() => {
		localStorage.clear()
		setActivePinia(createPinia())
	})

	it('creates a chat and makes it active', () => {
		const store = useConversationsStore()
		const conversation = store.create()

		expect(store.conversations).toHaveLength(1)
		expect(store.activeId).toBe(conversation.id)
		expect(store.active?.id).toBe(conversation.id)
	})

	it('titles a chat from its first user message only', () => {
		const store = useConversationsStore()
		const { id } = store.create()

		store.appendMessage(id, 'user', 'How does streaming work?')
		expect(store.byId(id)?.title).toBe('How does streaming work?')

		store.appendMessage(id, 'assistant', 'It streams.')
		store.appendMessage(id, 'user', 'A later question')
		expect(store.byId(id)?.title).toBe('How does streaming work?')
	})

	it('truncates long titles', () => {
		const store = useConversationsStore()
		const { id } = store.create()

		store.appendMessage(id, 'user', 'x'.repeat(100))

		expect(store.byId(id)!.title).toHaveLength(48)
		expect(store.byId(id)!.title.endsWith('…')).toBe(true)
	})

	it('keeps a manual rename when the first message arrives', () => {
		const store = useConversationsStore()
		const { id } = store.create()

		store.rename(id, 'Renamed')
		store.appendMessage(id, 'user', 'Some question')

		expect(store.byId(id)?.title).toBe('Renamed')
	})

	it('falls back to an empty title being replaced by a default', () => {
		const store = useConversationsStore()
		const { id } = store.create()

		store.rename(id, '   ')

		expect(store.byId(id)?.title).toBe('New chat')
	})

	it('orders pinned chats first, then by recency', async () => {
		const store = useConversationsStore()
		const first = store.create({ title: 'first', updatedAt: 1 })
		const second = store.create({ title: 'second', updatedAt: 2 })
		const third = store.create({ title: 'third', updatedAt: 3 })

		expect(store.ordered.map((c) => c.id)).toEqual([third.id, second.id, first.id])

		store.togglePin(first.id)
		expect(store.ordered[0].id).toBe(first.id)
	})

	it('activates the next chat when the active one is deleted', () => {
		const store = useConversationsStore()
		const first = store.create({ updatedAt: 1 })
		const second = store.create({ updatedAt: 2 })

		store.setActive(second.id)
		store.remove(second.id)

		expect(store.activeId).toBe(first.id)
	})

	it('clears the active id when the last chat is deleted', () => {
		const store = useConversationsStore()
		const only = store.create()

		store.remove(only.id)

		expect(store.conversations).toHaveLength(0)
		expect(store.activeId).toBeNull()
	})

	it('drops a message and everything after it', () => {
		const store = useConversationsStore()
		const { id } = store.create()

		store.appendMessage(id, 'user', 'one')
		const second = store.appendMessage(id, 'assistant', 'two')!
		store.appendMessage(id, 'user', 'three')

		store.truncateFrom(id, second.id)

		expect(store.byId(id)!.messages.map((m) => m.content)).toEqual(['one'])
	})

	it('searches titles and message contents', () => {
		const store = useConversationsStore()
		const a = store.create()
		store.appendMessage(a.id, 'user', 'Something about kubernetes')

		const b = store.create()
		store.appendMessage(b.id, 'user', 'Unrelated')
		store.appendMessage(b.id, 'assistant', 'Mentions KUBERNETES in the body')

		expect(
			store
				.search('kubernetes')
				.map((c) => c.id)
				.sort()
		).toEqual([a.id, b.id].sort())
		expect(store.search('nothing-matches')).toHaveLength(0)
		expect(store.search('  ')).toHaveLength(2)
	})

	it('re-keys imported chats that collide with existing ids', () => {
		const store = useConversationsStore()
		const existing = store.create()

		store.importConversations([{ ...existing, title: 'Imported copy' }])

		expect(store.conversations).toHaveLength(2)
		expect(new Set(store.conversations.map((c) => c.id)).size).toBe(2)
	})

	it('replaces everything when importing with replace', () => {
		const store = useConversationsStore()
		store.create({ title: 'Old' })

		store.importConversations(
			[
				{
					id: 'imported',
					title: 'New',
					messages: [],
					createdAt: 1,
					updatedAt: 1,
					pinned: false
				}
			],
			true
		)

		expect(store.conversations.map((c) => c.title)).toEqual(['New'])
	})
})
