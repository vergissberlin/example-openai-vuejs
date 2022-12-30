<script setup lang="ts">
	import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
	<header>
		<h1>Vue 3 + OpenAI</h1>
		<nav>
			<RouterLink to="/">Chat</RouterLink>
			<RouterLink to="/about">About</RouterLink>
		</nav>
	</header>

	<RouterView />
</template>

<style>
	:root {
		--color-primary: #007bff;
		--color-primary-light: #057bff;
		--color-primary-dark: #006bff;
		--color-secondary: #6c757d;
		--color-secondary-light: #7c858d;
		--color-secondary-dark: #5c656d;
		--color-success: #28a745;
		--color-success-light: #38b745;
		--color-success-dark: #18a745;
		--color-danger: #dc3545;
		--color-danger-light: #ec3545;
		--color-danger-dark: #cc3545;
		--color-warning: #ffc107;
		--color-warning-light: #ffc107;
		--color-warning-dark: #ffc107;
		--container-padding-horizontal: 30vw;
	}
	html,
	body {
		min-height: 100%;
		color: #111;
		font-family: 'Helvetica Neue', sans-serif;
		margin: 0 auto;
	}
	.container {
		margin: 1rem var(--container-padding-horizontal);
	}

	#app {
		height: 100vh;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr auto;
		grid-template-areas:
			'header'
			'main'
			'footer';
	}

	#app > header {
		grid-area: header;
		padding: 1rem var(--container-padding-horizontal);
		background: #222;
		border-bottom: #444 1px solid;
	}

	#app > main {
		grid-area: main;
		padding: 15px 5px 10px 5px;
		max-width: 2fr;
	}

	#app > footer {
		grid-area: footer;
		background: #222;
		border-top: #444 1px solid;
	}

	nav {
		display: flex;
		align-items: left;
		justify-content: left;
		gap: 1rem;
		margin: 1rem 0;
	}

	nav a {
		padding: 0.2em 1.5em;
		border-radius: 0.15em;
		background-color: rgb(16, 163, 127);
		text-decoration: none;
		color: #ffffff99;
	}

	nav a:hover {
		background-color: rgb(16, 163, 127, 0.8);
		color: #ffffffaa;
	}

	@media (prefers-color-scheme: dark) {
		body {
			background: rgb(52, 53, 65);
			color: rgb(174, 201, 201);
		}
	}
</style>
