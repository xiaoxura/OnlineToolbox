import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  document.documentElement.dataset.theme = 'light'
  document.body.innerHTML = `
    <button id="themeToggle"></button>
    <div class="search-box"><input id="searchInput"></div>
    <button id="searchClear" hidden></button>
    <nav id="categoryNav"></nav>
    <main id="mainContent"></main>
    <div id="liveRegion"></div>
  `
  window.history.replaceState(null, '', '/?q=base64&category=encoding')
  await import('../src/main.js')
})

const params = () => new URLSearchParams(window.location.search)

describe('URL state', () => {
  it('hydrates search and category from the query string', () => {
    expect(document.querySelector('#searchInput').value).toBe('base64')
    expect(document.querySelector('[data-category="encoding"]').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelectorAll('.all-tools-section .tool-card').length).toBeGreaterThan(0)
    expect(document.querySelector('.all-tools-section .tool-card .tool-name').textContent).toBe('Base64 编解码')
    expect(params().get('q')).toBe('base64')
    expect(params().get('category')).toBe('encoding')
  })

  it('updates the query string when filters change', () => {
    document.querySelector('[data-category="crypto"]').click()
    expect(params().get('category')).toBe('crypto')
    expect(params().get('q')).toBe('base64')

    document.querySelector('[data-view="favorites"]').click()
    expect(params().get('view')).toBe('favorites')

    document.querySelector('.section-reset').click()
    expect(params().toString()).toBe('')
    expect(document.querySelector('#searchInput').value).toBe('')
  })
})
