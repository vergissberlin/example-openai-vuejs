import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/** Fallback for local development, where nothing sets the variable. */
const DEV_PUBLIC_URL = 'http://localhost:5173'

/**
 * Asks the plugin to leave the placeholder alone.
 *
 * The published container image is configured when it starts, not when it is
 * built, so its build sets this and its entrypoint does the substitution. See
 * docker/40-runtime-config.sh.
 */
const RUNTIME_SENTINEL = 'runtime'

/**
 * Substitutes `%PUBLIC_URL%` in index.html with the deployment's own address.
 *
 * The Open Graph tags need an absolute url, and hardcoding one means it is
 * wrong for every environment but the one it was written for — which is how it
 * ended up pointing at a GitHub Pages site that no longer exists.
 *
 * Done as a plugin rather than through vite's built-in `%VITE_*%` replacement
 * on purpose: that leaves the placeholder verbatim in the output when the
 * variable is unset, so a forgotten build argument ships `%VITE_PUBLIC_URL%`
 * as a url. Here an unset variable falls back to something valid instead.
 */
function publicUrl(): Plugin {
	return {
		name: 'public-url',
		transformIndexHtml: {
			order: 'pre',
			handler(html) {
				const configured = process.env.VITE_PUBLIC_URL
				if (configured === RUNTIME_SENTINEL) return html

				const url = (configured || DEV_PUBLIC_URL).replace(/\/+$/, '')
				return html.replaceAll('%PUBLIC_URL%', url)
			}
		}
	}
}

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue(), tailwindcss(), publicUrl()],
	// '/' for the container, which owns the root of its domain. GitHub Pages
	// serves a project site from /<repo>/ instead, so its workflow passes the
	// subpath in — taken from actions/configure-pages rather than hardcoded,
	// because that value is also what a custom domain changes.
	base: process.env.VITE_BASE || '/',
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	}
})
