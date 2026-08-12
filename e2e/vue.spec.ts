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
