import { test, expect } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('long token details stay inside a capped scroll panel', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/#/token-counter')
  await page.waitForSelector('.tool-body[aria-busy="false"]')
  await page.locator('.tool-body textarea').first().fill('Token 计数测试，hello world 你好世界！\n'.repeat(120))
  await page.getByRole('button', { name: '计算 Token' }).click()
  await expect(page.locator('.tool-body .result-table tbody tr')).toHaveCount(400, { timeout: 60_000 })

  const metrics = await page.evaluate(() => {
    const scroller = document.querySelector('.tool-body .table-scroll')
    return {
      pageHeight: document.documentElement.scrollHeight,
      clientHeight: scroller?.clientHeight || 0,
      scrollHeight: scroller?.scrollHeight || 0,
      inOutput: Boolean(document.querySelector('.tool-io-output .table-scroll')),
      statsInOutput: Boolean(document.querySelector('.tool-io-output .stats-row'))
    }
  })
  expect(metrics.inOutput).toBe(true)
  expect(metrics.statsInOutput).toBe(true)
  expect(metrics.clientHeight).toBeLessThanOrEqual(560)
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
  // 400 unconstrained rows used to make this page ~14,000 px tall.
  expect(metrics.pageHeight).toBeLessThan(4000)
})

test('word-frequency defaults to 50 rows and caps the table', async ({ page }) => {
  await page.goto('/#/word-frequency')
  await page.waitForSelector('.tool-body[aria-busy="false"]')
  await page.locator('.tool-body textarea').first().fill(Array.from({ length: 300 }, (_, i) => `word${i}`).join(' '))
  await page.getByRole('button', { name: '统计词频' }).click()
  await expect(page.locator('.tool-body .result-table tbody tr')).toHaveCount(50)

  const metrics = await page.evaluate(() => {
    const scroller = document.querySelector('.tool-body .table-scroll')
    return {
      pageHeight: document.documentElement.scrollHeight,
      clientHeight: scroller?.clientHeight || 0,
      scrollHeight: scroller?.scrollHeight || 0
    }
  })
  expect(metrics.clientHeight).toBeLessThanOrEqual(560)
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
  expect(metrics.pageHeight).toBeLessThan(4000)
})
