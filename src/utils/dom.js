let generatedId = 0

export function $(selector, parent = document) {
  return parent.querySelector(selector)
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)]
}

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue
    if (key === 'attrs' && typeof value === 'object') {
      for (const [attrName, attrValue] of Object.entries(value)) {
        if (attrValue !== undefined && attrValue !== null && attrValue !== false) el.setAttribute(attrName, attrValue)
      }
    } else if (key === 'className') {
      el.className = value
    } else if (key === 'innerHTML') {
      el.innerHTML = value
    } else if (key === 'textContent') {
      el.textContent = value
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value)
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value)
    } else if (key in el && typeof value === 'boolean') {
      el[key] = value
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

  if (el.classList.contains('error-text')) {
    el.setAttribute('role', 'alert')
    el.setAttribute('aria-live', 'polite')
  }

  return el
}

// Toast notification
let toastEl = null
let toastTimer = null

export function showToast(message, duration = 2000) {
  if (!toastEl) {
    toastEl = createElement('div', {
      className: 'toast',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true'
    })
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
  return createElement('button', {
    className: 'btn-icon',
    type: 'button',
    title: '复制',
    'aria-label': '复制到剪贴板',
    innerHTML: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    onClick: () => {
      const value = typeof text === 'function' ? text() : text
      copyToClipboard(value)
    }
  })
}

import { copyToClipboard } from './clipboard.js'

// Tool section helper
export function createSection(title, contentEl, actions = []) {
  const headingId = `tool-section-${++generatedId}`
  const header = createElement('div', { className: 'tool-section-header' }, [
    createElement('h2', { id: headingId, textContent: title }),
    createElement('div', { className: 'btn-group' }, actions)
  ])
  const body = createElement('div', { className: 'tool-section-body' }, [contentEl])
  return createElement('section', { className: 'tool-section', 'aria-labelledby': headingId }, [header, body])
}

// Tab group helper
export function createTabGroup(tabs, onChange = () => {}) {
  const container = createElement('div', { className: 'tab-group', role: 'tablist' })
  let contentPanels = []
  const buttons = tabs.map((tab, index) => {
    const value = tab.value ?? tab.id ?? String(index)
    const btn = createElement('button', {
      className: 'tab-btn',
      type: 'button',
      role: 'tab',
      textContent: tab.label,
      'data-value': value,
      'aria-selected': String(index === 0),
      tabindex: index === 0 ? '0' : '-1'
    })
    btn.addEventListener('click', () => activateTab(btn, value))
    return btn
  })

  function activateTab(activeButton, value, focus = false) {
    const activeIndex = buttons.indexOf(activeButton)
    buttons.forEach((button, index) => {
      const active = index === activeIndex
      button.classList.toggle('active', active)
      button.setAttribute('aria-selected', String(active))
      button.tabIndex = active ? 0 : -1
      if (contentPanels[index]) contentPanels[index].hidden = !active
    })
    if (focus) activeButton.focus()
    onChange(value)
  }

  container.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const current = buttons.indexOf(document.activeElement)
    let next = current < 0 ? 0 : current
    if (event.key === 'ArrowLeft') next = (next - 1 + buttons.length) % buttons.length
    if (event.key === 'ArrowRight') next = (next + 1) % buttons.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = buttons.length - 1
    activateTab(buttons[next], buttons[next].dataset.value, true)
  })

  if (buttons.length) buttons[0].classList.add('active')
  container.append(...buttons)

  if (tabs.some(tab => typeof tab.content === 'function')) {
    const wrapper = createElement('div', { className: 'tab-layout' }, [container])
    const content = createElement('div', { className: 'tab-content' })
    contentPanels = tabs.map((tab, index) => {
      const panel = createElement('div', { role: 'tabpanel', hidden: index !== 0 })
      tab.content?.(panel)
      content.appendChild(panel)
      return panel
    })
    wrapper.appendChild(content)
    container.element = wrapper
  }

  return container
}

export function enhanceFormAccessibility(root = document) {
  root.querySelectorAll('.form-group').forEach(group => {
    const labels = [...group.querySelectorAll('label')].filter(label => !label.control)
    const controls = [...group.querySelectorAll('input, textarea, select')].filter(control => {
      return !control.closest('label') && !control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby')
    })

    labels.forEach((label, index) => {
      const control = controls[index]
      if (!control) return
      if (!control.id) control.id = `tool-field-${++generatedId}`
      label.htmlFor = control.id
    })
  })

  root.querySelectorAll('input, textarea, select').forEach(control => {
    if (control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return
    const fallback = control.getAttribute('placeholder') || control.closest('.tool-section')?.querySelector('.tool-section-header h2')?.textContent
    if (fallback) control.setAttribute('aria-label', fallback)
  })

  root.querySelectorAll('img:not([alt])').forEach(image => image.setAttribute('alt', ''))
  root.querySelectorAll('button:not([aria-label])').forEach(button => {
    if (!button.textContent.trim() && button.title) button.setAttribute('aria-label', button.title)
  })
}
