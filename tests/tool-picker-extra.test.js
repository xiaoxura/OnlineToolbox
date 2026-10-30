import { afterEach, describe, expect, it } from 'vitest'
import { closeToolPicker, openToolPicker } from '../src/app/tool-picker.js'

afterEach(() => {
  closeToolPicker()
  document.body.replaceChildren()
})

describe('tool picker interaction details', () => {
  it('follows the pointer and keeps Tab focus inside the dialog', () => {
    openToolPicker()
    const options = [...document.querySelectorAll('.tool-picker-option')]
    options[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    expect(options[2].getAttribute('aria-selected')).toBe('true')
    const input = document.querySelector('.tool-picker-input')
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    input.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(input)
  })

  it('closes idempotently and ignores options after closing', () => {
    const handle = openToolPicker({ onSelect: () => { throw new Error('should not fire') } })
    handle.close()
    handle.close()
    expect(document.querySelector('.tool-picker-overlay')).toBeNull()
    handle.select(0)
  })
})
