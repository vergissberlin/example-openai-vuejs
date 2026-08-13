/**
 * Lazy entry point for the markdown renderer.
 *
 * markdown-it, highlight.js and DOMPurify together are the largest thing this
 * app ships. Importing them statically put them in the entry chunk, so every
 * visitor paid for them before a single message existed. They are pulled in on
 * demand instead — in practice while the first response is in flight.
 *
 * Maths support is a second, separate step for the same reason: KaTeX plus its
 * stylesheet and fonts are larger than everything else here combined, and most
 * conversations never contain a formula.
 */

type MarkdownModule = typeof import('./markdown')

let modulePromise: Promise<MarkdownModule> | null = null
let loaded: MarkdownModule | null = null

/**
 * Cheap pre-check for whether a message might contain maths.
 *
 * Deliberately loose — it only decides whether to fetch KaTeX, and the plugin
 * makes the real call about what is a formula. A false positive costs one
 * unnecessary download; a false negative would leave `$x$` on screen as raw
 * text, so this errs towards loading.
 */
const MATH_HINT = /\$/

let mathEnabled = false

/**
 * Whether `renderIfLoaded` would already produce the final output for this
 * source, maths included.
 *
 * Lets callers skip `prepare` once there is nothing left to fetch. Without it,
 * a streaming message calls `prepare` for every token it receives.
 */
export function isReady(source: string): boolean {
	if (!loaded) return false
	return mathEnabled || !MATH_HINT.test(source)
}

export function loadMarkdown(): Promise<MarkdownModule> {
	modulePromise ??= import('./markdown').then((module) => {
		loaded = module
		return module
	})
	return modulePromise
}

/**
 * Loads everything needed to render `source`, maths included.
 *
 * Resolves once a subsequent `renderIfLoaded(source)` will produce the final
 * output rather than a version missing formulas.
 */
export async function prepare(source: string): Promise<void> {
	const module = await loadMarkdown()
	if (MATH_HINT.test(source) && !mathEnabled) {
		try {
			await module.enableMath()
			mathEnabled = true
		} catch (error) {
			// Not fatal — the message still renders, with the formula left as
			// source text. Logged rather than swallowed: a silent catch here
			// once hid a module-interop bug that made every formula vanish
			// while the unit tests stayed green.
			console.error('Maths rendering unavailable:', error)
		}
	}
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
