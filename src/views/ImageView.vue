<script setup lang="ts">
	import LoadingIndicator from '../components/LoadingIndicator.vue'
	import { ref, nextTick, onMounted } from 'vue'
	import type { Ref } from 'vue'

	// Refs
	const prompt: Ref<string> = ref('')
	const disabled: Ref<boolean> = ref(false)
	const results: Ref<Array<string>> = ref([])
	const prompts: Ref<Array<string>> = ref([])
	const url = 'https://vgbln-openai.herokuapp.com' || 'http://localhost:3000'

	const messagesElement = ref<HTMLDivElement | null>(null)
	const promptElement = ref<HTMLDivElement | null>(null)

	onMounted(async () => {
		await nextTick()
		const div = messagesElement.value!.lastElementChild as HTMLDivElement
		//div.scrollIntoView().catch(() => {})
	})

	// Methods
	const askAi = async (): Promise<void> => {
		// Disable input field
		disabled.value = true

		// URL encode prompt
		const promptEncoded = encodeURIComponent(prompt.value)
		prompts.value.push(prompt.value)
		// fetch get request with prompt as parameter and json response  to localhost 3000 with prompt
		// Set results to response
		await fetch(`${url}/image/?prompt=${promptEncoded}`)
			.then((response) => response.json())
			.then((data) => {
				console.log('Success:', data)

				// Push new answer to results array
				results.value.push(data.image)

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
		<h2 class="container">Image generation</h2>
		<LoadingIndicator v-if="disabled" />
		<ul class="message">
			<li v-for="promptItem in prompts" :key="promptItem">{{ promptItem }}</li>
		</ul>
		<ul class="message" ref="messagesElement">
			<li v-for="result in results" :key="result"><img :src="result" /></li>
		</ul>
	</main>
	<footer>
		<div class="results-input" ref="promptElement">
			<input
				type="text"
				placeholder="Describe your image. Use your phantasie!"
				v-model="prompt"
				:disabled="disabled"
				autofocus
				@keyup.enter="askAi()"
			/>

			<button @click="askAi()">Send</button>
		</div>
	</footer>
</template>

<style>
	.message {
		list-style: none;
		padding: 0;
		margin: 0;
		color: rgb(210, 219, 231, 0.8);
	}
	.message li {
		margin: 0;
		padding: 1rem var(--container-padding-horizontal);
	}
	.message li:nth-child(even) {
		background: #222;
	}

	.results-input {
		display: grid;
		grid-direction: column;
		grid-template-columns: 1fr auto;
		gap: 0;
		margin: 1rem var(--container-padding-horizontal);
	}

	.results-input input,
	.results-input button {
		padding: 1em 1.2em;
		border-radius: 0.3em;
		border: 0;
	}
	.results-input input {
		border-bottom-right-radius: 0;
		border-top-right-radius: 0;
	}
	.results-input button {
		border-bottom-left-radius: 0;
		border-top-left-radius: 0;
	}

	@media (prefers-color-scheme: dark) {
		body {
			background: #111;
			color: rgb(174, 201, 201);
		}
		button,
		input {
			background: #333;
			color: rgb(174, 201, 201);
			border-color: #222;
			outline: #222;
		}
	}
</style>
