import { afterEach, describe, expect, it } from 'vitest'
import { closeToolPicker, openToolPicker } from '../src/app/tool-picker.js'
import { setupCommandPalette } from '../src/app/command-palette.js'

function search(input, value) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function press(key) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

afterEach(() => {
  closeToolPicker()
  document.body.replaceChildren()
  window.location.hash = ''
})

describe('tool picker / command palette', () => {
  it('opens a listbox and searches by pinyin initials', () => {
    const selected = []
    openToolPicker({ onSelect: tool => selected.push(tool.id) })
    const panel = document.querySelector('.tool-picker-panel')
    expect(panel).not.toBeNull()
    expect(panel.getAttribute('role')).toBe('dialog')
    const input = panel.querySelector('.tool-picker-input')
    search(input, 'sjc')
    const options = [...panel.querySelectorAll('.tool-picker-option')]
    expect(options[0].dataset.toolId).toBe('timestamp')
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    press('Enter')
    expect(selected).toEqual(['timestamp'])
    expect(document.querySelector('.tool-picker-overlay')).toBeNull()
  })

  it('supports arrow navigation and excludes the source tool', () => {
    const selected = []
    openToolPicker({ exclude: ['json'], onSelect: tool => selected.push(tool.id) })
    const input = document.querySelector('.tool-picker-input')
    search(input, 'json')
    const ids = [...document.querySelectorAll('.tool-picker-option')].map(option => option.dataset.toolId)
    expect(ids).not.toContain('json')
    press('ArrowDown')
    const active = document.querySelector('.tool-picker-option[aria-selected="true"]')
    expect(active.dataset.toolId).toBe(ids[1])
    press('ArrowUp')
    expect(document.querySelector('.tool-picker-option[aria-selected="true"]').dataset.toolId).toBe(ids[0])
  })

  it('closes on Escape and on a backdrop click', () => {
    openToolPicker()
    press('Escape')
    expect(document.querySelector('.tool-picker-overlay')).toBeNull()

    openToolPicker()
    const overlay = document.querySelector('.tool-picker-overlay')
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(document.querySelector('.tool-picker-overlay')).toBeNull()
  })

  it('opens from Ctrl+K on any page and navigates on Enter', () => {
    setupCommandPalette()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    const panel = document.querySelector('.tool-picker-panel')
    expect(panel).not.toBeNull()
    expect(panel.querySelector('.tool-picker-title').textContent).toBe('命令面板')
    search(panel.querySelector('.tool-picker-input'), 'sjc')
    press('Enter')
    expect(window.location.hash).toBe('#/timestamp')
  })

  it('shows an empty state for an unmatched query', () => {
    openToolPicker()
    const input = document.querySelector('.tool-picker-input')
    search(input, 'zzzz-not-a-tool')
    expect(document.querySelector('.tool-picker-empty').hidden).toBe(false)
    expect(document.querySelectorAll('.tool-picker-option')).toHaveLength(0)
  })
})
