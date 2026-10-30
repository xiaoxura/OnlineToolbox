// Reusable tool picker overlay. Used by the global command palette (Ctrl/⌘+K)
// and by the "send to…" action on result sections, so it must work from any
// page and be fully keyboard-operable.
import { createElement } from '../utils/dom.js'
import { categories, getToolById, getToolsByCategoryAndSearch } from '../tools/registry.js'
import icons from '../icons.js'
import { readStoredList } from './storage.js'

const MAX_RESULTS = 50

let activePicker = null

function categoryName(id) {
  return categories.find(category => category.id === id)?.name || '工具'
}

function recentFirst(list) {
  const recent = readStoredList('toolbox:recent', id => Boolean(getToolById(id)))
  const rank = new Map(recent.map((id, index) => [id, index]))
  return [...list].sort((a, b) => {
    const left = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER
    const right = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER
    return left - right
  })
}

export function isToolPickerOpen() {
  return Boolean(activePicker)
}

export function closeToolPicker() {
  activePicker?.close()
}

/**
 * Open the picker. `onSelect` receives the chosen tool descriptor.
 * Returns the same handle as `closeToolPicker`, useful for tests.
 */
export function openToolPicker({ title = '选择工具', placeholder = '搜索工具、功能或拼音…', onSelect, exclude = [] } = {}) {
  activePicker?.close()

  const previousFocus = document.activeElement
  const excluded = new Set(exclude)
  const headingId = `tool-picker-title-${Date.now()}`
  const listId = `tool-picker-list-${Date.now()}`

  const input = createElement('input', {
    className: 'tool-picker-input',
    type: 'search',
    placeholder,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': title,
    'aria-controls': listId,
    'aria-autocomplete': 'list'
  })
  const list = createElement('ul', { className: 'tool-picker-list', id: listId, role: 'listbox', 'aria-labelledby': headingId })
  const empty = createElement('div', { className: 'tool-picker-empty', textContent: '没有匹配的工具' })
  empty.hidden = true

  const panel = createElement('div', {
    className: 'tool-picker-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': headingId
  }, [
    createElement('div', { className: 'tool-picker-head' }, [
      createElement('h2', { className: 'tool-picker-title', id: headingId, textContent: title }),
      createElement('kbd', { className: 'tool-picker-kbd', textContent: 'Esc' })
    ]),
    input,
    list,
    empty,
    createElement('div', { className: 'tool-picker-foot' }, [
      createElement('span', { textContent: '↑ ↓ 选择' }),
      createElement('span', { textContent: 'Enter 打开' }),
      createElement('span', { textContent: 'Esc 关闭' })
    ])
  ])
  const overlay = createElement('div', { className: 'tool-picker-overlay' }, [panel])
  document.body.appendChild(overlay)

  let results = []
  let selected = 0
  let closed = false

  function optionId(index) {
    return `${listId}-option-${index}`
  }

  function render(query) {
    const searched = query
      ? getToolsByCategoryAndSearch('all', query)
      : recentFirst(getToolsByCategoryAndSearch('all', ''))
    results = searched.filter(tool => !excluded.has(tool.id)).slice(0, MAX_RESULTS)
    selected = 0
    list.replaceChildren(...results.map((tool, index) => createElement('li', {
      className: 'tool-picker-option',
      id: optionId(index),
      role: 'option',
      'aria-selected': String(index === 0),
      'data-tool-id': tool.id
    }, [
      createElement('span', { className: 'tool-picker-icon', innerHTML: icons[tool.icon] || icons.wrench, 'aria-hidden': 'true' }),
      createElement('span', { className: 'tool-picker-copy' }, [
        createElement('span', { className: 'tool-picker-name', textContent: tool.name }),
        createElement('span', { className: 'tool-picker-desc', textContent: tool.description })
      ]),
      createElement('span', { className: 'tool-picker-category', textContent: categoryName(tool.category) })
    ])))
    empty.hidden = results.length > 0
    input.setAttribute('aria-expanded', String(results.length > 0))
    syncSelection()
  }

  function syncSelection() {
    const options = [...list.children]
    options.forEach((option, index) => {
      option.setAttribute('aria-selected', String(index === selected))
      option.classList.toggle('is-active', index === selected)
    })
    const current = options[selected]
    if (current) {
      input.setAttribute('aria-activedescendant', current.id)
      current.scrollIntoView?.({ block: 'nearest' })
    } else {
      input.removeAttribute('aria-activedescendant')
    }
  }

  function choose(index) {
    if (closed) return
    const tool = results[index]
    if (!tool) return
    close()
    onSelect?.(tool)
  }

  function close() {
    if (closed) return
    closed = true
    overlay.remove()
    document.removeEventListener('keydown', onKeydown, true)
    activePicker = null
    previousFocus?.focus?.()
  }

  function move(delta) {
    if (!results.length) return
    selected = (selected + delta + results.length) % results.length
    syncSelection()
  }

  function onKeydown(event) {
    if (closed) return
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      choose(selected)
      return
    }
    if (event.key === 'Tab') {
      // Focus stays in the dialog; there is only one focusable field.
      event.preventDefault()
      input.focus()
    }
  }

  input.addEventListener('input', () => render(input.value.trim()))
  overlay.addEventListener('mousedown', event => {
    if (event.target === overlay) close()
  })
  list.addEventListener('click', event => {
    const option = event.target.closest('.tool-picker-option')
    if (!option) return
    const index = [...list.children].indexOf(option)
    choose(index)
  })
  list.addEventListener('mousemove', event => {
    const option = event.target.closest('.tool-picker-option')
    if (!option) return
    const index = [...list.children].indexOf(option)
    if (index !== selected) {
      selected = index
      syncSelection()
    }
  })
  document.addEventListener('keydown', onKeydown, true)

  render('')
  requestAnimationFrame(() => input.focus())

  const handle = { close, select: choose, get results() { return results } }
  activePicker = handle
  return handle
}
