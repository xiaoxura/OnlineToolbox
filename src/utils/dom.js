export function $(selector, parent = document) {
  return parent.querySelector(selector)
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)]
}

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value
    } else if (key === 'innerHTML') {
      el.innerHTML = value
    } else if (key === 'textContent') {
      el.textContent = value
    } else if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), value)
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value)
    } else {
      el.setAttribute(key, value)
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child))
    } else if (child) {
      el.appendChild(child)
    }
  }
  return el
}

// Toast notification
let toastEl = null
let toastTimer = null

export function showToast(message, duration = 2000) {
  if (!toastEl) {
    toastEl = createElement('div', { className: 'toast' })
    document.body.appendChild(toastEl)
  }
  clearTimeout(toastTimer)
  toastEl.textContent = message
  toastEl.classList.add('show')
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show')
  }, duration)
}

// Copy button helper
export function createCopyButton(text) {
  const btn = createElement('button', {
    className: 'btn-icon',
    title: '复制',
    innerHTML: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    onClick: () => {
      const value = typeof text === 'function' ? text() : text
      copyToClipboard(value)
    }
  })
  return btn
}

import { copyToClipboard } from './clipboard.js'

// Tool section helper
export function createSection(title, contentEl, actions = []) {
  const header = createElement('div', { className: 'tool-section-header' }, [
    createElement('span', { textContent: title }),
    createElement('div', { className: 'btn-group' }, actions)
  ])
  const body = createElement('div', { className: 'tool-section-body' }, [contentEl])
  return createElement('div', { className: 'tool-section' }, [header, body])
}

// Tab group helper
export function createTabGroup(tabs, onChange) {
  const container = createElement('div', { className: 'tab-group' })
  const buttons = tabs.map(tab => {
    const btn = createElement('button', {
      className: 'tab-btn',
      textContent: tab.label,
      'data-value': tab.value,
      onClick: () => {
        buttons.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        onChange(tab.value)
      }
    })
    return btn
  })
  buttons[0].classList.add('active')
  container.append(...buttons)
  return container
}
