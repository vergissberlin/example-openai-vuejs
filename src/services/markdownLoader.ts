/**
 * Lazy entry point for the markdown renderer.
 *
 * markdown-it, highlight.js and DOMPurify together are the largest thing this
 * app ships. Importing them statically put them in the entry chunk, so every
 * visitor paid for them before a single message existed. They are pulled in on
 * demand instead — in practice while the first response is in flight.
 */

type MarkdownModule = typeof import('./markdown')

let modulePromise: Promise<MarkdownModule> | null = null
let loaded: MarkdownModule | null = null

export function loadMarkdown(): Promise<MarkdownModule> {
	modulePromise ??= import('./markdown').then((module) => {
		loaded = module
		return module
	})
	return modulePromise
}

/**
 * Synchronous render, available once the module has loaded.
 *
 * Returns null before then so callers can fall back to plain text rather than
 * flashing empty content.
 */
export function renderIfLoaded(source: string): string | null {
	return loaded ? loaded.renderMarkdown(source) : null
}
