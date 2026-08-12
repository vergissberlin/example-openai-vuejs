<script setup lang="ts">
import { computed, onMounted } from 'vue'
import LoadingIndicator from '../components/LoadingIndicator.vue'
import { useConversationsStore } from '../stores/conversations'
import { useSettingsStore } from '../stores/settings'
import { usePromptsStore } from '../stores/prompts'
import { useToastsStore } from '../stores/toasts'
import { ref } from 'vue'
import type { Ref } from 'vue'

const conversations = useConversationsStore()
const settings = useSettingsStore()
const prompts = usePromptsStore()
const toasts = useToastsStore()

const prompt: Ref<string> = ref('')
const pending = ref(false)
const promptElement = ref<HTMLDivElement | null>(null)

/** Messages of the active chat, without the system turn. */
const messages = computed(() => conversations.active?.messages.filter((m) => m.role !== 'system') ?? [])

onMounted(() => {
	if (!conversations.active) conversations.create()
})

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
	if (!text || pending.value) return

	const conversation = conversations.active ?? conversations.create()
	const conversationId = conversation.id

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
			conversations.updateMessage(conversationId, reply.id, { status: 'error', error: message })
		}
		toasts.error(message)
	} finally {
		// Always reset. Previously this lived inside the success handler only,
		// so a single failed request disabled the input until a page reload.
		pending.value = false
		promptElement.value?.scrollIntoView()
	}
}
</script>

<template>
	<main class="py-12 mb-auto">
		<LoadingIndicator v-if="pending" />
		<ul>
			<li
				v-for="message in messages"
				:key="message.id"
				class="px-12 py-3 leading-normal whitespace-pre-wrap"
				:class="
					message.role === 'assistant'
						? 'bg-neutral-300 dark:bg-neutral-700'
						: 'bg-transparent'
				"
			>
				<span v-if="message.status === 'error'" class="text-red-700 dark:text-red-400">
					{{ message.error }}
				</span>
				<span v-else>{{ message.content }}</span>
			</li>
		</ul>
	</main>
	<footer class="w-screen px-12 py-4">
		<div ref="promptElement">
			<input
				type="text"
				placeholder="Ask me something"
				v-model="prompt"
				class="w-full px-6 py-4 text-sm bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
				:disabled="pending"
				autofocus
				@keyup.enter="askAi()"
			/>
		</div>
	</footer>
</template>
