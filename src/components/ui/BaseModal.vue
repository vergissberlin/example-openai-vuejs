<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

function onKeydown(event: KeyboardEvent) {
	if (props.open && event.key === 'Escape') emit('close')
}

watch(
	() => props.open,
	async (open) => {
		if (open) {
			previouslyFocused = document.activeElement as HTMLElement | null
			// Wait a tick so the panel exists before focusing it.
			await Promise.resolve()
			panel.value?.focus()
		} else {
			// Send focus back where it came from, rather than to <body>.
			previouslyFocused?.focus()
		}
	}
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
	<div
		v-if="open"
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		@click.self="emit('close')"
	>
		<div
			ref="panel"
			class="flex flex-col w-full max-w-2xl overflow-hidden bg-white rounded-xl shadow-xl max-h-[85vh] dark:bg-neutral-900"
			role="dialog"
			aria-modal="true"
			:aria-label="title"
			tabindex="-1"
		>
			<div
				class="flex items-center justify-between px-5 py-4 border-b border-neutral-300 dark:border-neutral-700"
			>
				<h2 class="text-lg font-semibold">{{ title }}</h2>
				<button
					type="button"
					class="px-2 py-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"
					aria-label="Close"
					@click="emit('close')"
				>
					✕
				</button>
			</div>

			<div class="flex-1 overflow-y-auto"><slot /></div>
		</div>
	</div>
</template>
