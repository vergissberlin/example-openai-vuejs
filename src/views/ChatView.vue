<script setup lang="ts">
	import LoadingIndicator from '../components/LoadingIndicator.vue'
	import { ref, nextTick, onMounted } from 'vue'
	import type { Ref } from 'vue'

	// Refs
	const prompt: Ref<string> = ref('')
	const disabled: Ref<boolean> = ref(false)
	const chats: Ref<Array<string>> = ref([])
	const url = 'https://vgbln-openai.herokuapp.com' || 'http://localhost:3000'
	const configTemplate: Ref<string> = ref('marvin')
	const messagesElement = ref<HTMLDivElement | null>(null)
	const promptElement = ref<HTMLDivElement | null>(null)

	const promptTemplates = {
		joda: 'Talk like Joda: ',
		gpt3: 'Talk like GPT-3: ',
		steve: 'Talk like Steve Jobs. Very polite and push people forward: ',
		elon: 'Talk like Elon Musk: ',
		trump: 'Talk like Donald Trump: ',
		marvin: 'Talk like Marvin the Paranoid Android: '
	}

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
		const promptEncoded = encodeURIComponent(promptTemplates[configTemplate.value] + prompt.value)
		chats.value.push(prompt.value)
		// fetch get request with prompt as parameter and json response  to localhost 3000 with prompt
		// Set chats to response
		await fetch(`${url}/text/?prompt=${promptEncoded}`)
			.then((response) => response.json())
			.then((data) => {
				console.log('Success:', data)
				// remove the 2 new lines at the beginning of the answer
				data.text = data.text.replace(/^\n\n/, '')

				// replace new line with br
				data.text = data.text.replace(/\n/g, '<br />')

				// Push new answer to chats array
				chats.value.push(data.text)

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
	<main class="ov-scroll">
		<h2 class="container">Chat with AI</h2>
		<LoadingIndicator v-if="disabled" />
		<ul class="message" ref="messagesElement">
			<li v-for="chat in chats" :key="chat" v-html="chat"></li>
		</ul>
	</main>
	<footer>
		<div class="chats-input" ref="promptElement">
			<input
				type="text"
				placeholder="Ask me something"
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

	.chats-input {
		display: grid;
		grid-direction: column;
		grid-template-columns: 1fr auto;
		gap: 0;
		margin: 1rem var(--container-padding-horizontal);
	}

	.chats-input input,
	.chats-input button {
		padding: 1em 1.2em;
		border-radius: 0.3em;
		border: 0;
	}
	.chats-input input {
		border-bottom-right-radius: 0;
		border-top-right-radius: 0;
	}
	.chats-input button {
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
