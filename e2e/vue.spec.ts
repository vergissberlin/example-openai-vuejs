import { test, expect } from '@playwright/test'

test('redirects the root url to a chat', async ({ page }) => {
	await page.goto('./')

	await expect(page).toHaveURL(/\/c\/[0-9a-f-]+$/)
	await expect(page.getByPlaceholder('Ask me something')).toBeVisible()
})

test('navigates between the routes from the sidebar', async ({ page }) => {
	await page.goto('./')

	await page.getByRole('link', { name: 'Images' }).click()
	await expect(page.getByPlaceholder('Describe your image. Use your phantasie!')).toBeVisible()

	await page.getByRole('link', { name: 'About' }).click()
	await expect(
		page.getByRole('heading', { name: 'Example project for an AI chat' })
	).toBeVisible()
})

test('creates chats and keeps them after a reload', async ({ page }) => {
	await page.route('**/text/**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ text: 'A stored answer.' })
		})
	)

	await page.goto('./')
	await page.getByPlaceholder('Ask me something').fill('Remember this')
	await page.getByPlaceholder('Ask me something').press('Enter')

	await expect(page.getByText('A stored answer.')).toBeVisible()
	// The chat is titled from its first message.
	await expect(page.getByRole('link', { name: 'Remember this' })).toBeVisible()

	await page.reload()
	await expect(page.getByText('A stored answer.')).toBeVisible()

	await page.getByRole('button', { name: '+ New chat' }).click()
	await expect(page.getByText('A stored answer.')).toHaveCount(0)
	await expect(page.getByRole('link', { name: 'Remember this' })).toBeVisible()
})

test('shows a not-found page for an unknown route', async ({ page }) => {
	await page.goto('./does-not-exist')

	await expect(page.getByRole('heading', { name: 'This page does not exist' })).toBeVisible()
})

/**
 * Seeds the settings so the app uses the streaming protocol. The deployed
 * backend still speaks the one-shot legacy one, so this is the only way to
 * exercise the streaming path end to end until it is rebuilt.
 */
async function useStreamingProtocol(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		localStorage.setItem(
			'example-openai-vuejs:settings',
			JSON.stringify({ version: 1, data: { serverProtocol: 'openai' } })
		)
	})
}

function sseBody(pieces: string[]): string {
	const frames = pieces.map(
		(content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
	)
	return `${frames.join('')}data: [DONE]\n\n`
}

test('streams a response token by token', async ({ page }) => {
	await useStreamingProtocol(page)

	await page.route('**/v1/chat/completions', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'text/event-stream',
			body: sseBody(['Streaming ', 'works ', 'end to end.'])
		})
	)

	await page.goto('./')
	await page.getByPlaceholder('Ask me something').fill('stream please')
	await page.locator('footer').getByRole('button', { name: 'Send' }).click()

	await expect(page.getByText('Streaming works end to end.')).toBeVisible()
})

test('stops a running generation', async ({ page }) => {
	await useStreamingProtocol(page)

	// Held open long enough for Stop to be clicked. `route.fulfill` closes the
	// stream as soon as it responds, so the delay has to come before it.
	await page.route('**/v1/chat/completions', async (route) => {
		// Comfortably longer than the 5s expect timeout, so the assertion below
		// races against nothing.
		await new Promise((resolve) => setTimeout(resolve, 20_000))
		await route.fulfill({
			status: 200,
			contentType: 'text/event-stream',
			body: sseBody(['never delivered'])
		})
	})

	await page.goto('./')
	// The prompt becomes the chat title, which the sidebar reuses in aria
	// labels ("Delete <title>"). Keeping the button words out of it stops
	// those from matching the composer's controls.
	await page.getByPlaceholder('Ask me something').fill('a long generation')

	const composer = page.locator('footer')
	await composer.getByRole('button', { name: 'Send' }).click()

	const stop = composer.getByRole('button', { name: 'Stop' })
	await expect(stop).toBeVisible()
	await stop.click()

	// Back to a usable composer, and no error toast: stopping is deliberate.
	await expect(composer.getByRole('button', { name: 'Send' })).toBeVisible()
	await expect(page.getByPlaceholder('Ask me something')).toBeEnabled()
	await expect(page.getByRole('status')).not.toContainText('failed')
})

test('reports a failing request instead of locking the composer', async ({ page }) => {
	await useStreamingProtocol(page)

	await page.route('**/v1/chat/completions', (route) =>
		route.fulfill({ status: 401, body: 'no key' })
	)

	await page.goto('./')
	await page.getByPlaceholder('Ask me something').fill('this will fail')
	await page.locator('footer').getByRole('button', { name: 'Send' }).click()

	await expect(page.getByRole('status')).toContainText('Check the API key')
	await expect(page.getByPlaceholder('Ask me something')).toBeEnabled()
})
