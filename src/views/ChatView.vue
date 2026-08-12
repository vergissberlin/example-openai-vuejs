<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LoadingIndicator from '../components/LoadingIndicator.vue'
import ChatMessage from '../components/chat/ChatMessage.vue'
import { useConversationsStore } from '../stores/conversations'
import { useSettingsStore } from '../stores/settings'
import { usePromptsStore } from '../stores/prompts'
import { useToastsStore } from '../stores/toasts'
import { streamChat } from '../services/chat/client'
import { fromUnknown } from '../services/chat/errors'
import type { Message } from '../types/chat'

const props = defineProps<{ id: string }>()

const router = useRouter()
const conversations = useConversationsStore()
const settings = useSettingsStore()
const prompts = usePromptsStore()
const toasts = useToastsStore()

const prompt = ref('')
const pending = ref(false)
const bottom = ref<HTMLDivElement | null>(null)

/** Live while a response streams; `stop()` aborts through it. */
let controller: AbortController | null = null

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

/** Everything the model sees: system prompt, prior turns, the new message. */
function buildRequestMessages(history: Message[], userText: string): Message[] {
	const system = settings.defaultSystemPrompt.trim() || conversation.value?.systemPrompt?.trim()

	return [
		...(system
			? [
					{
						id: 'system',
						role: 'system' as const,
						content: system,
						createdAt: 0,
						status: 'done' as const
					}
				]
			: []),
		...history.filter((message) => message.role !== 'system' && message.content),
		{
			id: 'pending',
			role: 'user' as const,
			content: userText,
			createdAt: Date.now(),
			status: 'done' as const
		}
	]
}

function stop() {
	controller?.abort()
}

async function send(): Promise<void> {
	const text = prompt.value.trim()
	if (!text || pending.value || !conversation.value) return

	const conversationId = conversation.value.id
	const history = [...conversation.value.messages]

	conversations.appendMessage(conversationId, 'user', text)
	prompt.value = ''
	pending.value = true

	const reply = conversations.appendMessage(conversationId, 'assistant', '', {
		status: 'streaming',
		model: settings.model
	})

	controller = new AbortController()
	let received = ''

	try {
		const stream = streamChat(settings.resolveConnection(), {
			messages: buildRequestMessages(history, applyPreset(text)),
			model: settings.model,
			temperature: settings.params.temperature,
			topP: settings.params.topP,
			maxTokens: settings.params.maxTokens,
			signal: controller.signal
		})

		for await (const delta of stream) {
			received += delta
			if (reply) {
				conversations.updateMessage(conversationId, reply.id, { content: received })
			}
			bottom.value?.scrollIntoView({ block: 'end' })
		}

		if (reply) {
			conversations.updateMessage(conversationId, reply.id, { status: 'done' })
		}
	} catch (error) {
		const chatError = fromUnknown(error)

		if (reply) {
			// Whatever arrived before the failure is kept: a partial answer is
			// more useful than discarding it, and marking the message tells the
			// user it is incomplete.
			conversations.updateMessage(conversationId, reply.id, {
				content: received,
				status: chatError.kind === 'aborted' ? 'aborted' : 'error',
				error: received ? undefined : chatError.message
			})
		}

		// Stopping on purpose is not a failure worth a toast.
		if (chatError.kind !== 'aborted') toasts.error(chatError.message)
	} finally {
		// Always reset. Previously this lived inside the success handler only,
		// so a single failed request disabled the input until a page reload.
		pending.value = false
		controller = null
		bottom.value?.scrollIntoView({ behavior: 'smooth' })
	}
}

function onKeydown(event: KeyboardEvent) {
	if (event.key !== 'Enter') return
	// Shift+Enter inserts a newline; plain Enter sends, unless turned off.
	if (event.shiftKey || !settings.sendOnEnter) return

	event.preventDefault()
	void send()
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

			<LoadingIndicator v-if="pending && !messages.at(-1)?.content" />
			<div ref="bottom"></div>
		</div>

		<footer class="px-6 py-4 border-t border-neutral-300 md:px-12 dark:border-neutral-700">
			<div class="flex items-end gap-2">
				<textarea
					v-model="prompt"
					rows="1"
					placeholder="Ask me something"
					class="flex-1 px-6 py-4 text-sm bg-white border-2 rounded-lg resize-y border-neutral-300 focus:outline-none focus:border-neutral-400 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
					autofocus
					@keydown="onKeydown"
				></textarea>

				<button
					v-if="pending"
					type="button"
					class="px-5 py-4 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-600"
					@click="stop"
				>
					Stop
				</button>
				<button
					v-else
					type="button"
					class="px-5 py-4 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-600 disabled:opacity-50"
					:disabled="!prompt.trim()"
					@click="send"
				>
					Send
				</button>
			</div>
		</footer>
	</div>
</template>
