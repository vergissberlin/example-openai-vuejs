import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { PromptPreset } from '../types/chat'
import { load, save, PersistenceError } from '../services/persistence'
import { useToastsStore } from './toasts'

const STORAGE_KEY = 'prompts'

/**
 * The personas the original demo already shipped.
 *
 * They existed in ChatView as a `promptTemplates` object, but `configTemplate`
 * was hardcoded to 'neutral' and no UI ever set it, so none of them could be
 * reached. They are presets now, selectable via `/command` in the composer.
 */
const BUILTIN_PRESETS: PromptPreset[] = [
	{
		id: 'builtin-yoda',
		command: 'yoda',
		title: 'Yoda',
		prompt: 'Write like Yoda: ',
		builtin: true
	},
	{
		id: 'builtin-gpt3',
		command: 'gpt3',
		title: 'GPT-3',
		prompt: 'Write like GPT-3: ',
		builtin: true
	},
	{
		id: 'builtin-steve',
		command: 'steve',
		title: 'Steve Jobs',
		prompt: 'Write like Steve Jobs. Very polite and push people forward: ',
		builtin: true
	},
	{
		id: 'builtin-elon',
		command: 'elon',
		title: 'Elon Musk',
		prompt: 'Write like Elon Musk: ',
		builtin: true
	},
	{
		id: 'builtin-marvin',
		command: 'marvin',
		title: 'Marvin the Paranoid Android',
		prompt: 'Write like Marvin the Paranoid Android: ',
		builtin: true
	}
]

export const usePromptsStore = defineStore('prompts', () => {
	/** User-defined presets only; built-ins are not persisted. */
	const custom = ref<PromptPreset[]>(load<PromptPreset[]>(STORAGE_KEY, []))

	const all = computed<PromptPreset[]>(() => [...BUILTIN_PRESETS, ...custom.value])

	function findByCommand(command: string): PromptPreset | undefined {
		const needle = command.toLowerCase()
		return all.value.find((preset) => preset.command.toLowerCase() === needle)
	}

	/** Presets whose command starts with `query`, for the composer's menu. */
	function search(query: string): PromptPreset[] {
		const needle = query.toLowerCase()
		if (!needle) return all.value
		return all.value.filter(
			(preset) =>
				preset.command.toLowerCase().startsWith(needle) ||
				preset.title.toLowerCase().includes(needle)
		)
	}

	function add(preset: Omit<PromptPreset, 'id' | 'builtin'>): PromptPreset {
		const created: PromptPreset = { ...preset, id: crypto.randomUUID(), builtin: false }
		custom.value.push(created)
		return created
	}

	function update(id: string, patch: Partial<Omit<PromptPreset, 'id' | 'builtin'>>) {
		const preset = custom.value.find((item) => item.id === id)
		if (preset) Object.assign(preset, patch)
	}

	function remove(id: string) {
		custom.value = custom.value.filter((preset) => preset.id !== id)
	}

	watch(
		custom,
		(value) => {
			try {
				save(STORAGE_KEY, value)
			} catch (error) {
				if (error instanceof PersistenceError) useToastsStore().error(error.message)
			}
		},
		{ deep: true }
	)

	return { custom, all, findByCommand, search, add, update, remove }
})
