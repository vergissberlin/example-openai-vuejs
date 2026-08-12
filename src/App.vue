<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
import ToastHost from './components/ui/ToastHost.vue'
import { useTheme } from './composables/useTheme'

useTheme()

const sidebarOpen = ref(false)
</script>

<template>
	<div class="flex w-full h-full">
		<AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" />

		<div class="flex flex-col flex-1 min-w-0">
			<header
				class="flex items-center gap-3 px-4 py-3 border-b border-neutral-300 md:hidden dark:border-neutral-700"
			>
				<button
					type="button"
					class="px-2 py-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"
					aria-label="Open sidebar"
					@click="sidebarOpen = true"
				>
					☰
				</button>
				<span class="font-medium">Vue 3 + OpenAI</span>
			</header>

			<RouterView />
		</div>

		<ToastHost />
	</div>
</template>
