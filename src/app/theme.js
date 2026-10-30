import { $ } from '../utils/dom.js'

export function setupTheme() {
  const button = $('#themeToggle')
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const updateButton = () => {
    const isDark = document.documentElement.dataset.theme === 'dark'
    button.setAttribute('aria-label', isDark ? '切换到浅色主题' : '切换到深色主题')
    button.setAttribute('title', isDark ? '切换到浅色主题' : '切换到深色主题')
    button.setAttribute('aria-pressed', String(isDark))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0e0f12' : '#f7f8fa')
  }

  button.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = nextTheme
    try { localStorage.setItem('theme', nextTheme) } catch { /* Storage may be unavailable. */ }
    updateButton()
  })
  media.addEventListener?.('change', event => {
    try { if (localStorage.getItem('theme')) return } catch { /* Follow system theme when storage is unavailable. */ }
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'
    updateButton()
  })
  updateButton()
}
