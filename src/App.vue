<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
import SettingsModal from './components/settings/SettingsModal.vue'
import ToastHost from './components/ui/ToastHost.vue'
import { useTheme } from './composables/useTheme'
import { useConversationsStore } from './stores/conversations'

useTheme()

const router = useRouter()
const conversations = useConversationsStore()

const sidebarOpen = ref(false)
const settingsOpen = ref(false)

function onKeydown(event: KeyboardEvent) {
	if (!(event.metaKey || event.ctrlKey)) return

	if (event.key === 'k') {
		event.preventDefault()
		const conversation = conversations.create()
		router.push({ name: 'chat', params: { id: conversation.id } })
	} else if (event.key === ',') {
		event.preventDefault()
		settingsOpen.value = true
	}
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
	<div class="flex w-full h-full">
		<AppSidebar
			:open="sidebarOpen"
			@close="sidebarOpen = false"
			@open-settings="settingsOpen = true"
		/>

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

		<SettingsModal :open="settingsOpen" @close="settingsOpen = false" />
		<ToastHost />
	</div>
</template>
