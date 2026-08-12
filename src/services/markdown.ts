import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'

import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

/**
 * Renders assistant output to HTML.
 *
 * Order matters: markdown-it produces HTML, highlight.js adds markup inside
 * code blocks, and DOMPurify is the last step before anything reaches the
 * DOM. Model output is untrusted — it can be steered by whatever the user
 * pastes in — so nothing here may skip the sanitiser.
 *
 * Language support is registered explicitly rather than importing
 * `highlight.js` wholesale, which would pull ~1MB of grammars into a bundle
 * served from GitHub Pages.
 */

const LANGUAGES = {
	bash,
	css,
	diff,
	go,
	java,
	javascript,
	json,
	markdown,
	python,
	rust,
	sql,
	typescript,
	xml,
	yaml
}

for (const [name, language] of Object.entries(LANGUAGES)) {
	hljs.registerLanguage(name, language)
}

// A few aliases people actually type in fences.
hljs.registerAliases(['js', 'jsx', 'mjs', 'cjs'], { languageName: 'javascript' })
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' })
hljs.registerAliases(['sh', 'shell', 'zsh', 'console'], { languageName: 'bash' })
hljs.registerAliases(['html', 'vue', 'svg'], { languageName: 'xml' })
hljs.registerAliases(['py'], { languageName: 'python' })
hljs.registerAliases(['yml'], { languageName: 'yaml' })

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

const md = new MarkdownIt({
	// Never enabled: raw HTML in model output is exactly the injection vector
	// the original `v-html` rendering exposed. DOMPurify is the safety net,
	// not the only line of defence.
	html: false,
	linkify: true,
	breaks: true
})

/**
 * Renders fenced code with a language label and a copy button.
 *
 * The button carries no handler — ChatMessage attaches a single delegated
 * listener instead of mounting a component per block.
 */
/*
 * markdown-it uses `export =`, so under `verbatimModuleSyntax` its namespaced
 * types are not importable. Deriving the signature from the instance is exact
 * and survives changes to how the package exports its types.
 */
type RendererRule = NonNullable<typeof md.renderer.rules.fence>

const renderFence: RendererRule = (tokens, index) => {
	const token = tokens[index]
	const language = token.info.trim().split(/\s+/)[0] || 'text'
	const known = hljs.getLanguage(language)

	const highlighted = known
		? hljs.highlight(token.content, { language, ignoreIllegals: true }).value
		: escapeHtml(token.content)

	return `<div class="code-block" data-language="${escapeHtml(language)}">
<div class="code-block__header"><span>${escapeHtml(language)}</span><button type="button" class="code-block__copy" data-copy aria-label="Copy code">Copy</button></div>
<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>
</div>`
}

md.renderer.rules.fence = renderFence

/*
 * Links from a model are untrusted, so they open in a new tab without handing
 * over a reference to this window.
 *
 * This runs as a sanitiser hook rather than a markdown-it renderer rule so it
 * applies to the final DOM — every anchor that survives sanitising gets the
 * attributes, whatever produced it.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (node.nodeName === 'A' && node instanceof Element) {
		node.setAttribute('target', '_blank')
		node.setAttribute('rel', 'noopener noreferrer nofollow')
	}
})

const PURIFY_CONFIG = {
	ALLOWED_TAGS: [
		'a', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'hr', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'del', 'button',
		'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul'
	],
	ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'class', 'data-copy', 'data-language', 'type', 'aria-label'],
	// Blocks `javascript:` and friends while still allowing images pasted as
	// data urls.
	ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpeg|gif|webp);|#|\/)/i
}

export function renderMarkdown(source: string): string {
	return DOMPurify.sanitize(md.render(source), PURIFY_CONFIG)
}

/** Exposed for tests and for rendering short, inline snippets. */
export function renderInline(source: string): string {
	return DOMPurify.sanitize(md.renderInline(source), PURIFY_CONFIG)
}
