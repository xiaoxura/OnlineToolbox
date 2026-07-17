let generatedId = 0
const choiceScrollObservers = new WeakMap()

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

function keepChoiceVisible(button) {
  const group = button?.closest?.('.tab-group, .segmented-group, .filter-group')
  if (!group || group.scrollWidth <= group.clientWidth) return

  const buttonStart = button.offsetLeft
  const buttonEnd = buttonStart + button.offsetWidth
  const visibleStart = group.scrollLeft
  const visibleEnd = visibleStart + group.clientWidth
  let target = visibleStart
  if (buttonStart < visibleStart) target = buttonStart
  else if (buttonEnd > visibleEnd) target = buttonEnd - group.clientWidth
  if (target === visibleStart) return

  if (group.scrollTo) group.scrollTo({ left: target, behavior: 'smooth' })
  else group.scrollLeft = target
}

function bindRovingKeyboard(container, buttons, activate) {
  container.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || !buttons.length) return
    event.preventDefault()
    const current = buttons.indexOf(document.activeElement)
    let next = current < 0 ? 0 : current
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (next - 1 + buttons.length) % buttons.length
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (next + 1) % buttons.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = buttons.length - 1
    activate(buttons[next], { focus: true })
  })
}

function createSelectableGroup(items, onChange, options, config) {
  const values = items.map((item, index) => item.value ?? item.id ?? String(index))
  const container = createElement('div', {
    className: config.groupClass,
    role: config.groupRole,
    'aria-label': options.label || config.defaultLabel
  })
  const buttons = items.map((item, index) => {
    const active = index === 0
    const button = createElement('button', {
      className: config.buttonClass,
      type: 'button',
      role: config.buttonRole,
      textContent: item.label,
      'data-value': values[index],
      [config.stateAttribute]: String(active),
      tabindex: active ? '0' : '-1'
    })
    if (active) button.classList.add('active')
    button.addEventListener('click', () => activate(button))
    return button
  })

  function activate(activeButton, { focus = false, notify = true } = {}) {
    const activeIndex = buttons.indexOf(activeButton)
    if (activeIndex < 0) return false
    buttons.forEach((button, index) => {
      const active = index === activeIndex
      button.classList.toggle('active', active)
      button.setAttribute(config.stateAttribute, String(active))
      button.tabIndex = active ? 0 : -1
    })
    if (focus) activeButton.focus()
    keepChoiceVisible(activeButton)
    if (notify) onChange(values[activeIndex])
    return true
  }

  bindRovingKeyboard(container, buttons, activate)
  container.append(...buttons)
  container.setValue = (value, settings = {}) => {
    const index = values.findIndex(itemValue => String(itemValue) === String(value))
    return index >= 0 && activate(buttons[index], { notify: false, ...settings })
  }
  container.getValue = () => values[buttons.findIndex(button => button.getAttribute(config.stateAttribute) === 'true')]
  return container
}

export function createSegmentedGroup(items, onChange = () => {}, options = {}) {
  return createSelectableGroup(items, onChange, options, {
    groupClass: 'segmented-group',
    groupRole: 'radiogroup',
    buttonClass: 'segmented-btn',
    buttonRole: 'radio',
    stateAttribute: 'aria-checked',
    defaultLabel: '模式选择'
  })
}

export function createFilterGroup(items, onChange = () => {}, options = {}) {
  return createSelectableGroup(items, onChange, options, {
    groupClass: 'filter-group',
    groupRole: 'group',
    buttonClass: 'filter-btn',
    buttonRole: undefined,
    stateAttribute: 'aria-pressed',
    defaultLabel: '筛选选项'
  })
}

// Tab group helper for controls that switch distinct content panels.
export function createTabGroup(tabs, onChange = () => {}, options = {}) {
  const container = createElement('div', { className: 'tab-group', role: 'tablist', 'aria-label': options.label || '内容视图' })
  const tabSetId = `tool-tabs-${++generatedId}`
  const values = tabs.map((tab, index) => tab.value ?? tab.id ?? String(index))
  let contentPanels = []
  const buttons = tabs.map((tab, index) => {
    const btn = createElement('button', {
      className: 'tab-btn',
      type: 'button',
      role: 'tab',
      id: `${tabSetId}-tab-${index}`,
      textContent: tab.label,
      'data-value': values[index],
      'aria-selected': String(index === 0),
      tabindex: index === 0 ? '0' : '-1'
    })
    btn.addEventListener('click', () => activateTab(btn))
    return btn
  })

  function activateTab(activeButton, { focus = false, notify = true } = {}) {
    const activeIndex = buttons.indexOf(activeButton)
    if (activeIndex < 0) return false
    buttons.forEach((button, index) => {
      const active = index === activeIndex
      button.classList.toggle('active', active)
      button.setAttribute('aria-selected', String(active))
      button.tabIndex = active ? 0 : -1
      if (contentPanels[index]) contentPanels[index].hidden = !active
    })
    if (focus) activeButton.focus()
    keepChoiceVisible(activeButton)
    if (notify) onChange(values[activeIndex])
    return true
  }

  bindRovingKeyboard(container, buttons, activateTab)
  if (buttons.length) buttons[0].classList.add('active')
  container.append(...buttons)
  container.setValue = (value, settings = {}) => {
    const index = values.findIndex(itemValue => String(itemValue) === String(value))
    return index >= 0 && activateTab(buttons[index], { notify: false, ...settings })
  }

  if (tabs.some(tab => typeof tab.content === 'function')) {
    const wrapper = createElement('div', { className: 'tab-layout' }, [container])
    const content = createElement('div', { className: 'tab-content' })
    contentPanels = tabs.map((tab, index) => {
      const panelId = `${tabSetId}-panel-${index}`
      buttons[index].setAttribute('aria-controls', panelId)
      const panel = createElement('div', {
        id: panelId,
        role: 'tabpanel',
        'aria-labelledby': buttons[index].id,
        hidden: index !== 0,
        tabindex: '0'
      })
      tab.content?.(panel)
      content.appendChild(panel)
      return panel
    })
    wrapper.appendChild(content)
    container.element = wrapper
  }

  return container
}

function enhanceChoiceScrolling(group) {
  if (group.parentElement?.classList.contains('choice-scroll-wrap')) return
  const wrapper = createElement('div', { className: 'choice-scroll-wrap' })
  const previous = createElement('button', {
    className: 'choice-scroll-button choice-scroll-prev',
    type: 'button',
    textContent: '‹',
    'aria-label': '向左滚动选项'
  })
  const next = createElement('button', {
    className: 'choice-scroll-button choice-scroll-next',
    type: 'button',
    textContent: '›',
    'aria-label': '向右滚动选项'
  })
  group.before(wrapper)
  wrapper.append(previous, group, next)

  const update = () => {
    const maxScroll = Math.max(0, group.scrollWidth - group.clientWidth)
    previous.hidden = maxScroll < 6 || group.scrollLeft <= 6
    next.hidden = maxScroll < 6 || group.scrollLeft >= maxScroll - 6
  }
  const scroll = direction => {
    const distance = Math.max(160, Math.round(group.clientWidth * 0.7)) * direction
    if (group.scrollBy) group.scrollBy({ left: distance, behavior: 'smooth' })
    else group.scrollLeft += distance
  }
  previous.addEventListener('click', () => scroll(-1))
  next.addEventListener('click', () => scroll(1))
  group.addEventListener('scroll', update, { passive: true })
  group.addEventListener('focusin', update)
  update()
  globalThis.requestAnimationFrame?.(update)
  if (globalThis.ResizeObserver) {
    const observer = new globalThis.ResizeObserver(update)
    observer.observe(group)
    choiceScrollObservers.set(group, observer)
  }
}

export function cleanupFormAccessibility(root = document) {
  const groups = root.matches?.('.tab-group, .segmented-group, .filter-group')
    ? [root]
    : [...root.querySelectorAll('.tab-group, .segmented-group, .filter-group')]
  groups.forEach(group => {
    choiceScrollObservers.get(group)?.disconnect()
    choiceScrollObservers.delete(group)
  })
}

export function enhanceFormAccessibility(root = document) {
  root.querySelectorAll('.tool-section').forEach(section => {
    const body = section.querySelector(':scope > .tool-section-body')
    const header = section.querySelector(':scope > .tool-section-header')
    if (!body || !header) return
    const strayChildren = [...section.children].filter(child => child !== header && child !== body)
    if (strayChildren.length) body.append(...strayChildren)
  })

  root.querySelectorAll('table.result-box').forEach(table => {
    table.classList.remove('result-box')
    table.classList.add('result-table')
  })

  root.querySelectorAll('table.result-table').forEach(table => {
    if (table.parentElement?.classList.contains('table-scroll')) return
    createTableScroll(table)
  })

  const tabGroups = [...root.querySelectorAll('.tab-group[role="tablist"]')]
  const externalPanels = [...root.querySelectorAll('.tab-panel')]
  if (tabGroups.length === 1) {
    const buttons = [...tabGroups[0].querySelectorAll('[role="tab"]')]
    if (buttons.length === externalPanels.length && buttons.every(button => !button.hasAttribute('aria-controls'))) {
      buttons.forEach((button, index) => {
        const panel = externalPanels[index]
        if (!panel.id) panel.id = `tool-tab-panel-${++generatedId}`
        button.setAttribute('aria-controls', panel.id)
        panel.setAttribute('role', 'tabpanel')
        panel.setAttribute('aria-labelledby', button.id)
        panel.setAttribute('tabindex', '0')
      })
    }
  }

  root.querySelectorAll('.tab-group, .segmented-group, .filter-group').forEach(enhanceChoiceScrolling)

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

  root.querySelectorAll('button:not([type])').forEach(button => button.setAttribute('type', 'button'))
}
