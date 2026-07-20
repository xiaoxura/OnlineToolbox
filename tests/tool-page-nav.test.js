import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  localStorage.clear()
  document.documentElement.dataset.theme = 'light'
  document.body.innerHTML = `
    <button id="themeToggle"></button>
    <div class="search-box"><input id="searchInput"></div>
    <button id="searchClear" hidden></button>
    <nav id="categoryNav"></nav>
    <main id="mainContent"></main>
  `
  window.location.hash = '#/'
  await import('../src/main.js')
})

async function gotoTool(hash) {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  // Wait until the async tool module has loaded and rendered.
  await vi.waitFor(() => expect(document.querySelector('.tool-body')?.getAttribute('aria-busy')).toBe('false'))
}

describe('tool page context navigation', () => {
  it('renders a breadcrumb with a clickable category that returns to that category', async () => {
    const search = document.querySelector('#searchInput')
    search.value = 'JWT'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await gotoTool('#/base64')
    const crumb = document.querySelector('.breadcrumb')
    expect(crumb).not.toBeNull()
    expect(crumb.querySelector('.breadcrumb-current')?.textContent).toBe('Base64 编解码')

    const categoryBtn = crumb.querySelector('.breadcrumb-category')
    expect(categoryBtn?.textContent).toBe('编码/解码')
    categoryBtn.click()
    await vi.waitFor(() => expect(document.querySelector('.all-tools-section')).not.toBeNull())
    // Lands on home with the encoding tab active.
    expect(search.value).toBe('')
    expect(document.querySelector('[data-category="encoding"]').getAttribute('aria-pressed')).toBe('true')
  })

  it('header favorite toggles in place and persists without leaving the page', async () => {
    await gotoTool('#/sha')
    const fav = document.querySelector('.tool-header > .favorite-btn')
    expect(fav).not.toBeNull()
    expect(fav.getAttribute('aria-pressed')).toBe('false')
    fav.click()
    // Still on the tool page (no home re-render), state flipped + persisted.
    expect(document.querySelector('.tool-title')?.textContent).toBe('SHA 哈希')
    expect(fav.getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem('toolbox:favorites')).toContain('sha')
    // Home reflects it after navigating back (reset to the "all" tab first —
    // the favorites section only renders on the unfiltered home view).
    window.location.hash = '#/'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await vi.waitFor(() => expect(document.querySelector('[data-category="all"]')).not.toBeNull())
    document.querySelector('[data-category="all"]').click()
    await vi.waitFor(() => expect(document.querySelector('.favorites-section')).not.toBeNull())
  })

  it('shows related tools from the same category, excluding the current one', async () => {
    await gotoTool('#/base64')
    await vi.waitFor(() => expect(document.querySelector('.related-tools')).not.toBeNull())
    const related = document.querySelector('.related-tools')
    const hrefs = [...related.querySelectorAll('.tool-card')].map(a => a.getAttribute('href'))
    expect(hrefs.length).toBeGreaterThan(0)
    expect(hrefs.length).toBeLessThanOrEqual(6)
    expect(hrefs).not.toContain('#/base64')
    // All related tools are in the encoding category.
    for (const href of hrefs) {
      expect(['#/url-encode', '#/html-entity', '#/unicode', '#/hex', '#/jwt', '#/base58', '#/base32', '#/punycode']).toContain(href)
    }
  })

  it('related-tool cards navigate to another tool page directly', async () => {
    await gotoTool('#/hex')
    await vi.waitFor(() => expect(document.querySelector('.related-tools')).not.toBeNull())
    const first = document.querySelector('.related-tools .tool-card')
    expect(first.getAttribute('href')).toMatch(/^#\//)
  })
})
