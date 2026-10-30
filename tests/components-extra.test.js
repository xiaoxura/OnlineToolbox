import { describe, expect, it, vi } from 'vitest'
import { createCopyButton, createSection, createTableScroll, flashCopied } from '../src/utils/dom.js'

describe('shared DOM components', () => {
  it('restores a copy button after the success flash', () => {
    vi.useFakeTimers()
    const button = createCopyButton(() => 'text')
    const original = button.innerHTML
    flashCopied(button)
    expect(button.classList.contains('copied')).toBe(true)
    vi.advanceTimersByTime(1300)
    expect(button.classList.contains('copied')).toBe(false)
    expect(button.innerHTML).toBe(original)
    vi.useRealTimers()
  })

  it('does nothing when flashing a missing button', () => {
    expect(() => flashCopied(null)).not.toThrow()
  })

  it('wraps sections with an accessible heading and actions', () => {
    const action = document.createElement('button')
    action.textContent = '复制'
    const section = createSection('结果', document.createElement('pre'), [action])
    expect(section.tagName).toBe('SECTION')
    const heading = section.querySelector('h2')
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id)
    expect(section.querySelector('.btn-group').children).toHaveLength(1)
  })

  it('moves a table into a focusable scroll region', () => {
    const table = document.createElement('table')
    document.body.replaceChildren(table)
    const wrapper = createTableScroll(table, '数据表')
    expect(wrapper.contains(table)).toBe(true)
    expect(wrapper.getAttribute('tabindex')).toBe('0')
    expect(wrapper.getAttribute('role')).toBe('region')
    expect(wrapper.getAttribute('aria-label')).toBe('数据表')
  })
})
