<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useConversationsStore } from '../../stores/conversations'
import ConversationItem from './ConversationItem.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; openSettings: [] }>()

const conversations = useConversationsStore()
const router = useRouter()

const query = ref('')
const results = computed(() => conversations.search(query.value))

function newChat() {
	const conversation = conversations.create()
	router.push({ name: 'chat', params: { id: conversation.id } })
	emit('close')
}

function remove(id: string) {
	conversations.remove(id)

	// The store already picked the next chat; follow it so the view never
	// points at something that no longer exists.
	const next = conversations.activeId
	router.push(next ? { name: 'chat', params: { id: next } } : { name: 'home' })
}
</script>

<template>
	<!-- Scrim: mobile only, closes the drawer on tap. -->
	<div
		v-if="open"
		class="fixed inset-0 z-30 bg-black/40 md:hidden"
		aria-hidden="true"
		@click="emit('close')"
	></div>

	<aside
		class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-neutral-100 border-neutral-300 transition-transform dark:bg-neutral-900 dark:border-neutral-700 md:static md:translate-x-0"
		:class="open ? 'translate-x-0' : '-translate-x-full'"
		aria-label="Conversations"
	>
		<div class="flex flex-col gap-3 p-3 border-b border-neutral-300 dark:border-neutral-700">
			<div class="flex items-center justify-between">
				<h1 class="text-lg font-semibold">Vue 3 + OpenAI</h1>
				<button
					type="button"
					class="px-2 py-1 text-sm rounded-lg md:hidden hover:bg-neutral-200 dark:hover:bg-neutral-800"
					aria-label="Close sidebar"
					@click="emit('close')"
				>
					✕
				</button>
			</div>

			<button
				type="button"
				class="px-3 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-600"
				@click="newChat"
			>
				+ New chat
			</button>

			<input
				v-model="query"
				type="search"
				placeholder="Search chats"
				aria-label="Search chats"
				class="px-3 py-2 text-sm bg-white border rounded-lg border-neutral-300 focus:outline-none focus:border-neutral-400 dark:bg-neutral-800 dark:border-neutral-700"
			/>
		</div>

		<nav class="flex-1 p-3 overflow-y-auto">
			<p
				v-if="!results.length"
				class="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400"
			>
				{{ query ? 'No chats match that search.' : 'No chats yet.' }}
			</p>

			<ul v-else class="flex flex-col gap-1">
				<ConversationItem
					v-for="conversation in results"
					:key="conversation.id"
					:conversation="conversation"
					:active="conversation.id === conversations.activeId"
					@rename="conversations.rename"
					@remove="remove"
					@toggle-pin="conversations.togglePin"
				/>
			</ul>
		</nav>

		<div
			class="flex flex-col gap-1 p-3 text-sm border-t border-neutral-300 dark:border-neutral-700"
		>
			<RouterLink
				to="/image"
				class="px-3 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"
				active-class="text-green-700 dark:text-green-500"
			>
				Images
			</RouterLink>
			<RouterLink
				to="/about"
				class="px-3 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"
				active-class="text-green-700 dark:text-green-500"
			>
				About
			</RouterLink>
			<button
				type="button"
				class="px-3 py-2 text-left rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"
				@click="emit('openSettings')"
			>
				Settings
			</button>
		</div>
	</aside>
</template>
