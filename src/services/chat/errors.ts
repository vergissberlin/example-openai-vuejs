/**
 * Failure modes a chat request can hit, kept as a discriminant so the UI can
 * say something useful instead of surfacing a raw exception.
 */
export type ChatErrorKind = 'network' | 'auth' | 'rate_limit' | 'server' | 'bad_request' | 'aborted'

export class ChatError extends Error {
	constructor(
		message: string,
		readonly kind: ChatErrorKind,
		readonly status?: number
	) {
		super(message)
		this.name = 'ChatError'
	}
}

/** Maps an HTTP status onto a message a user can act on. */
export function fromStatus(status: number, detail?: string): ChatError {
	const suffix = detail ? ` (${detail})` : ''

	if (status === 401 || status === 403) {
		return new ChatError(
			`The endpoint rejected the credentials${suffix}. Check the API key in settings.`,
			'auth',
			status
		)
	}
	if (status === 429) {
		return new ChatError(
			`Rate limited by the endpoint${suffix}. Wait a moment and try again.`,
			'rate_limit',
			status
		)
	}
	if (status >= 500) {
		return new ChatError(`The server failed with ${status}${suffix}.`, 'server', status)
	}
	return new ChatError(`The request was rejected with ${status}${suffix}.`, 'bad_request', status)
}

/** Normalises anything thrown by fetch or the stream reader. */
export function fromUnknown(error: unknown): ChatError {
	if (error instanceof ChatError) return error

	if (error instanceof DOMException && error.name === 'AbortError') {
		return new ChatError('Generation stopped.', 'aborted')
	}

	// fetch rejects with a TypeError for DNS failures, refused connections and
	// CORS rejections alike; the browser deliberately does not say which.
	return new ChatError(
		'Could not reach the server. Check the connection settings and that the backend allows this origin.',
		'network'
	)
}
