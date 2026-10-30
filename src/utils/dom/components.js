import { createElement, nextId } from './core.js'
import { copyToClipboard } from '../clipboard.js'

// Copy button helper
const copySuccessIcon = `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
const copiedTimers = new WeakMap()

// Briefly turn a copy button into a success state so the user gets feedback
// next to the content they copied (the toast stays for screen readers).
export function flashCopied(button) {
  if (!button) return
  if (!button.dataset.originalHtml) {
    button.dataset.originalHtml = button.innerHTML
    button.dataset.originalLabel = button.getAttribute('aria-label') || ''
  }
  button.classList.add('copied')
  button.innerHTML = copySuccessIcon
  button.setAttribute('aria-label', '已复制')
  clearTimeout(copiedTimers.get(button))
  copiedTimers.set(button, setTimeout(() => {
    button.classList.remove('copied')
    button.innerHTML = button.dataset.originalHtml
    if (button.dataset.originalLabel) button.setAttribute('aria-label', button.dataset.originalLabel)
    else button.removeAttribute('aria-label')
  }, 1200))
}

export function createCopyButton(text) {
  return createElement('button', {
    className: 'btn-icon',
    type: 'button',
    title: '复制',
    'aria-label': '复制到剪贴板',
    innerHTML: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    onClick: event => {
      const value = typeof text === 'function' ? text() : text
      copyToClipboard(value)
      flashCopied(event.currentTarget)
    }
  })
}

// Tool section helper
export function createSection(title, contentEl, actions = []) {
  const headingId = nextId('tool-section')
  const header = createElement('div', { className: 'tool-section-header' }, [
    createElement('h2', { id: headingId, textContent: title }),
    createElement('div', { className: 'btn-group' }, actions)
  ])
  const body = createElement('div', { className: 'tool-section-body' }, [contentEl])
  return createElement('section', { className: 'tool-section', 'aria-labelledby': headingId }, [header, body])
}

export function createTableScroll(table, label = '可横向滚动的数据表格') {
  const wrapper = createElement('div', {
    className: 'table-scroll',
    tabindex: '0',
    role: 'region',
    'aria-label': label
  })
  table.before(wrapper)
  wrapper.appendChild(table)
  return wrapper
}
