import { test, expect } from '@playwright/test'
import { tools } from '../src/tools/registry.js'

const ENCODING_COUNT = tools.filter(tool => tool.category === 'encoding').length

test('home page renders every tool and filters through the URL', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.all-tools-section .tool-card')).toHaveCount(tools.length)

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

test('pre-caches an unvisited tool so it opens offline', async ({ page, context }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20_000 })

  // The worker warms every small chunk in the background after activation.
  // Wait for the whole pre-cache set so the unvisited tool's dependencies are
  // present too, not just its own entry chunk.
  const yamlChunk = await page.evaluate(async () => {
    const manifest = await (await fetch('./asset-manifest.json')).json()
    return manifest.assets.find(asset => /\/yaml-[^/]+\.js$/.test(asset.url))?.url
  })
  await page.waitForFunction(async () => {
    const manifest = await (await fetch('./asset-manifest.json')).json()
    const expected = manifest.assets
      .filter(asset => asset.precache && asset.size <= (manifest.precacheMaxBytes || 512 * 1024))
      .map(asset => new URL(asset.url, location.href).pathname)
    const names = await caches.keys()
    const runtime = names.find(name => name.startsWith('toolbox-runtime-'))
    if (!runtime) return false
    const cache = await caches.open(runtime)
    const cached = new Set((await cache.keys()).map(request => new URL(request.url).pathname))
    return expected.every(path => cached.has(path))
  }, null, { timeout: 60_000 })
  // The worker may still be finishing the tail of its queue; make sure the
  // exact chunk we are about to import is matchable before cutting the network.
  await expect.poll(
    () => page.evaluate(url => caches.match(url).then(Boolean), yamlChunk),
    { timeout: 30_000 }
  ).toBe(true)
  await page.waitForTimeout(500)

  await context.setOffline(true)
  await page.goto('/#/yaml')
  await expect(page.locator('.tool-title')).toHaveText('YAML 格式化与校验')
  await expect(page.locator('.tool-section').first()).toBeVisible()
  await context.setOffline(false)
})

test('command palette switches tools from any page', async ({ page }) => {
  await page.goto('/#/base64')
  await page.keyboard.press('Control+k')
  const dialog = page.locator('.tool-picker-panel')
  await expect(dialog).toBeVisible()
  await page.locator('.tool-picker-input').fill('sjc')
  const first = page.locator('.tool-picker-option').first()
  await expect(first).toContainText('时间戳')
  await first.click()
  await expect(page.locator('.tool-title')).toHaveText('时间戳转换')
})

test('restores tool input after a reload', async ({ page }) => {
  await page.goto('/#/base64')
  const input = page.locator('.tool-body textarea').first()
  await input.fill('draft-persistence-check')
  await expect(page.locator('.tool-body textarea').nth(1)).toHaveValue('ZHJhZnQtcGVyc2lzdGVuY2UtY2hlY2s=')
  await page.reload()
  await expect(page.locator('.tool-body textarea').first()).toHaveValue('draft-persistence-check')
  await expect(page.locator('.draft-notice')).toBeVisible()
  await page.getByRole('button', { name: '清除草稿' }).click()
  await expect(page.locator('.tool-body textarea').first()).toHaveValue('')
})

test('sends a result to another tool through the result toolbar', async ({ page }) => {
  await page.goto('/#/json')
  const input = page.locator('.tool-body textarea').first()
  await input.fill('{"name":"demo","count":2}')
  await page.getByRole('button', { name: '美化' }).click()
  await expect(page.locator('.tool-body textarea[readonly]').first()).toHaveValue(/name/)
  await page.getByRole('button', { name: '发送到其他工具' }).first().click()
  await page.locator('.tool-picker-input').fill('yaml')
  await page.locator('.tool-picker-option').first().click()
  await expect(page.locator('.tool-title')).toHaveText('YAML 格式化与校验')
  await expect(page.locator('.tool-body textarea').first()).toHaveValue(/"name": "demo"/)
})

test('category landing pages are generated and list their tools', async ({ page }) => {
  await page.goto('/categories/encoding/')
  await expect(page.locator('h1')).toHaveText('编码/解码工具')
  await expect(page.locator('.tool-list li')).toHaveCount(ENCODING_COUNT)
  await expect(page.locator('.tool-list a').first()).toHaveAttribute('href', '../../tools/base64/')

  await page.getByRole('link', { name: '在工具箱中浏览' }).click()
  await expect(page.locator('.category-tab[data-category="encoding"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/[?&]category=encoding/)
})
