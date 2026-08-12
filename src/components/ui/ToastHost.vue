<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useToastsStore } from '../../stores/toasts'

const toasts = useToastsStore()
const { items } = storeToRefs(toasts)

const styles: Record<string, string> = {
	info: 'bg-neutral-800 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900',
	success: 'bg-green-700 text-white',
	error: 'bg-red-700 text-white'
}
</script>

<template>
	<div
		class="fixed z-50 flex flex-col gap-2 -translate-x-1/2 bottom-4 left-1/2 w-[min(28rem,calc(100vw-2rem))]"
		role="status"
		aria-live="polite"
	>
		<div
			v-for="toast in items"
			:key="toast.id"
			class="flex items-start gap-3 px-4 py-3 text-sm rounded-lg shadow-lg"
			:class="styles[toast.kind]"
		>
			<span class="flex-1">{{ toast.message }}</span>
			<button
				type="button"
				class="opacity-70 hover:opacity-100"
				:aria-label="`Dismiss: ${toast.message}`"
				@click="toasts.dismiss(toast.id)"
			>
				✕
			</button>
		</div>
	</div>
</template>
