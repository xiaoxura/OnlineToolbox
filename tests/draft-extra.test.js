import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupDraftPersistence } from '../src/app/draft.js'

beforeEach(() => {
  sessionStorage.clear()
})

describe('draft persistence edge cases', () => {
  it('ignores fields opted out with data-draft=off', () => {
    const container = document.createElement('div')
    const textarea = document.createElement('textarea')
    const hidden = document.createElement('textarea')
    hidden.dataset.draft = 'off'
    container.append(textarea, hidden)
    document.body.replaceChildren(container)
    vi.useFakeTimers()
    setupDraftPersistence(container, 'json')
    textarea.value = 'keep'
    hidden.value = 'skip'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    vi.advanceTimersByTime(500)
    const saved = JSON.parse(sessionStorage.getItem('toolbox:draft:json'))
    expect(Object.values(saved.values)).toEqual(['keep'])
    vi.useRealTimers()
  })

  it('discards corrupt drafts without throwing', () => {
    sessionStorage.setItem('toolbox:draft:json', '{not json')
    const container = document.createElement('div')
    container.appendChild(document.createElement('textarea'))
    document.body.replaceChildren(container)
    expect(() => setupDraftPersistence(container, 'json')).not.toThrow()
    expect(sessionStorage.getItem('toolbox:draft:json')).toBeNull()
  })

  it('does nothing without fields or tool id', () => {
    const container = document.createElement('div')
    document.body.replaceChildren(container)
    expect(setupDraftPersistence(container, 'json')()).toBeUndefined()
    expect(setupDraftPersistence(null, 'json')()).toBeUndefined()
    expect(setupDraftPersistence(container, '')()).toBeUndefined()
  })
})
