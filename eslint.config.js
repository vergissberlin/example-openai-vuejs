import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
	{
		name: 'app/files-to-lint',
		files: ['**/*.{ts,mts,tsx,vue,js,mjs}']
	},
	{
		name: 'app/files-to-ignore',
		ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/playwright-report/**']
	},

	pluginVue.configs['flat/essential'],
	vueTsConfigs.recommended,

	// Must stay last: turns off every rule that would fight Prettier.
	skipFormatting
)
