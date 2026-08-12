<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Ref } from 'vue'
import LoadingIndicator from '../components/LoadingIndicator.vue'
import ChatMessage from '../components/chat/ChatMessage.vue'
import { useConversationsStore } from '../stores/conversations'
import { useSettingsStore } from '../stores/settings'
import { usePromptsStore } from '../stores/prompts'
import { useToastsStore } from '../stores/toasts'

const props = defineProps<{ id: string }>()

const router = useRouter()
const conversations = useConversationsStore()
const settings = useSettingsStore()
const prompts = usePromptsStore()
const toasts = useToastsStore()

const prompt: Ref<string> = ref('')
const pending = ref(false)
const bottom = ref<HTMLDivElement | null>(null)

const conversation = computed(() => conversations.byId(props.id) ?? null)

/** Messages of the active chat, without the system turn. */
const messages = computed(
	() => conversation.value?.messages.filter((message) => message.role !== 'system') ?? []
)

/**
 * Keeps the store in sync with the url, and redirects when the url points at
 * a chat that no longer exists — a stale bookmark, or a chat deleted in
 * another tab.
 */
watch(
	() => props.id,
	(id) => {
		if (conversations.byId(id)) {
			conversations.setActive(id)
		} else {
			router.replace({ name: 'home' })
		}
	},
	{ immediate: true }
)

/**
 * Expands a leading `/command` into its preset prefix.
 *
 * This is what finally makes the personas reachable — they shipped with the
 * original demo but had no UI to select them.
 */
function applyPreset(input: string): string {
	const match = input.match(/^\/(\S+)\s*([\s\S]*)$/)
	if (!match) return input

	const preset = prompts.findByCommand(match[1])
	return preset ? preset.prompt + match[2] : input
}

const askAi = async (): Promise<void> => {
	const text = prompt.value.trim()
	if (!text || pending.value || !conversation.value) return

	const conversationId = conversation.value.id

	conversations.appendMessage(conversationId, 'user', text)
	prompt.value = ''
	pending.value = true

	const reply = conversations.appendMessage(conversationId, 'assistant', '', {
		status: 'streaming',
		model: settings.model
	})

	try {
		const query = encodeURIComponent(applyPreset(text))
		const response = await fetch(`${settings.resolveBaseUrl()}/text/?prompt=${query}`)

		if (!response.ok) {
			throw new Error(`The server responded with ${response.status}.`)
		}

		const data = (await response.json()) as { text?: string }
		const content = (data.text ?? '').replace(/^\n\n/, '')

		if (reply) {
			conversations.updateMessage(conversationId, reply.id, { content, status: 'done' })
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : 'The request failed.'

		if (reply) {
			conversations.updateMessage(conversationId, reply.id, {
				status: 'error',
				error: message
			})
		}
		toasts.error(message)
	} finally {
		// Always reset. Previously this lived inside the success handler only,
		// so a single failed request disabled the input until a page reload.
		pending.value = false
		bottom.value?.scrollIntoView({ behavior: 'smooth' })
	}
}
</script>

<template>
	<div class="flex flex-col flex-1 min-h-0">
		<div class="flex-1 min-h-0 overflow-y-auto">
			<p
				v-if="!messages.length"
				class="p-12 text-center text-neutral-500 dark:text-neutral-400"
			>
				Ask something to start this chat. Type <code>/</code> to use a persona.
			</p>

			<ChatMessage v-for="message in messages" :key="message.id" :message="message" />

			<LoadingIndicator v-if="pending" />
			<div ref="bottom"></div>
		</div>

		<footer class="px-6 py-4 border-t border-neutral-300 md:px-12 dark:border-neutral-700">
			<input
				type="text"
				placeholder="Ask me something"
				v-model="prompt"
				class="w-full px-6 py-4 text-sm bg-white border-2 rounded-lg border-neutral-300 focus:outline-none focus:border-neutral-400 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
				:disabled="pending"
				autofocus
				@keyup.enter="askAi()"
			/>
		</footer>
	</div>
</template>
