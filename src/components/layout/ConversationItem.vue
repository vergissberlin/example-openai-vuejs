<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Conversation } from '../../types/chat'

const props = defineProps<{ conversation: Conversation; active: boolean }>()
const emit = defineEmits<{
	rename: [id: string, title: string]
	remove: [id: string]
	togglePin: [id: string]
}>()

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)

async function startRename() {
	draft.value = props.conversation.title
	editing.value = true
	await nextTick()
	input.value?.select()
}

function commitRename() {
	if (!editing.value) return
	editing.value = false
	emit('rename', props.conversation.id, draft.value)
}
</script>

<template>
	<li class="group relative">
		<input
			v-if="editing"
			ref="input"
			v-model="draft"
			class="w-full px-3 py-2 text-sm bg-white border rounded-lg border-neutral-400 dark:bg-neutral-800 dark:border-neutral-600"
			:aria-label="`Rename ${conversation.title}`"
			@keyup.enter="commitRename"
			@keyup.escape="editing = false"
			@blur="commitRename"
		/>

		<RouterLink
			v-else
			:to="{ name: 'chat', params: { id: conversation.id } }"
			class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"
			:class="active ? 'bg-neutral-200 dark:bg-neutral-800 font-medium' : ''"
		>
			<span v-if="conversation.pinned" aria-label="Pinned" title="Pinned">📌</span>
			<span class="flex-1 truncate">{{ conversation.title }}</span>

			<!--
				Kept mounted rather than v-if'd so the buttons stay reachable by
				keyboard; opacity alone would hide them from sighted users only.
			-->
			<span
				class="flex gap-1 transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100"
			>
				<button
					type="button"
					class="px-1 hover:text-green-700 dark:hover:text-green-500"
					:aria-label="`${conversation.pinned ? 'Unpin' : 'Pin'} ${conversation.title}`"
					@click.prevent="emit('togglePin', conversation.id)"
				>
					📍
				</button>
				<button
					type="button"
					class="px-1 hover:text-green-700 dark:hover:text-green-500"
					:aria-label="`Rename ${conversation.title}`"
					@click.prevent="startRename"
				>
					✎
				</button>
				<button
					type="button"
					class="px-1 hover:text-red-700 dark:hover:text-red-500"
					:aria-label="`Delete ${conversation.title}`"
					@click.prevent="emit('remove', conversation.id)"
				>
					🗑
				</button>
			</span>
		</RouterLink>
	</li>
</template>
