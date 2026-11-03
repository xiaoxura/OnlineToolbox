import { test, expect } from '@playwright/test'

// The calculator used `new Function()`, which EdgeOne's production CSP blocks
// (script-src has no 'unsafe-eval'), so every expression showed "Error". Keep
// a browser-level regression test that enforces the same policy locally.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:"
].join('; ')

test.use({ serviceWorkers: 'block' })

test('calculator evaluates expressions under the production CSP', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const response = await route.fetch()
    const headers = { ...response.headers() }
    if ((headers['content-type'] || '').includes('text/html')) {
      headers['content-security-policy'] = CSP
    }
    await route.fulfill({ response, headers })
  })

  await page.goto('/#/calculator')
  await page.waitForSelector('.tool-body[aria-busy="false"]')

  const button = name => page.getByRole('button', { name, exact: true })
  const display = page.locator('.calculator-display .stat-value')

  for (const label of ['1', '+', '2']) await button(label).click()
  await expect(display).toHaveText('3')
  await button('=').click()
  await expect(display).toHaveText('3')

  await button('C').click()
  for (const label of ['5', '0', '%']) await button(label).click()
  await button('=').click()
  await expect(display).toHaveText('0.5')

  await button('C').click()
  for (const label of ['1', '0', '%', '3']) await button(label).click()
  await button('=').click()
  await expect(display).toHaveText('1')

  await button('C').click()
  for (const label of ['√', '9', ')']) await button(label).click()
  await button('=').click()
  await expect(display).toHaveText('3')

  expect(errors).toEqual([])
})
