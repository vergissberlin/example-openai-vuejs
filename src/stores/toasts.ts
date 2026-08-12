import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
	id: string
	kind: ToastKind
	message: string
}

/** How long a toast stays up. Errors persist until dismissed. */
const AUTO_DISMISS_MS = 5000

/**
 * User-visible status and failure messages.
 *
 * The original views only ever called `console.error`, so a failed request was
 * invisible to the user — and left the input permanently disabled.
 */
export const useToastsStore = defineStore('toasts', () => {
	const items = ref<Toast[]>([])
	const timers = new Map<string, ReturnType<typeof setTimeout>>()

	function dismiss(id: string) {
		const timer = timers.get(id)
		if (timer) {
			clearTimeout(timer)
			timers.delete(id)
		}
		items.value = items.value.filter((toast) => toast.id !== id)
	}

	function push(message: string, kind: ToastKind = 'info'): string {
		const id = crypto.randomUUID()
		items.value.push({ id, kind, message })

		// Errors are the ones worth reading, so they wait for the user.
		if (kind !== 'error') {
			timers.set(
				id,
				setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
			)
		}

		return id
	}

	const info = (message: string) => push(message, 'info')
	const success = (message: string) => push(message, 'success')
	const error = (message: string) => push(message, 'error')

	function clear() {
		timers.forEach((timer) => clearTimeout(timer))
		timers.clear()
		items.value = []
	}

	return { items, push, dismiss, info, success, error, clear }
})
