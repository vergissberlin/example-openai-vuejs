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

	// Type for prompt templates
	type PromptTemplates = 'joda' | 'gpt3' | 'steve' | 'elon' | 'trump' | 'marvin'

	const promptTemplates = {
		joda: 'Write like Joda: ',
		gpt3: 'Write like GPT-3: ',
		steve: 'Write like Steve Jobs. Very polite and push people forward: ',
		elon: 'Write like Elon Musk: ',
		marvin: 'Write like Marvin the Paranoid Android: '
	} as Record<PromptTemplates, string>

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
		// @ts-ignore
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
	<main class="py-12 mb-auto">
		<LoadingIndicator v-if="disabled" />
		<ul ref="messagesElement">
			<li
				v-for="chat in chats"
				:key="chat"
				v-html="chat"
				class="px-12 py-3 even:bg-neutral-300 dark:even:bg-neutral-700 leading-0"
			></li>
		</ul>
	</main>
	<footer class="px-12 py-4 w-screen">
		<div ref="promptElement">
			<input
				type="text"
				placeholder="Ask me something"
				v-model="prompt"
				class="w-full border-2 border-gray-300 bg-white px-6 py-4 rounded-lg text-sm focus:outline-none focus:border-gray-400 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
				:disabled="disabled"
				autofocus
				@keyup.enter="askAi()"
			/>
		</div>
	</footer>
</template>
