import { test, expect } from '@playwright/test'

test('home page renders every tool and filters through the URL', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.all-tools-section .tool-card')).toHaveCount(157)

  await page.fill('#searchInput', 'base64')
  await expect(page.locator('.all-tools-section .tool-card').first()).toContainText('Base64')
  await expect(page).toHaveURL(/[?&]q=base64/)

  await page.goto('/?q=punycode&category=encoding')
  await expect(page.locator('#searchInput')).toHaveValue('punycode')
  await expect(page.locator('.category-tab[data-category="encoding"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.all-tools-section .tool-card').first()).toContainText('Punycode')
})

test('opens a lazy-loaded tool and performs a local conversion', async ({ page }) => {
  await page.goto('/#/base64')
  await expect(page.locator('.tool-title')).toHaveText('Base64 编解码')
  const fields = page.locator('.tool-body textarea')
  await fields.first().fill('hello')
  await expect(fields.nth(1)).toHaveValue('aGVsbG8=')
})

test('renders a barcode on a real canvas', async ({ page }) => {
  await page.goto('/#/barcode')
  await expect(page.locator('.tool-title')).toHaveText('条形码生成')
  await page.getByRole('button', { name: '生成条形码' }).click()
  const canvas = page.locator('canvas.qrcode-canvas')
  await expect(canvas).toBeVisible()
  expect(await canvas.evaluate(node => node.width)).toBeGreaterThan(0)
})

test('serves the cached app shell when offline', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20_000 })

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('#searchInput')).toBeVisible()
  await expect(page.locator('.all-tools-section .tool-card').first()).toBeVisible()
  await context.setOffline(false)
})

test('category landing pages are generated and list their tools', async ({ page }) => {
  await page.goto('/categories/encoding/')
  await expect(page.locator('h1')).toHaveText('编码/解码工具')
  await expect(page.locator('.tool-list li')).toHaveCount(11)
  await expect(page.locator('.tool-list a').first()).toHaveAttribute('href', '../../tools/base64/')

  await page.getByRole('link', { name: '在工具箱中浏览' }).click()
  await expect(page.locator('.category-tab[data-category="encoding"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/[?&]category=encoding/)
})
