import { describe, expect, it, vi } from 'vitest'
import {
  cleanupFormAccessibility,
  createElement,
  createFilterGroup,
  createSection,
  createSegmentedGroup,
  createTabGroup,
  enhanceFormAccessibility
} from '../src/utils/dom.js'

describe('shared tool page UI', () => {
  it('normalizes legacy section content into the padded body', () => {
    const root = document.createElement('main')
    const section = createSection('Legacy section')
    const control = createElement('input', { className: 'input', placeholder: 'Value' })
    section.appendChild(control)
    root.appendChild(section)

    enhanceFormAccessibility(root)

    expect(section.querySelector(':scope > .tool-section-body')?.contains(control)).toBe(true)
  })

  it('gives aria-labelled fields stable ids for browser autofill', () => {
    const root = document.createElement('main')
    const field = createElement('textarea', { 'aria-label': '内容' })
    const label = createElement('label', { textContent: '格式' })
    const select = createElement('select', { 'aria-label': '输入格式' })
    root.append(field, createElement('div', { className: 'form-group' }, [label, select]))

    enhanceFormAccessibility(root)

    expect(field.id).toMatch(/^tool-field-/)
    expect(label.htmlFor).toBe(select.id)
  })

  it('normalizes and wraps result tables without changing table semantics', () => {
    const root = document.createElement('main')
    const table = createElement('table', { className: 'result-box' })
    root.appendChild(table)

    enhanceFormAccessibility(root)

    expect(table.tagName).toBe('TABLE')
    expect(table.classList.contains('result-table')).toBe(true)
    expect(table.parentElement?.classList.contains('table-scroll')).toBe(true)
  })

  it('links reusable tabs to external tab panels', () => {
    const root = document.createElement('main')
    const tabs = createTabGroup([{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }])
    const firstPanel = createElement('div', { className: 'tab-panel active' })
    const secondPanel = createElement('div', { className: 'tab-panel' })
    root.append(tabs, firstPanel, secondPanel)

    enhanceFormAccessibility(root)

    const buttons = tabs.querySelectorAll('[role="tab"]')
    expect(buttons[0].getAttribute('aria-controls')).toBe(firstPanel.id)
    expect(firstPanel.getAttribute('aria-labelledby')).toBe(buttons[0].id)
    expect(secondPanel.getAttribute('role')).toBe('tabpanel')
  })

  it('switches real tab panels with roving keyboard focus', () => {
    const changes = []
    const tabs = createTabGroup([
      { label: 'A', value: 'a', content: panel => panel.append('Panel A') },
      { label: 'B', value: 'b', content: panel => panel.append('Panel B') }
    ], value => changes.push(value))
    document.body.replaceChildren(tabs.element)

    const buttons = [...tabs.querySelectorAll('[role="tab"]')]
    const panels = [...tabs.element.querySelectorAll('[role="tabpanel"]')]
    buttons[0].focus()
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))

    expect(buttons[1].getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(buttons[1])
    expect(panels[0].hidden).toBe(true)
    expect(panels[1].hidden).toBe(false)
    expect(changes).toEqual(['b'])
  })

  it('exposes segmented choices and filters with distinct state semantics', () => {
    const segmented = createSegmentedGroup([
      { label: 'JSON', value: 'json' },
      { label: 'YAML', value: 'yaml' }
    ])
    const filters = createFilterGroup([
      { label: '全部', value: '' },
      { label: '4xx', value: '4' }
    ])
    document.body.replaceChildren(segmented, filters)

    segmented.setValue('yaml')
    filters.querySelectorAll('button')[1].click()

    expect(segmented.getAttribute('role')).toBe('radiogroup')
    expect(segmented.querySelector('[aria-checked="true"]')?.dataset.value).toBe('yaml')
    expect(filters.getAttribute('role')).toBe('group')
    expect(filters.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1)
    expect(filters.querySelector('[aria-pressed="true"]')?.dataset.value).toBe('4')
  })

  it('disconnects choice observers before a tool page is removed', () => {
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() { disconnect() }
    })

    try {
      const root = document.createElement('main')
      root.appendChild(createSegmentedGroup([
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' }
      ]))

      enhanceFormAccessibility(root)
      cleanupFormAccessibility(root)

      expect(disconnect).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('renders image upload and large canvas controls responsively', async () => {
    const uploadRoot = document.createElement('main')
    const canvasRoot = document.createElement('main')
    const [{ default: uploadTool }, { default: placeholderTool }] = await Promise.all([
      import('../src/tools/image/img-to-base64.js'),
      import('../src/tools/generator/placeholder-img.js')
    ])

    document.body.replaceChildren(uploadRoot, canvasRoot)
    uploadTool.render(uploadRoot)
    placeholderTool.render(canvasRoot)

    expect(uploadRoot.querySelector('.drop-area')?.tagName).toBe('BUTTON')
    expect(canvasRoot.querySelector('canvas')?.classList.contains('placeholder-canvas')).toBe(true)
  })
})
