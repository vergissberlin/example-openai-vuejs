<script setup lang="ts">
import { ref } from 'vue'
import type { Ref } from 'vue'
import LoadingIndicator from '../components/LoadingIndicator.vue'
import { useSettingsStore } from '../stores/settings'
import { useToastsStore } from '../stores/toasts'

interface Result {
	id: string
	prompt: string
	image?: string
}

const settings = useSettingsStore()
const toasts = useToastsStore()

const prompt: Ref<string> = ref('')
const pending: Ref<boolean> = ref(false)
const results: Ref<Array<Result>> = ref([])
const bottom = ref<HTMLDivElement | null>(null)

const askAi = async (): Promise<void> => {
	const text = prompt.value.trim()
	if (!text || pending.value) return

	pending.value = true

	try {
		const query = encodeURIComponent(text)
		const response = await fetch(`${settings.resolveBaseUrl()}/image/?prompt=${query}`)

		if (!response.ok) {
			throw new Error(`The server responded with ${response.status}.`)
		}

		const data = (await response.json()) as { image?: string }
		results.value.push({ id: crypto.randomUUID(), prompt: text, image: data.image })
		prompt.value = ''
	} catch (error) {
		// Same bug as the chat view had: `disabled` was only reset on success,
		// so one failure locked the input until a reload — and the failure was
		// never shown to the user.
		toasts.error(error instanceof Error ? error.message : 'The request failed.')
	} finally {
		pending.value = false
		bottom.value?.scrollIntoView({ behavior: 'smooth' })
	}
}
</script>

<template>
	<div class="flex flex-col flex-1 min-h-0">
		<div class="flex-1 min-h-0 overflow-y-auto">
			<p
				v-if="!results.length"
				class="p-12 text-center text-neutral-500 dark:text-neutral-400"
			>
				Describe an image to generate one.
			</p>

			<ul>
				<li
					v-for="result in results"
					:key="result.id"
					class="px-6 py-4 even:bg-neutral-300 dark:even:bg-neutral-700 md:px-12"
				>
					<figure>
						<img :src="result.image" :alt="result.prompt" class="max-w-full" />
						<figcaption class="pt-2 text-sm">{{ result.prompt }}</figcaption>
					</figure>
				</li>
			</ul>

			<LoadingIndicator v-if="pending" />
			<div ref="bottom"></div>
		</div>

		<footer class="px-6 py-4 border-t border-neutral-300 md:px-12 dark:border-neutral-700">
			<input
				type="text"
				class="w-full px-6 py-4 text-sm bg-white border-2 rounded-lg border-neutral-300 focus:outline-none focus:border-neutral-400 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
				placeholder="Describe your image. Use your phantasie!"
				v-model="prompt"
				:disabled="pending"
				autofocus
				@keyup.enter="askAi()"
			/>
		</footer>
	</div>
</template>
