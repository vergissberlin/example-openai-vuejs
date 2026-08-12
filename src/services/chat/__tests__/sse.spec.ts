import { describe, it, expect } from 'vitest'
import { parseSse } from '../sse'

/** Builds a stream that delivers exactly the given chunks, in order. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder()
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
			controller.close()
		}
	})
}

/** Same, but splitting the payload at raw byte boundaries. */
function byteStreamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk)
			controller.close()
		}
	})
}

async function collect(stream: ReadableStream<Uint8Array>, signal?: AbortSignal) {
	const events = []
	for await (const event of parseSse(stream, signal)) events.push(event)
	return events
}

describe('parseSse', () => {
	it('parses a simple sequence of events', async () => {
		const events = await collect(streamOf(['data: one\n\ndata: two\n\n']))

		expect(events).toEqual([
			{ event: undefined, data: 'one' },
			{ event: undefined, data: 'two' }
		])
	})

	it('reassembles an event split across reads', async () => {
		// The boundary falls inside the word and inside the terminator.
		const events = await collect(streamOf(['data: hel', 'lo world\n', '\n']))

		expect(events).toEqual([{ event: undefined, data: 'hello world' }])
	})

	it('handles several events arriving in one read', async () => {
		const events = await collect(streamOf(['data: a\n\ndata: b\n\ndata: c\n\n']))

		expect(events.map((event) => event.data)).toEqual(['a', 'b', 'c'])
	})

	it('joins multiple data lines within one event', async () => {
		const events = await collect(streamOf(['data: first\ndata: second\n\n']))

		expect(events).toEqual([{ event: undefined, data: 'first\nsecond' }])
	})

	it('reads the event field', async () => {
		const events = await collect(streamOf(['event: error\ndata: {"message":"nope"}\n\n']))

		expect(events).toEqual([{ event: 'error', data: '{"message":"nope"}' }])
	})

	it('ignores comments and heartbeats', async () => {
		const events = await collect(streamOf([': ping\n\ndata: real\n\n']))

		expect(events).toEqual([{ event: undefined, data: 'real' }])
	})

	it('accepts CRLF line endings', async () => {
		const events = await collect(streamOf(['data: one\r\n\r\ndata: two\r\n\r\n']))

		expect(events.map((event) => event.data)).toEqual(['one', 'two'])
	})

	it('emits a trailing event that never got its blank line', async () => {
		const events = await collect(streamOf(['data: last']))

		expect(events).toEqual([{ event: undefined, data: 'last' }])
	})

	it('surfaces the [DONE] sentinel as an ordinary event', async () => {
		const events = await collect(streamOf(['data: {"x":1}\n\ndata: [DONE]\n\n']))

		expect(events.map((event) => event.data)).toEqual(['{"x":1}', '[DONE]'])
	})

	it('strips only the single optional space after the colon', async () => {
		const events = await collect(streamOf(['data:  two spaces\n\n']))

		expect(events[0].data).toBe(' two spaces')
	})

	it('survives a multi-byte character split across reads', async () => {
		// "ü" is two bytes in UTF-8; deliver them in separate reads.
		const full = new TextEncoder().encode('data: grü\n\n')
		const split = full.indexOf(0xc3) + 1

		const events = await collect(byteStreamOf([full.slice(0, split), full.slice(split)]))

		expect(events).toEqual([{ event: undefined, data: 'grü' }])
	})

	it('stops when the signal aborts', async () => {
		const controller = new AbortController()
		const encoder = new TextEncoder()

		const stream = new ReadableStream<Uint8Array>({
			start(streamController) {
				streamController.enqueue(encoder.encode('data: one\n\n'))
				// Never closes: only the abort ends this.
			}
		})

		const events = []
		for await (const event of parseSse(stream, controller.signal)) {
			events.push(event)
			controller.abort()
		}

		expect(events.map((event) => event.data)).toEqual(['one'])
	})
})
