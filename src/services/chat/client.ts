import type { Message } from '../../types/chat'
import { ChatError, fromStatus, fromUnknown } from './errors'
import { parseSse } from './sse'

/**
 * One client, two wire protocols.
 *
 * `openai` is the real thing: POST /v1/chat/completions with `stream: true`,
 * which gives token-by-token output and multi-turn history. It works against
 * our own backend and against any other OpenAI-compatible endpoint (Ollama,
 * LM Studio, OpenAI itself) — the only difference is whether an Authorization
 * header is sent.
 *
 * `legacy` wraps the demo backend's `GET /text/?prompt=`, which takes a single
 * prompt and answers in one shot. It yields that answer as a single chunk, so
 * callers never branch on which backend is in use. Multi-turn is emulated by
 * flattening the conversation into the prompt, which is lossy and bounded by
 * the maximum url length — the reason the backend is being rebuilt.
 */
export type Protocol = 'openai' | 'legacy'

export interface ChatRequest {
	messages: Message[]
	model: string
	temperature: number
	topP: number
	maxTokens: number | null
	signal: AbortSignal
}

export interface ChatConnection {
	baseUrl: string
	apiKey?: string
	protocol: Protocol
}

export interface ModelInfo {
	id: string
}

function authHeaders(apiKey?: string): Record<string, string> {
	return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

export async function* streamChat(
	connection: ChatConnection,
	request: ChatRequest
): AsyncGenerator<string> {
	if (connection.protocol === 'legacy') {
		yield* streamLegacy(connection, request)
		return
	}
	yield* streamOpenAi(connection, request)
}

async function* streamOpenAi(
	connection: ChatConnection,
	request: ChatRequest
): AsyncGenerator<string> {
	let response: Response
	try {
		response = await fetch(`${connection.baseUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...authHeaders(connection.apiKey) },
			body: JSON.stringify({
				model: request.model,
				stream: true,
				temperature: request.temperature,
				top_p: request.topP,
				...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
				messages: request.messages.map((message) => ({
					role: message.role,
					content: message.content
				}))
			}),
			signal: request.signal
		})
	} catch (error) {
		throw fromUnknown(error)
	}

	if (!response.ok) {
		throw fromStatus(response.status, await readErrorDetail(response))
	}
	if (!response.body) {
		throw new ChatError('The server returned an empty response body.', 'server')
	}

	for await (const event of parseSse(response.body, request.signal)) {
		if (event.data === '[DONE]') return

		// A server that fails mid-stream cannot change the status code any
		// more, so it reports the failure inside the stream instead.
		if (event.event === 'error') {
			throw new ChatError(extractErrorMessage(event.data), 'server')
		}

		let payload: OpenAiChunk
		try {
			payload = JSON.parse(event.data) as OpenAiChunk
		} catch {
			// Ignore frames we cannot parse rather than killing the stream:
			// some gateways inject their own keep-alive payloads.
			continue
		}

		if (payload.error) {
			throw new ChatError(payload.error.message ?? 'The server reported an error.', 'server')
		}

		const delta = payload.choices?.[0]?.delta?.content
		if (delta) yield delta
	}
}

interface OpenAiChunk {
	choices?: Array<{ delta?: { content?: string } }>
	error?: { message?: string }
}

async function* streamLegacy(
	connection: ChatConnection,
	request: ChatRequest
): AsyncGenerator<string> {
	const prompt = flattenConversation(request.messages)

	let response: Response
	try {
		response = await fetch(
			`${connection.baseUrl}/text/?prompt=${encodeURIComponent(prompt)}`,
			{ signal: request.signal }
		)
	} catch (error) {
		throw fromUnknown(error)
	}

	if (!response.ok) {
		throw fromStatus(response.status, await readErrorDetail(response))
	}

	const data = (await response.json()) as { text?: string }
	// The demo backend prefixes answers with two newlines.
	const text = (data.text ?? '').replace(/^\n\n/, '')
	if (text) yield text
}

/**
 * Squashes a conversation into one prompt for the legacy endpoint.
 *
 * Lossy by nature: the backend has no notion of roles or turns, so this is a
 * best effort at giving it context.
 */
export function flattenConversation(messages: Message[]): string {
	const system = messages.filter((message) => message.role === 'system')
	const turns = messages.filter((message) => message.role !== 'system' && message.content)

	const lines = [
		...system.map((message) => message.content),
		...turns.map(
			(message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`
		)
	]

	// A single-turn conversation reads better without the role prefix.
	if (!system.length && turns.length === 1) return turns[0].content

	return [...lines, 'Assistant:'].join('\n')
}

export async function listModels(connection: ChatConnection): Promise<ModelInfo[]> {
	if (connection.protocol === 'legacy') return []

	try {
		const response = await fetch(`${connection.baseUrl}/v1/models`, {
			headers: authHeaders(connection.apiKey)
		})
		if (!response.ok) throw fromStatus(response.status)

		const payload = (await response.json()) as { data?: Array<{ id?: string }> }
		return (payload.data ?? [])
			.filter((entry): entry is { id: string } => typeof entry.id === 'string')
			.map((entry) => ({ id: entry.id }))
	} catch (error) {
		throw fromUnknown(error)
	}
}

/** Best-effort detail from an error body, without leaking a huge payload. */
async function readErrorDetail(response: Response): Promise<string | undefined> {
	try {
		const text = await response.text()
		if (!text) return undefined

		try {
			const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string }
			const message = parsed.error?.message ?? parsed.message
			if (message) return message.slice(0, 200)
		} catch {
			// Not JSON, fall through to the raw text.
		}

		return text.slice(0, 200)
	} catch {
		return undefined
	}
}

function extractErrorMessage(data: string): string {
	try {
		const parsed = JSON.parse(data) as { error?: { message?: string }; message?: string }
		return parsed.error?.message ?? parsed.message ?? 'The server reported an error.'
	} catch {
		return data.slice(0, 200) || 'The server reported an error.'
	}
}
