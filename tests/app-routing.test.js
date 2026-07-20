import { beforeAll, describe, expect, it, vi } from 'vitest'
import { tools } from '../src/tools/registry.js'

beforeAll(async () => {
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

describe('application routing', () => {
  it('renders the home grid', () => {
    expect(document.querySelectorAll('.all-tools-section .tool-card')).toHaveLength(tools.length)
    expect(document.querySelector('.featured-section')).not.toBeNull()
    expect(document.title).toBe('在线工具箱')
  })

  it('lazy-loads and renders a tool route', async () => {
    window.location.hash = '#/base64'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await vi.waitFor(() => {
      expect(document.querySelector('.tool-title')?.textContent).toBe('Base64 编解码')
      expect(document.querySelector('.tool-body textarea')).not.toBeNull()
    })
    expect(document.title).toBe('Base64 编解码 - 在线工具箱')
    expect(document.querySelector('.tool-header-icon')).not.toBeNull()
    expect(document.querySelector('.tool-body')?.getAttribute('aria-busy')).toBe('false')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('falls back from an unknown route instead of showing a blank page', async () => {
    window.location.hash = '#/does-not-exist'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await vi.waitFor(() => expect(document.querySelectorAll('.all-tools-section .tool-card')).toHaveLength(tools.length))
    expect(window.location.hash).toBe('#/')
  })

  it('persists theme selection', () => {
    document.querySelector('#themeToggle').click()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('supports favorites and remembers the home filters', async () => {
    const favorite = document.querySelector('[aria-label="收藏Base64 编解码"]')
    favorite.focus()
    favorite.click()
    expect(localStorage.getItem('toolbox:favorites')).toContain('base64')
    expect(document.querySelector('.favorites-section')).not.toBeNull()
    expect(document.activeElement?.dataset.toolId).toBe('base64')

    const favoritesView = document.querySelector('[data-view="favorites"]')
    favoritesView.focus()
    favoritesView.click()
    expect(document.activeElement?.dataset.view).toBe('favorites')
    document.querySelector('[data-category="math"]').click()
    expect(document.querySelector('.empty-state p')?.textContent).toBe('当前筛选下没有匹配工具')
    document.querySelector('.empty-state .btn').click()
    const allView = document.querySelector('[data-view="all"]')
    allView.focus()
    allView.click()
    expect(document.activeElement?.dataset.view).toBe('all')

    document.querySelector('[data-category="encoding"]').click()
    const search = document.querySelector('#searchInput')
    search.value = 'JWT'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(document.querySelectorAll('.all-tools-section .tool-card')).toHaveLength(1)
    expect(document.querySelector('[data-category="encoding"]').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('#searchClear').hidden).toBe(false)
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(search.value).toBe('')
    expect(document.querySelector('[data-category="encoding"]').getAttribute('aria-pressed')).toBe('true')
    search.value = 'JWT'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('#searchClear').click()
    expect(search.value).toBe('')
    expect(document.querySelector('#searchClear').hidden).toBe(true)
    search.value = 'JWT'
    search.dispatchEvent(new Event('input', { bubbles: true }))

    window.location.hash = '#/jwt'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await vi.waitFor(() => expect(document.querySelector('.tool-title')?.textContent).toBe('JWT 解析'))
    await vi.waitFor(() => expect(document.querySelector('.related-tools .favorite-btn[aria-pressed="false"]')).not.toBeNull())
    const toolHash = window.location.hash
    document.querySelector('.related-tools .favorite-btn[aria-pressed="false"]').click()
    expect(document.querySelector('.tool-title')?.textContent).toBe('JWT 解析')
    expect(window.location.hash).toBe(toolHash)
    window.location.hash = '#/'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await vi.waitFor(() => expect(document.querySelector('#searchInput').value).toBe('JWT'))
    expect(document.querySelector('[data-category="encoding"]').getAttribute('aria-pressed')).toBe('true')
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('href')).toBe('#/jwt'))

    search.value = ''
    search.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('[data-category="all"]').click()
    const recentFavorite = document.querySelector('.recent-section [data-tool-id="jwt"]')
    recentFavorite.focus()
    recentFavorite.click()
    expect(document.activeElement?.dataset.toolId).toBe('jwt')
    expect(document.querySelector('.recent-section .home-section-empty')?.textContent).toContain('均已收藏')
    document.querySelector('.recent-section .section-action').click()
    expect(localStorage.getItem('toolbox:recent')).toBe('[]')
    expect(document.querySelector('.recent-section')).toBeNull()
  })

})
