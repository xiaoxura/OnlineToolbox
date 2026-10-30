import { createElement, nextId } from './core.js'

const choiceScrollObservers = new WeakMap()

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
  const tabSetId = nextId('tool-tabs')
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

export function enhanceChoiceScrolling(group) {
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

export function cleanupChoiceScrolling(root = document) {
  const groups = root.matches?.('.tab-group, .segmented-group, .filter-group')
    ? [root]
    : [...root.querySelectorAll('.tab-group, .segmented-group, .filter-group')]
  groups.forEach(group => {
    choiceScrollObservers.get(group)?.disconnect()
    choiceScrollObservers.delete(group)
  })
}
