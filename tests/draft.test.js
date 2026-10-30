import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDraft, setupDraftPersistence } from '../src/app/draft.js'

function makeContainer() {
  const container = document.createElement('div')
  container.innerHTML = ''
  const textarea = document.createElement('textarea')
  textarea.className = 'textarea'
  textarea.setAttribute('aria-label', '输入')
  const input = document.createElement('input')
  input.className = 'input'
  input.type = 'text'
  input.setAttribute('aria-label', '关键词')
  const readonly = document.createElement('textarea')
  readonly.readOnly = true
  container.append(textarea, input, readonly)
  document.body.replaceChildren(container)
  return { container, textarea, input }
}

function type(field, value) {
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

function draft(toolId) {
  return JSON.parse(sessionStorage.getItem(`toolbox:draft:${toolId}`) || 'null')
}

beforeEach(() => {
  sessionStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('draft persistence', () => {
  it('saves editable fields after the debounce and never includes readonly outputs', () => {
    const { container, textarea, input } = makeContainer()
    const cleanup = setupDraftPersistence(container, 'json')
    type(textarea, '{"a":1}')
    type(input, 'hello')
    vi.advanceTimersByTime(500)
    const saved = draft('json')
    expect(saved.toolId).toBe('json')
    expect(saved.values).toMatchObject({ '0': '{"a":1}', '1': 'hello' })
    expect(Object.keys(saved.values)).toHaveLength(2)
    cleanup()
  })

  it('restores values into a freshly rendered tool and shows a notice', () => {
    const first = makeContainer()
    const cleanup = setupDraftPersistence(first.container, 'json')
    type(first.textarea, '{"draft":true}')
    vi.advanceTimersByTime(500)
    cleanup()

    const second = makeContainer()
    setupDraftPersistence(second.container, 'json')
    expect(second.textarea.value).toBe('{"draft":true}')
    expect(second.container.querySelector('.draft-notice')).not.toBeNull()
    expect(second.container.querySelector('.draft-notice').textContent).toContain('已恢复上次输入')
  })

  it('clears the saved draft from the notice button', () => {
    const first = makeContainer()
    setupDraftPersistence(first.container, 'json')
    type(first.textarea, '{"x":1}')
    vi.advanceTimersByTime(500)

    const second = makeContainer()
    setupDraftPersistence(second.container, 'json')
    second.container.querySelector('.draft-clear').click()
    expect(second.textarea.value).toBe('')
    expect(draft('json')).toBeNull()
  })

  it('does not persist or restore sensitive tools', () => {
    const first = makeContainer()
    setupDraftPersistence(first.container, 'aes')
    type(first.textarea, 'secret')
    vi.advanceTimersByTime(500)
    expect(draft('aes')).toBeNull()

    const second = makeContainer()
    setupDraftPersistence(second.container, 'aes')
    expect(second.textarea.value).toBe('')
  })

  it('removes a draft when every field is emptied', () => {
    const { container, textarea } = makeContainer()
    const cleanup = setupDraftPersistence(container, 'json')
    type(textarea, 'text')
    vi.advanceTimersByTime(500)
    expect(draft('json')).not.toBeNull()
    type(textarea, '')
    vi.advanceTimersByTime(500)
    expect(draft('json')).toBeNull()
    cleanup()
  })

  it('saves synchronously on teardown when navigating away', () => {
    const { container, textarea } = makeContainer()
    const cleanup = setupDraftPersistence(container, 'json')
    type(textarea, 'unsaved')
    cleanup()
    expect(draft('json').values['0']).toBe('unsaved')
  })

  it('clearDraft removes the stored entry', () => {
    const { container, textarea } = makeContainer()
    const cleanup = setupDraftPersistence(container, 'json')
    type(textarea, 'x')
    vi.advanceTimersByTime(500)
    clearDraft('json')
    expect(draft('json')).toBeNull()
    cleanup()
  })
})
