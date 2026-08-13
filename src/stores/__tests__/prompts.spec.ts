import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { usePromptsStore } from '../prompts'

describe('prompts store', () => {
	beforeEach(() => {
		localStorage.clear()
		setActivePinia(createPinia())
	})

	it('ships the personas the original demo could not reach', () => {
		const prompts = usePromptsStore()

		expect(prompts.all.map((preset) => preset.command)).toEqual(
			expect.arrayContaining(['yoda', 'gpt3', 'steve', 'elon', 'marvin'])
		)
		expect(prompts.all.every((preset) => preset.builtin)).toBe(true)
	})

	it('looks up a preset by command, case-insensitively', () => {
		const prompts = usePromptsStore()

		expect(prompts.findByCommand('YoDa')?.prompt).toBe('Write like Yoda: ')
		expect(prompts.findByCommand('nope')).toBeUndefined()
	})

	it('searches by command prefix and by title', () => {
		const prompts = usePromptsStore()

		expect(prompts.search('yo').map((p) => p.command)).toEqual(['yoda'])
		expect(prompts.search('paranoid').map((p) => p.command)).toEqual(['marvin'])
		expect(prompts.search('')).toHaveLength(prompts.all.length)
	})

	it('adds, updates and removes custom presets without touching built-ins', async () => {
		const prompts = usePromptsStore()
		const builtinCount = prompts.all.length

		const created = prompts.add({ command: 'pirate', title: 'Pirate', prompt: 'Arr: ' })
		expect(prompts.all).toHaveLength(builtinCount + 1)
		expect(created.builtin).toBe(false)

		prompts.update(created.id, { prompt: 'Arrr matey: ' })
		expect(prompts.findByCommand('pirate')?.prompt).toBe('Arrr matey: ')

		prompts.remove(created.id)
		expect(prompts.all).toHaveLength(builtinCount)
	})

	it('persists custom presets but not built-ins', async () => {
		const prompts = usePromptsStore()
		prompts.add({ command: 'pirate', title: 'Pirate', prompt: 'Arr: ' })
		await nextTick()

		const stored = localStorage.getItem('example-openai-vuejs:prompts') ?? ''
		expect(stored).toContain('pirate')
		expect(stored).not.toContain('yoda')
	})
})
