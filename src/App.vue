<script setup lang="ts">
	import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
	<header class="px-12 py-12 bg-neutral-100 dark:bg-neutral-900">
		<h1 class="pb-3 text-3xl">Vue 3 + OpenAI</h1>
		<nav class="flex gap-4 flex-start">
			<RouterLink to="/" active-class="text-green-700 dark:text-green-500 " class="hover:underline">Chat</RouterLink>
			<RouterLink to="/image" active-class="text-green-700 dark:text-green-500" class="hover:underline"
				>Image</RouterLink
			>
			<RouterLink to="/about" active-class="text-green-700 dark:text-green-500" class="hover:underline"
				>About</RouterLink
			>
		</nav>
	</header>

	<RouterView />
</template>
