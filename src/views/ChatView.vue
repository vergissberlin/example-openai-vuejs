<script setup lang="ts">
	import ChatInput from '../components/ChatInput.vue'
	import { ref } from 'vue'

	// Refs
	const question = ref('')
	const disabled = ref(false)
	const chats = ref([])

	const url = 'https://vgbln-openai.herokuapp.com' || 'http://localhost:3000'

	// Methods
	const askAi = async (): Promise<void> => {
		// Disable input field
		disabled.value = true

		// URL encode question
		const questionEncoded = encodeURIComponent(question.value)
		chats.value.push(question.value)
		// fetch get request with question as parameter and json response  to localhost 3000 with question
		// set chats to response
		await fetch(`${url}/?question=${questionEncoded}`)
			.then((response) => response.json())
			.then((data) => {
				console.log('Success:', data)
				// Push new answer to chats array
				chats.value.push(data.text)

				// Reset question
				disabled.value = false
				question.value = ''

				// Set focus to input field
				document.querySelector('input').focus()
			})
			.catch((error) => {
				console.error('Error:', error)
			})
	}
</script>

<template>
	<main>
		<ul class="message">
			<li v-for="chat in chats" :key="chat">{{ chat }}</li>
		</ul>
	</main>
	<footer>
		<div class="chats-input">
			<input
				class="chats-input"
				type="text"
				placeholder="Ask me something"
				v-model="question"
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
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3em;
		margin: 1rem 0;
	}

	.chats-input input {
		width: 30vw;
	}

	.chats-input input,
	.chats-input button {
		padding: 1em 1.2em;
		border-radius: 0.2em;
		border: 0;
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
