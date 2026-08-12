<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Message } from '../../types/chat'
import { loadMarkdown, renderIfLoaded } from '../../services/markdownLoader'

const props = defineProps<{ message: Message }>()

/** Flips once the renderer chunk has arrived, re-running the computed below. */
const rendererReady = ref(false)

onMounted(() => {
	if (props.message.role !== 'assistant') return
	loadMarkdown().then(() => {
		rendererReady.value = true
	})
})

const html = computed(() => {
	if (props.message.role !== 'assistant') return ''
	// Read the flag so this recomputes when the chunk lands.
	void rendererReady.value
	return renderIfLoaded(props.message.content)
})

/**
 * Single delegated handler for every copy button in this message.
 *
 * The buttons are plain markup emitted by the markdown renderer, so one
 * listener here replaces mounting a component per code block.
 */
async function onClick(event: MouseEvent) {
	const target = event.target as HTMLElement | null
	const button = target?.closest('[data-copy]')
	if (!button) return

	const code = button.closest('.code-block')?.querySelector('code')?.textContent ?? ''
	if (!code) return

	try {
		await navigator.clipboard.writeText(code)
		button.textContent = 'Copied'
		setTimeout(() => {
			button.textContent = 'Copy'
		}, 1500)
	} catch {
		// Clipboard access can be denied outright; say so rather than
		// pretending the copy worked.
		button.textContent = 'Press ⌘/Ctrl+C'
	}
}
</script>

<template>
	<article
		class="px-6 py-4 md:px-12"
		:class="
			message.role === 'assistant'
				? 'bg-neutral-300 dark:bg-neutral-700'
				: 'bg-transparent'
		"
	>
		<p class="mb-1 text-xs font-medium uppercase text-neutral-600 dark:text-neutral-400">
			{{ message.role === 'assistant' ? (message.model ?? 'Assistant') : 'You' }}
		</p>

		<p v-if="message.status === 'error'" class="text-red-700 dark:text-red-400">
			{{ message.error }}
		</p>

		<!--
			Only assistant output goes through the markdown renderer. User input
			is rendered as text: there is no reason to parse markup a user typed
			into their own prompt back into the page.

			`html` is null until the renderer chunk loads, so the raw text shows
			in the meantime instead of an empty bubble.
		-->
		<div
			v-else-if="message.role === 'assistant' && html !== null"
			class="markdown-body"
			v-html="html"
			@click="onClick"
		></div>

		<p v-else class="whitespace-pre-wrap">{{ message.content }}</p>

		<span
			v-if="message.status === 'streaming' && !message.content"
			class="text-neutral-600 dark:text-neutral-400"
			aria-live="polite"
		>
			…
		</span>
	</article>
</template>
