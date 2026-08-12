/**
 * Server-sent-event parsing over `fetch`.
 *
 * `EventSource` cannot be used here: it only issues GET requests and cannot
 * set an Authorization header, both of which a chat completions call needs.
 * So the body is read as a stream and framed by hand.
 *
 * The parser has to tolerate arbitrary chunk boundaries — a single read can
 * deliver half an event, several events at once, or split a multi-byte
 * character down the middle. `TextDecoder` with `stream: true` handles the
 * last case; the line buffer handles the others.
 */

export interface SseEvent {
	/** The `event:` field, absent for the default message type. */
	event?: string
	data: string
}

export async function* parseSse(
	body: ReadableStream<Uint8Array>,
	signal?: AbortSignal
): AsyncGenerator<SseEvent> {
	const reader = body.getReader()
	const decoder = new TextDecoder()
	let buffer = ''

	// Reading does not observe the signal by itself, so cancel explicitly to
	// release the connection instead of leaving it draining in the background.
	const onAbort = () => void reader.cancel().catch(() => {})
	signal?.addEventListener('abort', onAbort, { once: true })

	try {
		for (;;) {
			const { done, value } = await reader.read()
			if (done) break

			buffer += decoder.decode(value, { stream: true })

			// Events are separated by a blank line. Normalise CRLF first:
			// some proxies rewrite line endings.
			buffer = buffer.replace(/\r\n/g, '\n')

			let separator = buffer.indexOf('\n\n')
			while (separator !== -1) {
				const raw = buffer.slice(0, separator)
				buffer = buffer.slice(separator + 2)

				const parsed = parseEvent(raw)
				if (parsed) yield parsed

				separator = buffer.indexOf('\n\n')
			}
		}

		// A final event without its trailing blank line still counts.
		const trailing = parseEvent(buffer.replace(/\r\n/g, '\n'))
		if (trailing) yield trailing
	} finally {
		signal?.removeEventListener('abort', onAbort)
		reader.releaseLock()
	}
}

function parseEvent(raw: string): SseEvent | null {
	const lines = raw.split('\n')
	const dataLines: string[] = []
	let event: string | undefined

	for (const line of lines) {
		// Comments/heartbeats.
		if (!line || line.startsWith(':')) continue

		const colon = line.indexOf(':')
		const field = colon === -1 ? line : line.slice(0, colon)
		// A single optional space after the colon is part of the framing.
		const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')

		if (field === 'data') dataLines.push(value)
		else if (field === 'event') event = value
	}

	if (!dataLines.length) return null

	// Multiple data lines in one event join with newlines, per the spec.
	return { event, data: dataLines.join('\n') }
}
