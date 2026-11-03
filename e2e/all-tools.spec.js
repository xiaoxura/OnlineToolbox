import { test, expect } from '@playwright/test'
import { tools } from '../src/tools/registry.js'

// Route smoke test for every registered tool. The unit suite renders each tool
// in jsdom, but only a real browser proves the lazy chunk, its CSS and every
// browser-only dependency (canvas, workers, WebCrypto) actually load. A stale
// deploy or a bad cache used to surface as "工具加载失败" on a handful of tools,
// so this is the regression guard for the whole catalog.
test.describe('every tool route', () => {
  // Let each request hit the network so the test covers the deployed bundle
  // rather than a previous test's service-worker cache.
  test.use({ serviceWorkers: 'block' })

  test('loads every tool without a load error or console error', async ({ page }) => {
    test.setTimeout(240_000)
    const failures = []

    for (const tool of tools) {
      const errors = []
      const onConsole = message => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`)
      }
      const onPageError = error => errors.push(`pageerror: ${error.message}`)
      page.on('console', onConsole)
      page.on('pageerror', onPageError)

      try {
        await page.goto(`/#/${tool.id}`, { waitUntil: 'domcontentloaded' })
        await expect(page.locator('.tool-title'), `${tool.id}: title`).toHaveText(tool.name)
        await expect(page.locator('.tool-body'), `${tool.id}: body`).toHaveAttribute('aria-busy', 'false', {
          timeout: 20_000
        })
        await expect(page.locator('.load-error'), `${tool.id}: load error`).toHaveCount(0)
        const rendered = await page.locator('.tool-body > *').count()
        if (!rendered) failures.push(`${tool.id}: rendered an empty body`)
      } catch (error) {
        failures.push(`${tool.id}: ${String(error.message || error).split('\n')[0]}`)
      } finally {
        page.off('console', onConsole)
        page.off('pageerror', onPageError)
      }

      if (errors.length) failures.push(`${tool.id}: ${errors.slice(0, 3).join(' | ')}`)
    }

    expect(failures, `Tools that failed to open:\n${failures.join('\n')}`).toEqual([])
  })
})
