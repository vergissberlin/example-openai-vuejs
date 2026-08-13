import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import { useConversationsStore } from '../stores/conversations'

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			// Entry point: resume the most relevant chat, or start a new one.
			path: '/',
			name: 'home',
			redirect: () => {
				const conversations = useConversationsStore()
				const target =
					conversations.active ?? conversations.ordered[0] ?? conversations.create()
				conversations.setActive(target.id)
				return { name: 'chat', params: { id: target.id } }
			}
		},
		{
			path: '/c/:id',
			name: 'chat',
			component: ChatView,
			props: true
		},
		{
			path: '/image',
			name: 'images',
			component: () => import('../views/ImageView.vue')
		},
		{
			path: '/about',
			name: 'about',
			component: () => import('../views/AboutView.vue')
		},
		{
			path: '/:pathMatch(.*)*',
			name: 'not-found',
			component: () => import('../views/NotFoundView.vue')
		}
	]
})

export default router
