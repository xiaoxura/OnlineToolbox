import allIcons from '../icons.js'
import { downloadText } from './download.js'

let generatedId = 0
const choiceScrollObservers = new WeakMap()

// Icons used by the result-section toolbar (sized by .btn-icon svg rules).
const resultIcons = {
  copy: allIcons.copy,
  download: allIcons.download,
  wrap: allIcons.wrap,
  collapse: allIcons.collapse,
  expand: allIcons.expand
}

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

// --- Two-column input/output layout ---------------------------------------
// Heuristic split that runs right after a tool renders, before
// enhanceFormAccessibility. It never edits tool files: it reads the rendered
// top-level structure and, when a tool looks like "input → output", wraps the
// leading input run and the trailing output section into a `.tool-io-grid`.
// Tools that already have a custom/multi-panel/scroll layout are skipped.

// Signals that a tool already manages its own layout (or has no IO pair).
// NOTE: dynamic ".tool-stack" containers are NOT listed here on purpose — a
// runtime-filled result stack has no read-only output section at the top level,
// so the heuristic below already skips it naturally. Listing ".tool-stack" by
// name would also kill genuine IO tools (json-yaml) that merely use the class
// for vertical spacing somewhere inside.
const IO_SKIP_SELECTOR = [
  '.grid-2', '.calc-grid', '.diff-output', '.markdown-preview', '.drop-area',
  'canvas.qrcode-canvas', 'pre.code-block', '.img-preview-wrap',
  '.color-picker-wrap', '.json-tree-container', '.permission-grid', '.tab-layout'
].join(',')

// A top-level node counts as an "output" when it holds a read-only textarea /
// result box / result table, OR when it is a `.tool-section` with no editable
// field inside — i.e. a pure display section (char-count stats, radix result),
// whose body is filled at runtime and therefore has no readonly marker yet.
function isOutputNode(node) {
  if (node.nodeType !== 1) return false
  if (node.matches('textarea[readonly], .result-box, .result-table') ||
      node.querySelector('textarea[readonly], .result-box, .result-table')) return true
  if (node.matches('.tool-section') &&
      !node.querySelector('textarea:not([readonly]), input:not([type="checkbox"]):not([readonly]), select')) return true
  return false
}

// A top-level node starts the "input" run only if it IS or holds an EDITABLE
// textarea — the split exists so a large pasted input sits beside its result.
// Lookup/reference tables, generators and calculators have no such textarea
// (their inputs are search boxes / selects / config rows), so requiring a real
// textarea keeps them full-width instead of squeezing a big result into a
// narrow right column. Several crypto tools append a bare <textarea> sibling,
// so we check the node itself as well as its descendants.
function hasEditableTextarea(node) {
  if (node.nodeType !== 1) return false
  return Boolean(node.matches('textarea:not([readonly])') || node.querySelector('textarea:not([readonly])'))
}

export function applyTwoColumnLayout(container) {
  if (!container || container.dataset.ioLayout) return false
  if (container.querySelector(IO_SKIP_SELECTOR)) return false

  const children = [...container.children]
  if (children.length < 2) return false

  // The output is the LAST top-level node that looks like a result.
  let outputIndex = -1
  for (let i = children.length - 1; i >= 0; i--) {
    if (isOutputNode(children[i])) { outputIndex = i; break }
  }
  if (outputIndex < 0) return false

  // The input run starts at the FIRST node before the output that holds an
  // editable textarea.
  let inputIndex = -1
  for (let i = 0; i < outputIndex; i++) {
    if (hasEditableTextarea(children[i])) { inputIndex = i; break }
  }
  if (inputIndex < 0) return false

  // Everything strictly before the input run (e.g. a mode segmented group that
  // should span full width above the split) stays put.
  const head = children.slice(0, inputIndex)
  const inputNodes = children.slice(inputIndex, outputIndex)
  const outputNodes = children.slice(outputIndex)
  if (!inputNodes.length || !outputNodes.length) return false

  const grid = createElement('div', { className: 'tool-io-grid' })
  const inputCol = createElement('div', { className: 'tool-io-col tool-io-input' })
  const outputCol = createElement('div', { className: 'tool-io-col tool-io-output' })
  inputCol.append(...inputNodes)
  outputCol.append(...outputNodes)

  // When both sides hold a textarea, offer a swap control between the columns:
  // it pushes the output back into the input and re-runs the tool. For a
  // two-way tool (a binary encode/decode segmented toggle) it also flips the
  // direction, so "swap" really means "convert the result back".
  const inputTA = inputCol.querySelector('textarea:not([readonly])')
  const outputTA = outputCol.querySelector('textarea[readonly]')
  if (inputTA && outputTA) {
    const swapBtn = createElement('button', {
      className: 'io-swap-btn',
      type: 'button',
      title: '交换输入与输出',
      'aria-label': '交换输入与输出',
      innerHTML: allIcons.swap,
      onClick: () => {
        // Capture the output BEFORE flipping direction — flipping re-runs the
        // tool on the old input and would clobber the output we want to reuse.
        const outValue = outputTA.value
        // Flip a binary direction toggle so the refilled input converts back.
        const seg = container.querySelector('.segmented-group[role="radiogroup"]')
        if (seg) {
          const radios = [...seg.querySelectorAll('[role="radio"]')]
          if (radios.length === 2) {
            radios.find(r => r.getAttribute('aria-checked') !== 'true')?.click()
          }
        }
        inputTA.value = outValue
        inputTA.dispatchEvent(new Event('input', { bubbles: true }))
        inputTA.focus()
      }
    })
    const swapCol = createElement('div', { className: 'tool-io-swap' }, [swapBtn])
    grid.append(inputCol, swapCol, outputCol)
    grid.classList.add('has-swap')
  } else {
    grid.append(inputCol, outputCol)
  }

  // Reassemble: leading full-width nodes, then the split grid.
  container.append(...head, grid)
  container.dataset.ioLayout = 'split'
  return true
}

// --- Result section toolbar (copy / download / wrap / collapse) ------------
// Injected into every "output" tool-section after render. Purely additive and
// idempotent — existing per-tool copy buttons are detected and left alone.

function resultContentOf(section) {
  const textarea = section.querySelector('.tool-section-body textarea[readonly]')
  if (textarea) return () => textarea.value
  const box = section.querySelector('.tool-section-body .result-box, .tool-section-body .result-table')
  if (box) return () => box.innerText
  return null
}

function toolbarButton(icon, label, onClick) {
  return createElement('button', {
    className: 'btn-icon',
    type: 'button',
    title: label,
    'aria-label': label,
    innerHTML: icon,
    onClick
  })
}

export function enhanceResultSections(container, { toolName = 'result' } = {}) {
  if (!container) return
  const sections = container.querySelectorAll('.tool-section')
  sections.forEach(section => {
    if (section.dataset.resultEnhanced) return
    const getContent = resultContentOf(section)
    if (!getContent) return

    const header = section.querySelector(':scope > .tool-section-header')
    const body = section.querySelector(':scope > .tool-section-body')
    if (!header || !body) return

    let group = header.querySelector(':scope > .btn-group')
    if (!group) {
      group = createElement('div', { className: 'btn-group' })
      header.appendChild(group)
    }

    // Copy — only when the tool didn't already provide one for this section.
    if (!group.querySelector('.btn-icon[title="复制"], .btn-icon[aria-label^="复制"]')) {
      group.appendChild(toolbarButton(resultIcons.copy, '复制', () => copyToClipboard(getContent())))
    }

    // Download.
    const filename = `${toolName.replace(/\s+/g, '-').toLowerCase() || 'result'}.txt`
    group.appendChild(toolbarButton(resultIcons.download, '下载为文件', () => downloadText(filename, getContent())))

    // Wrap toggle (only meaningful for a result box / pre-wrap content).
    const box = body.querySelector('.result-box')
    if (box) {
      const wrapBtn = toolbarButton(resultIcons.wrap, '切换自动换行', () => {
        const nowrap = box.classList.toggle('nowrap')
        wrapBtn.classList.toggle('active', nowrap)
        wrapBtn.setAttribute('aria-pressed', String(nowrap))
      })
      wrapBtn.setAttribute('aria-pressed', 'false')
      group.appendChild(wrapBtn)

      // Collapse / expand for long results.
      const collapseBtn = toolbarButton(resultIcons.collapse, '折叠结果', () => {
        const collapsed = box.classList.toggle('collapsed')
        collapseBtn.innerHTML = collapsed ? resultIcons.expand : resultIcons.collapse
        const label = collapsed ? '展开结果' : '折叠结果'
        collapseBtn.title = label
        collapseBtn.setAttribute('aria-label', label)
        collapseBtn.setAttribute('aria-expanded', String(!collapsed))
      })
      collapseBtn.setAttribute('aria-expanded', 'true')
      group.appendChild(collapseBtn)
    }

    section.dataset.resultEnhanced = 'true'
  })
}

