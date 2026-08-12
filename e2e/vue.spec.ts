import { test, expect } from '@playwright/test'

test('renders the chat view at the root url', async ({ page }) => {
	await page.goto('./')

	await expect(page.locator('h1')).toHaveText('Vue 3 + OpenAI')
	await expect(page.getByPlaceholder('Ask me something')).toBeVisible()
})

test('navigates between the routes', async ({ page }) => {
	await page.goto('./')

	await page.getByRole('link', { name: 'Image' }).click()
	await expect(page.getByPlaceholder('Describe your image. Use your phantasie!')).toBeVisible()

	await page.getByRole('link', { name: 'About' }).click()
	await expect(
		page.getByRole('heading', { name: 'Example project for an AI chat' })
	).toBeVisible()
})
