import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  document.documentElement.dataset.theme = 'light'
  document.body.innerHTML = `
    <button id="themeToggle"></button>
    <div class="search-box"><input id="searchInput"></div>
    <nav id="categoryNav"></nav>
    <main id="mainContent"></main>
  `
  window.location.hash = '#/'
  await import('../src/main.js')
})

describe('application routing', () => {
  it('renders the home grid', () => {
    expect(document.querySelectorAll('.all-tools-section .tool-card')).toHaveLength(86)
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
    await vi.waitFor(() => expect(document.querySelectorAll('.all-tools-section .tool-card')).toHaveLength(86))
    expect(window.location.hash).toBe('#/')
  })

  it('persists theme selection', () => {
    document.querySelector('#themeToggle').click()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('supports favorites and remembers the home filters', async () => {
    const favorite = document.querySelector('[aria-label="收藏Base64 编解码"]')
    favorite.click()
    expect(localStorage.getItem('toolbox:favorites')).toContain('base64')
    expect(document.querySelector('.favorites-section')).not.toBeNull()

    document.querySelector('[data-category="encoding"]').click()
    const search = document.querySelector('#searchInput')
    search.value = 'token'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(document.querySelectorAll('.all-tools-section .tool-card')).toHaveLength(1)

    window.location.hash = '#/jwt'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await vi.waitFor(() => expect(document.querySelector('.tool-title')?.textContent).toBe('JWT 解析'))
    window.location.hash = '#/'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await vi.waitFor(() => expect(document.querySelector('#searchInput').value).toBe('token'))
    expect(document.querySelector('[data-category="encoding"]').getAttribute('aria-pressed')).toBe('true')
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('href')).toBe('#/jwt'))
  })

})
