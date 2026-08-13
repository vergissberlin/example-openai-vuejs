<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Message } from '../../types/chat'
import { prepare, renderIfLoaded } from '../../services/markdownLoader'

const props = defineProps<{ message: Message; canRegenerate?: boolean }>()
const emit = defineEmits<{
	regenerate: [id: string]
	edit: [id: string]
	remove: [id: string]
}>()

const copyState = ref<'idle' | 'done' | 'failed'>('idle')

async function copyMessage() {
	try {
		await navigator.clipboard.writeText(props.message.content)
		copyState.value = 'done'
	} catch {
		copyState.value = 'failed'
	}
	setTimeout(() => {
		copyState.value = 'idle'
	}, 1500)
}

/**
 * Bumped whenever another piece of the renderer arrives, which re-runs the
 * computed below. A counter rather than a boolean because maths loads as a
 * second step after the base renderer.
 */
const rendererVersion = ref(0)

watch(
	() => props.message.content,
	(content) => {
		if (props.message.role !== 'assistant') return
		// Re-checked as content streams in: a formula may only appear halfway
		// through a response.
		prepare(content).then(() => {
			rendererVersion.value += 1
		})
	},
	{ immediate: true }
)

const html = computed(() => {
	if (props.message.role !== 'assistant') return ''
	// Read the counter so this recomputes when a chunk lands.
	void rendererVersion.value
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
		class="px-6 py-4 group md:px-12"
		:class="
			message.role === 'assistant' ? 'bg-neutral-300 dark:bg-neutral-700' : 'bg-transparent'
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

		<p v-if="message.status === 'aborted'" class="mt-1 text-xs text-neutral-500">
			Stopped before it finished.
		</p>

		<!--
			Hidden until hover or keyboard focus, but always in the DOM so the
			buttons stay reachable without a pointer.
		-->
		<div
			v-if="message.status !== 'streaming'"
			class="flex gap-3 mt-2 text-xs transition-opacity opacity-0 text-neutral-600 group-hover:opacity-100 focus-within:opacity-100 dark:text-neutral-400"
		>
			<button type="button" class="hover:underline" @click="copyMessage">
				{{
					copyState === 'done'
						? 'Copied'
						: copyState === 'failed'
							? 'Copy failed'
							: 'Copy'
				}}
			</button>
			<button
				v-if="message.role === 'user'"
				type="button"
				class="hover:underline"
				@click="emit('edit', message.id)"
			>
				Edit
			</button>
			<button
				v-if="message.role === 'assistant' && canRegenerate"
				type="button"
				class="hover:underline"
				@click="emit('regenerate', message.id)"
			>
				Regenerate
			</button>
			<button
				type="button"
				class="hover:underline hover:text-red-700 dark:hover:text-red-400"
				@click="emit('remove', message.id)"
			>
				Delete
			</button>
		</div>
	</article>
</template>
