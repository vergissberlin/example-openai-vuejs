import { describe, it, expect, vi, afterEach } from 'vitest'
import { streamChat, listModels, flattenConversation } from '../client'
import { ChatError } from '../errors'
import { createMessage } from '../../../types/chat'
import type { ChatConnection, ChatRequest } from '../client'

const OPENAI: ChatConnection = { baseUrl: 'https://api.test', protocol: 'openai' }
const LEGACY: ChatConnection = { baseUrl: 'https://demo.test', protocol: 'legacy' }

function request(overrides: Partial<ChatRequest> = {}): ChatRequest {
	return {
		messages: [createMessage('user', 'hello')],
		model: 'gpt-4o-mini',
		temperature: 0.7,
		topP: 1,
		maxTokens: null,
		signal: new AbortController().signal,
		...overrides
	}
}

function sseResponse(body: string, init: ResponseInit = {}) {
	return new Response(body, {
		status: 200,
		headers: { 'Content-Type': 'text/event-stream' },
		...init
	})
}

async function collect(generator: AsyncGenerator<string>) {
	const chunks: string[] = []
	for await (const chunk of generator) chunks.push(chunk)
	return chunks
}

function chunk(content: string) {
	return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('streamChat (openai protocol)', () => {
	it('yields the content deltas in order', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			sseResponse(`${chunk('Hel')}${chunk('lo')}${chunk('!')}data: [DONE]\n\n`)
		)

		expect(await collect(streamChat(OPENAI, request()))).toEqual(['Hel', 'lo', '!'])
	})

	it('stops at [DONE] and ignores anything after it', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			sseResponse(`${chunk('a')}data: [DONE]\n\n${chunk('ignored')}`)
		)

		expect(await collect(streamChat(OPENAI, request()))).toEqual(['a'])
	})

	it('skips frames that are not valid json rather than failing', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			sseResponse(`data: not-json\n\n${chunk('fine')}data: [DONE]\n\n`)
		)

		expect(await collect(streamChat(OPENAI, request()))).toEqual(['fine'])
	})

	it('throws when the server reports an error mid-stream', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			sseResponse(`${chunk('partial')}event: error\ndata: {"message":"upstream died"}\n\n`)
		)

		const generator = streamChat(OPENAI, request())
		expect(await generator.next()).toEqual({ value: 'partial', done: false })
		await expect(generator.next()).rejects.toThrow('upstream died')
	})

	it('throws on an error object inside a data frame', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			sseResponse(`data: {"error":{"message":"context length exceeded"}}\n\n`)
		)

		await expect(collect(streamChat(OPENAI, request()))).rejects.toThrow(
			'context length exceeded'
		)
	})

	it.each([
		[401, 'auth'],
		[403, 'auth'],
		[429, 'rate_limit'],
		[500, 'server'],
		[400, 'bad_request']
	])('maps status %i to the %s error kind', async (status, kind) => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status }))

		try {
			await collect(streamChat(OPENAI, request()))
			expect.unreachable('should have thrown')
		} catch (error) {
			expect(error).toBeInstanceOf(ChatError)
			expect((error as ChatError).kind).toBe(kind)
			expect((error as ChatError).status).toBe(status)
		}
	})

	it('reports an aborted request as such, not as a failure', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(
			new DOMException('The operation was aborted.', 'AbortError')
		)

		try {
			await collect(streamChat(OPENAI, request()))
			expect.unreachable('should have thrown')
		} catch (error) {
			expect((error as ChatError).kind).toBe('aborted')
		}
	})

	it('maps a fetch rejection to a network error', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

		try {
			await collect(streamChat(OPENAI, request()))
			expect.unreachable('should have thrown')
		} catch (error) {
			expect((error as ChatError).kind).toBe('network')
		}
	})

	it('sends the key only when one is configured', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(sseResponse('data: [DONE]\n\n'))

		await collect(streamChat(OPENAI, request()))
		expect(
			(fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization
		).toBeUndefined()

		await collect(streamChat({ ...OPENAI, apiKey: 'sk-test' }, request()))
		expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe(
			'Bearer sk-test'
		)
	})
})

describe('streamChat (legacy protocol)', () => {
	it('yields the whole answer as a single chunk', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ text: '\n\nOne shot.' }), { status: 200 })
		)

		expect(await collect(streamChat(LEGACY, request()))).toEqual(['One shot.'])
	})

	it('maps http failures the same way the streaming path does', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('down', { status: 503 }))

		try {
			await collect(streamChat(LEGACY, request()))
			expect.unreachable('should have thrown')
		} catch (error) {
			expect((error as ChatError).kind).toBe('server')
		}
	})
})

describe('flattenConversation', () => {
	it('passes a single turn through unchanged', () => {
		expect(flattenConversation([createMessage('user', 'just this')])).toBe('just this')
	})

	it('labels roles and invites the next turn for multi-turn history', () => {
		const flattened = flattenConversation([
			createMessage('user', 'first'),
			createMessage('assistant', 'reply'),
			createMessage('user', 'second')
		])

		expect(flattened).toBe('User: first\nAssistant: reply\nUser: second\nAssistant:')
	})

	it('puts the system prompt first, without a role label', () => {
		const flattened = flattenConversation([
			createMessage('system', 'Be terse.'),
			createMessage('user', 'hello')
		])

		expect(flattened).toBe('Be terse.\nUser: hello\nAssistant:')
	})

	it('skips empty messages, such as a reply still streaming', () => {
		const flattened = flattenConversation([
			createMessage('user', 'question'),
			createMessage('assistant', '')
		])

		expect(flattened).toBe('question')
	})
})

describe('listModels', () => {
	it('returns nothing for the legacy backend, which has no model list', async () => {
		expect(await listModels(LEGACY)).toEqual([])
	})

	it('maps the openai model list', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, {}] }), {
				status: 200
			})
		)

		expect(await listModels(OPENAI)).toEqual([{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }])
	})
})
