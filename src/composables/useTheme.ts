import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../stores/settings'

/**
 * Applies the theme preference to the document root.
 *
 * Tailwind v4 declares the `dark` variant against `.dark` (see main.css),
 * so an explicit preference has to toggle that class. `system` removes it
 * again and lets the media query decide.
 */
export function useTheme() {
	const settings = useSettingsStore()
	const { theme } = storeToRefs(settings)

	const media = window.matchMedia?.('(prefers-color-scheme: dark)')

	function apply() {
		const dark = theme.value === 'dark' || (theme.value === 'system' && !!media?.matches)
		document.documentElement.classList.toggle('dark', dark)
	}

	watch(theme, apply, { immediate: true })

	// Only relevant while following the system, but harmless otherwise.
	media?.addEventListener('change', apply)

	return { theme, apply }
}
