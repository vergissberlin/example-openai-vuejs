import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue(), tailwindcss()],
	// No `base`: the app is served from the root of its own domain, so vite's
	// default of '/' is correct. It used to be '/example-openai-vuejs/' for
	// GitHub Pages, which served it from a subpath.
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	}
})
