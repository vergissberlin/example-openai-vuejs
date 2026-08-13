<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from '../ui/BaseModal.vue'
import { useSettingsStore } from '../../stores/settings'
import { usePromptsStore } from '../../stores/prompts'
import { useConversationsStore } from '../../stores/conversations'
import { useToastsStore } from '../../stores/toasts'
import { listModels } from '../../services/chat/client'
import { fromUnknown } from '../../services/chat/errors'
import type { Conversation } from '../../types/chat'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const prompts = usePromptsStore()
const conversations = useConversationsStore()
const toasts = useToastsStore()

const {
	connectionKind,
	customBaseUrl,
	serverProtocol,
	keyStorage,
	apiKey,
	model,
	params,
	theme,
	defaultSystemPrompt,
	sendOnEnter
} = storeToRefs(settings)

const tabs = ['Connection', 'Model', 'Interface', 'Prompts', 'Data'] as const
const tab = ref<(typeof tabs)[number]>('Connection')

const models = ref<string[]>([])
const loadingModels = ref(false)

async function refreshModels() {
	loadingModels.value = true
	try {
		models.value = (await listModels(settings.resolveConnection())).map((entry) => entry.id)
		if (!models.value.length) {
			toasts.info('This endpoint did not return a model list.')
		}
	} catch (error) {
		toasts.error(fromUnknown(error).message)
	} finally {
		loadingModels.value = false
	}
}

// --- Prompt library -------------------------------------------------------

const draft = ref({ command: '', title: '', prompt: '' })

function addPreset() {
	const command = draft.value.command.trim().replace(/^\//, '')
	if (!command || !draft.value.prompt.trim()) return

	if (prompts.findByCommand(command)) {
		toasts.error(`/${command} already exists.`)
		return
	}

	prompts.add({
		command,
		title: draft.value.title.trim() || command,
		prompt: draft.value.prompt
	})
	draft.value = { command: '', title: '', prompt: '' }
}

// --- Export / import ------------------------------------------------------

function exportChats() {
	// Settings are deliberately not part of this: the api key lives under its
	// own storage key so an export can never carry it, and bundling settings
	// would put that guarantee back in the hands of a filter.
	const blob = new Blob([JSON.stringify(conversations.conversations, null, 2)], {
		type: 'application/json'
	})
	const url = URL.createObjectURL(blob)

	const link = document.createElement('a')
	link.href = url
	link.download = 'chats.json'
	link.click()
	URL.revokeObjectURL(url)
}

const fileInput = ref<HTMLInputElement | null>(null)

async function importChats(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0]
	if (!file) return

	try {
		const parsed = JSON.parse(await file.text()) as unknown
		if (!Array.isArray(parsed)) throw new Error('Expected a list of conversations.')

		const valid = parsed.filter(
			(entry): entry is Conversation =>
				!!entry &&
				typeof entry === 'object' &&
				typeof (entry as Conversation).id === 'string' &&
				Array.isArray((entry as Conversation).messages)
		)

		if (!valid.length) throw new Error('No conversations found in that file.')

		conversations.importConversations(valid)
		toasts.success(`Imported ${valid.length} chat${valid.length === 1 ? '' : 's'}.`)
	} catch (error) {
		toasts.error(error instanceof Error ? error.message : 'Could not read that file.')
	} finally {
		// Reset so re-picking the same file fires change again.
		if (fileInput.value) fileInput.value.value = ''
	}
}

function clearAll() {
	if (!window.confirm('Delete every chat? This cannot be undone.')) return
	conversations.clearAll()
	toasts.success('All chats deleted.')
}
</script>

<template>
	<BaseModal :open="open" title="Settings" @close="emit('close')">
		<div class="flex flex-col sm:flex-row">
			<nav
				class="flex flex-row overflow-x-auto border-b sm:flex-col sm:w-40 sm:border-b-0 sm:border-r border-neutral-300 dark:border-neutral-700"
			>
				<button
					v-for="entry in tabs"
					:key="entry"
					type="button"
					class="px-4 py-3 text-sm text-left whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800"
					:class="tab === entry ? 'font-medium text-green-700 dark:text-green-500' : ''"
					@click="tab = entry"
				>
					{{ entry }}
				</button>
			</nav>

			<div class="flex-1 p-5 space-y-4 text-sm">
				<!-- Connection -->
				<template v-if="tab === 'Connection'">
					<label class="block">
						<span class="block mb-1 font-medium">Endpoint</span>
						<select
							v-model="connectionKind"
							class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
						>
							<option value="server">Bundled backend (no key needed)</option>
							<option value="custom">Custom OpenAI-compatible endpoint</option>
						</select>
					</label>

					<template v-if="connectionKind === 'server'">
						<label class="block">
							<span class="block mb-1 font-medium">Protocol</span>
							<select
								v-model="serverProtocol"
								class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
							>
								<option value="legacy">Legacy /text/ (one-shot)</option>
								<option value="openai">OpenAI-compatible /v1 (streaming)</option>
							</select>
						</label>
						<p class="text-neutral-600 dark:text-neutral-400">
							The deployed backend still answers on the legacy route, which returns
							the whole reply at once and has no real multi-turn history. Switch to
							the streaming protocol once the rebuilt server is live.
						</p>
					</template>

					<template v-else>
						<label class="block">
							<span class="block mb-1 font-medium">Base URL</span>
							<input
								v-model="customBaseUrl"
								type="url"
								placeholder="http://localhost:11434"
								class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
							/>
						</label>

						<label class="block">
							<span class="block mb-1 font-medium">API key</span>
							<input
								v-model="apiKey"
								type="password"
								autocomplete="off"
								placeholder="sk-…"
								class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
							/>
						</label>

						<label class="block">
							<span class="block mb-1 font-medium">Keep the key</span>
							<select
								v-model="keyStorage"
								class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
							>
								<option value="memory">
									Until this page reloads (never stored)
								</option>
								<option value="session">Until this tab closes</option>
								<option value="local">Indefinitely</option>
							</select>
						</label>

						<p
							class="p-3 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
						>
							<strong>A key in the browser is only as safe as this page.</strong>
							It is never sent to the bundled backend and never included in an export,
							but any script running here could read it. Use a key scoped to what you
							need, and prefer the bundled backend on a shared or public deployment.
						</p>

						<p v-if="keyStorage === 'local'" class="text-amber-700 dark:text-amber-400">
							Stored indefinitely: the key stays on this device until you clear it.
						</p>
					</template>
				</template>

				<!-- Model -->
				<template v-else-if="tab === 'Model'">
					<label class="block">
						<span class="block mb-1 font-medium">Model</span>
						<input
							v-model="model"
							list="known-models"
							class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
						/>
						<datalist id="known-models">
							<option v-for="id in models" :key="id" :value="id"></option>
						</datalist>
					</label>

					<button
						type="button"
						class="px-3 py-2 border rounded-lg border-neutral-300 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
						:disabled="loadingModels"
						@click="refreshModels"
					>
						{{ loadingModels ? 'Loading…' : 'Fetch available models' }}
					</button>

					<label class="block">
						<span class="block mb-1 font-medium">
							Temperature: {{ params.temperature }}
						</span>
						<input
							v-model.number="params.temperature"
							type="range"
							min="0"
							max="2"
							step="0.1"
							class="w-full"
						/>
					</label>

					<label class="block">
						<span class="block mb-1 font-medium">Top P: {{ params.topP }}</span>
						<input
							v-model.number="params.topP"
							type="range"
							min="0"
							max="1"
							step="0.05"
							class="w-full"
						/>
					</label>

					<label class="block">
						<span class="block mb-1 font-medium">Max tokens (blank = no limit)</span>
						<input
							v-model.number="params.maxTokens"
							type="number"
							min="1"
							class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
						/>
					</label>

					<label class="block">
						<span class="block mb-1 font-medium">System prompt</span>
						<textarea
							v-model="defaultSystemPrompt"
							rows="3"
							placeholder="Applied to every new message."
							class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
						></textarea>
					</label>
				</template>

				<!-- Interface -->
				<template v-else-if="tab === 'Interface'">
					<label class="block">
						<span class="block mb-1 font-medium">Theme</span>
						<select
							v-model="theme"
							class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
						>
							<option value="system">Follow the system</option>
							<option value="light">Light</option>
							<option value="dark">Dark</option>
						</select>
					</label>

					<label class="flex items-center gap-2">
						<input v-model="sendOnEnter" type="checkbox" />
						<span>Send with Enter (Shift+Enter for a newline)</span>
					</label>

					<div class="text-neutral-600 dark:text-neutral-400">
						<p class="mb-1 font-medium text-neutral-800 dark:text-neutral-200">
							Shortcuts
						</p>
						<p><kbd>Ctrl/⌘ + K</kbd> — new chat</p>
						<p><kbd>Ctrl/⌘ + ,</kbd> — settings</p>
						<p><kbd>Esc</kbd> — close this dialog, or stop generating</p>
					</div>
				</template>

				<!-- Prompts -->
				<template v-else-if="tab === 'Prompts'">
					<p class="text-neutral-600 dark:text-neutral-400">
						Type <code>/command</code> at the start of a message to apply a preset.
					</p>

					<ul class="divide-y divide-neutral-200 dark:divide-neutral-800">
						<li
							v-for="preset in prompts.all"
							:key="preset.id"
							class="flex items-start gap-3 py-2"
						>
							<div class="flex-1">
								<p class="font-medium">
									/{{ preset.command }}
									<span class="font-normal text-neutral-500">
										— {{ preset.title }}
									</span>
								</p>
								<p class="text-neutral-600 dark:text-neutral-400">
									{{ preset.prompt }}
								</p>
							</div>
							<button
								v-if="!preset.builtin"
								type="button"
								class="px-2 py-1 text-red-700 dark:text-red-400"
								:aria-label="`Delete /${preset.command}`"
								@click="prompts.remove(preset.id)"
							>
								🗑
							</button>
							<span v-else class="text-xs text-neutral-500">built-in</span>
						</li>
					</ul>

					<div class="pt-2 space-y-2 border-t border-neutral-300 dark:border-neutral-700">
						<p class="font-medium">Add a preset</p>
						<input
							v-model="draft.command"
							placeholder="command (without the slash)"
							aria-label="Preset command"
							class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
						/>
						<input
							v-model="draft.title"
							placeholder="title"
							aria-label="Preset title"
							class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
						/>
						<textarea
							v-model="draft.prompt"
							rows="2"
							placeholder="prompt prefix"
							aria-label="Preset prompt"
							class="w-full px-3 py-2 bg-white border rounded-lg border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
						></textarea>
						<button
							type="button"
							class="px-3 py-2 text-white bg-green-700 rounded-lg hover:bg-green-600"
							@click="addPreset"
						>
							Add preset
						</button>
					</div>
				</template>

				<!-- Data -->
				<template v-else>
					<p class="text-neutral-600 dark:text-neutral-400">
						Chats live in this browser only. Exports contain conversations, never the
						API key.
					</p>

					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							class="px-3 py-2 border rounded-lg border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
							@click="exportChats"
						>
							Export chats
						</button>

						<button
							type="button"
							class="px-3 py-2 border rounded-lg border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
							@click="fileInput?.click()"
						>
							Import chats
						</button>
						<input
							ref="fileInput"
							type="file"
							accept="application/json"
							class="hidden"
							aria-label="Import chats"
							@change="importChats"
						/>

						<button
							type="button"
							class="px-3 py-2 text-white bg-red-700 rounded-lg hover:bg-red-600"
							@click="clearAll"
						>
							Delete all chats
						</button>
					</div>
				</template>
			</div>
		</div>
	</BaseModal>
</template>
