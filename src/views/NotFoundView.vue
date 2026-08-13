<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
	<main class="flex flex-col items-center justify-center flex-1 gap-4 p-12 text-center">
		<p class="text-5xl font-semibold text-neutral-400 dark:text-neutral-600">404</p>
		<h2 class="text-2xl">This page does not exist</h2>
		<RouterLink to="/" class="text-green-700 underline dark:text-green-500 hover:no-underline">
			Back to the chat
		</RouterLink>
	</main>
</template>
