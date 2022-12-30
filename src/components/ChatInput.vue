<template>
	<div class="chat-input">
		<input class="chat-input" type="text" placeholder="Ask me something" autofocus />
		<button>Send</button>
	</div>
</template>

<style scoped>
	.chat-input {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3em;
		margin: 1rem 0;
	}
	.chat-input input,
	.chat-input button {
		padding: 0.4em 1.2em;
		border-radius: 0.2em;
		border: 1px solid;
		border-color: inherit;
	}
</style>
