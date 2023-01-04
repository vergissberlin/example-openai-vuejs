<script setup lang="ts">
	import LoadingIndicator from '../components/LoadingIndicator.vue'
	import { ref, nextTick, onMounted } from 'vue'
	import type { Ref } from 'vue'

	// Interfaces
	interface Result {
		id: number
		prompt?: string | number | symbol | undefined
		image?: string
	}

	// Refs
	const prompt: Ref<string> = ref('')
	const disabled: Ref<boolean> = ref(false)
	const results: Ref<Array<Result>> = ref([])
	const url = 'https://vgbln-openai.herokuapp.com' || 'http://localhost:3000'
	const messagesElement = ref<HTMLDivElement | null>(null)
	const promptElement = ref<HTMLDivElement | null>(null)

	onMounted(async () => {
		await nextTick()
		const div = messagesElement.value!.lastElementChild as HTMLDivElement
		// div.scrollIntoView().catch(() => {})
	})

	// Methods
	const askAi = async (): Promise<void> => {
		// Dieses wunderschöne und intelligente Mädchen mit den grünen Haaren und der Lederjacke vom Gymnasium!

		// Disable input field
		disabled.value = true

		// URL encode prompt
		const promptEncoded = encodeURIComponent(prompt.value)
		// fetch get request with prompt as parameter and json response  to localhost 3000 with prompt
		// Set results to response
		await fetch(`${url}/image/?prompt=${promptEncoded}`)
			.then((response) => response.json())
			.then((data) => {
				console.log('Success:', data)

				// Push new answer to results array
				results.value.push({
					id: results.value.length,
					prompt: prompt.value,
					image: data.image
				})

				// Scroll to bottom of the page
				const div = promptElement.value as HTMLDivElement
				div.scrollIntoView()

				// Reset prompt
				disabled.value = false
				prompt.value = ''
			})
			.catch((error) => {
				console.error('Error:', error)
			})
	}
</script>

<template>
	<main>
		<LoadingIndicator v-if="disabled" />
		<ul class="" ref="messagesElement">
			<li
				v-for="result in results"
				:key="result.prompt"
				class="px-12 py-3 even:bg-neutral-300 dark:even:bg-neutral-700 leading-0"
			>
				<picture>
					<img :src="result.image" />
					<figcaption>{{ result.prompt }}</figcaption>
				</picture>
			</li>
		</ul>
	</main>

	<footer class="w-screen px-12 py-4">
		<div ref="promptElement">
			<input
				type="text"
				class="w-full px-6 py-4 text-sm bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
				placeholder="Describe your image. Use your phantasie!"
				v-model="prompt"
				:disabled="disabled"
				autofocus
				@keyup.enter="askAi()"
			/>
		</div>
	</footer>
</template>
