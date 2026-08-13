import { describe, it, expect, beforeAll } from 'vitest'
import { renderMarkdown, renderInline, enableMath } from '../markdown'

describe('markdown rendering', () => {
	it('renders basic markdown', () => {
		const html = renderMarkdown('# Title\n\nSome **bold** and *italic* text.')

		expect(html).toContain('<h1>Title</h1>')
		expect(html).toContain('<strong>bold</strong>')
		expect(html).toContain('<em>italic</em>')
	})

	it('renders lists and tables', () => {
		expect(renderMarkdown('- one\n- two')).toContain('<li>one</li>')
		expect(renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')).toContain('<table>')
	})

	it('highlights fenced code and adds a copy button', () => {
		const html = renderMarkdown('```ts\nconst answer: number = 42\n```')

		expect(html).toContain('data-language="ts"')
		expect(html).toContain('data-copy')
		// hljs wraps tokens in spans; if it did not run, there would be none.
		expect(html).toContain('<span class="hljs-')
	})

	it('escapes code content instead of interpreting it', () => {
		const html = renderMarkdown('```\n<script>alert(1)</script>\n```')

		expect(html).not.toContain('<script>')
		expect(html).toContain('&lt;script&gt;')
	})

	it('falls back to plain escaped text for unknown languages', () => {
		const html = renderMarkdown('```not-a-language\n<b>x</b>\n```')

		expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
	})

	it('opens links in a new tab without leaking the opener', () => {
		const html = renderMarkdown('[example](https://example.com)')

		expect(html).toContain('target="_blank"')
		expect(html).toContain('rel="noopener noreferrer nofollow"')
	})
})

describe('maths', () => {
	// Maths is registered on demand — KaTeX plus its stylesheet and fonts are
	// larger than the rest of the renderer, and most conversations have none.
	beforeAll(async () => {
		await enableMath()
	})

	it('renders an inline formula', () => {
		const html = renderMarkdown('Einstein wrote $E = mc^2$ in 1905.')

		expect(html).toContain('katex')
		expect(html).toContain('<math')
		// The surrounding prose survives intact.
		expect(html).toContain('in 1905.')
	})

	it('renders a display formula', () => {
		const html = renderMarkdown('$$\n\\frac{a}{b}\n$$')

		expect(html).toContain('katex')
		expect(html).toContain('mfrac')
	})

	it('keeps the MathML that screen readers use', () => {
		const host = document.createElement('div')
		host.innerHTML = renderMarkdown('$x^2$')

		// A visual-only rendering would leave nothing here.
		expect(host.querySelector('math')).not.toBeNull()
		expect(host.querySelector('annotation')?.textContent).toContain('x^2')
	})

	/*
	 * The cases a hand-written delimiter parser gets wrong, which is why this
	 * uses a maintained plugin.
	 */
	it('leaves an escaped dollar sign as text', () => {
		const html = renderMarkdown('It costs \\$5.')

		expect(html).not.toContain('katex')
		expect(html).toContain('$5')
	})

	it('leaves dollar signs inside a code span alone', () => {
		const host = document.createElement('div')
		host.innerHTML = renderMarkdown('Run `echo $HOME` first.')

		expect(host.querySelector('code')?.textContent).toBe('echo $HOME')
		expect(host.innerHTML).not.toContain('katex')
	})

	it('leaves dollar signs inside a fenced block alone', () => {
		const html = renderMarkdown('```bash\nexport A=$B\necho $A\n```')

		expect(html).not.toContain('katex')
		expect(html).toContain('code-block')
	})

	it('renders invalid latex as visible text instead of throwing', () => {
		expect(() => renderMarkdown('$\\frac{1}{$')).not.toThrow()
	})
})

/*
 * The reason this module exists. Model output is untrusted — it echoes back
 * whatever a user pastes in — and the original code rendered it straight
 * through `v-html`.
 *
 * These assertions parse the output and inspect the resulting DOM rather than
 * searching the string. Escaped text such as `&lt;img onerror=...&gt;` still
 * *contains* "onerror" while being completely inert, so a substring check
 * would fail on safe output — and, worse, pass on markup that merely spells
 * the payload differently.
 */
function parse(html: string): HTMLElement {
	const host = document.createElement('div')
	host.innerHTML = html
	return host
}

function dangerousElements(host: HTMLElement): string[] {
	return [...host.querySelectorAll('script, iframe, object, embed, style, form, input')].map(
		(element) => element.tagName.toLowerCase()
	)
}

function eventHandlerAttributes(host: HTMLElement): string[] {
	return [...host.querySelectorAll('*')].flatMap((element) =>
		[...element.attributes]
			.map((attribute) => attribute.name)
			.filter((name) => name.toLowerCase().startsWith('on'))
	)
}

function scriptUrls(host: HTMLElement): string[] {
	return [...host.querySelectorAll('[href], [src]')]
		.flatMap((element) => [
			element.getAttribute('href') ?? '',
			element.getAttribute('src') ?? ''
		])
		.filter((value) => /^\s*(javascript|vbscript|data:text\/html)/i.test(value))
}

describe('sanitising', () => {
	const payloads: Array<[string, string]> = [
		['script tag', '<script>window.__pwned = 1</script>'],
		['img onerror', '<img src="x" onerror="window.__pwned = 1">'],
		['svg onload', '<svg onload="window.__pwned = 1"></svg>'],
		['iframe', '<iframe src="https://evil.test"></iframe>'],
		['body onload', '<body onload="window.__pwned = 1">'],
		['style tag', '<style>body { display: none }</style>'],
		['form with action', '<form action="https://evil.test"><input name="a"></form>'],
		['object tag', '<object data="https://evil.test"></object>'],
		['nested obfuscation', '<img src=x onerror=alert(1)//>'],
		['case-mixed script', '<ScRiPt>window.__pwned = 1</ScRiPt>']
	]

	it.each(payloads)('renders %s inert', (_name, payload) => {
		const host = parse(renderMarkdown(payload))

		expect(dangerousElements(host)).toEqual([])
		expect(eventHandlerAttributes(host)).toEqual([])
		expect(scriptUrls(host)).toEqual([])
	})

	it('drops javascript: urls from links', () => {
		const host = parse(renderMarkdown('[click me](javascript:window.__pwned=1)'))

		expect(scriptUrls(host)).toEqual([])
		expect(host.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
	})

	it('drops javascript: urls from image sources', () => {
		const host = parse(renderMarkdown('![alt](javascript:window.__pwned=1)'))

		expect(scriptUrls(host)).toEqual([])
		expect(host.querySelectorAll('img')).toHaveLength(0)
	})

	it('keeps https and data-image urls usable', () => {
		expect(parse(renderMarkdown('[ok](https://example.com)')).querySelector('a')?.href).toBe(
			'https://example.com/'
		)
		expect(
			parse(renderMarkdown('![alt](data:image/png;base64,iVBORw0KGgo=)')).querySelector('img')
				?.src
		).toContain('data:image/png;base64')
	})

	/*
	 * `style` had to be allowed for KaTeX to position glyphs. It is only
	 * reachable from KaTeX's own output — the parser has raw HTML disabled, so
	 * a style attribute a model writes is escaped to text long before the
	 * sanitiser sees it.
	 */
	it('does not let a model inject a style attribute of its own', () => {
		const host = parse(
			renderMarkdown('<span style="background:url(javascript:alert(1))">x</span>')
		)

		expect(host.querySelectorAll('span[style]')).toHaveLength(0)
		expect(host.textContent).toContain('<span style=')
	})

	it('sanitises inline rendering too', () => {
		const host = parse(renderInline('<img src=x onerror=alert(1)>'))

		expect(eventHandlerAttributes(host)).toEqual([])
		expect(host.querySelectorAll('img')).toHaveLength(0)
	})
})
