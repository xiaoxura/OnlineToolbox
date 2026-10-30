import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearHandoff, fillHandoff, sendToTool, takeHandoff } from '../src/app/handoff.js'

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
})

describe('result handoff', () => {
  it('stores a payload addressed to the target tool', () => {
    expect(sendToTool('yaml', '{"a":1}', 'json')).toBe(true)
    expect(takeHandoff('yaml')).toEqual({ text: '{"a":1}', fromId: 'json' })
    // Consumed exactly once.
    expect(takeHandoff('yaml')).toBeNull()
  })

  it('does not hand a payload to a different tool', () => {
    sendToTool('yaml', 'x', 'json')
    expect(takeHandoff('toml')).toBeNull()
    expect(takeHandoff('yaml')).toEqual({ text: 'x', fromId: 'json' })
  })

  it('drops expired payloads', () => {
    sessionStorage.setItem('toolbox:handoff', JSON.stringify({ targetId: 'yaml', text: 'old', fromId: 'json', at: Date.now() - 11 * 60 * 1000 }))
    expect(takeHandoff('yaml')).toBeNull()
    expect(sessionStorage.getItem('toolbox:handoff')).toBeNull()
  })

  it('fills the first editable text field and fires input events', () => {
    const container = document.createElement('div')
    const textarea = document.createElement('textarea')
    const readonly = document.createElement('textarea')
    readonly.readOnly = true
    container.append(readonly, textarea)
    const events = []
    textarea.addEventListener('input', () => events.push('input'))
    textarea.addEventListener('change', () => events.push('change'))
    expect(fillHandoff(container, { text: 'payload' })).toBe(true)
    expect(textarea.value).toBe('payload')
    expect(events).toEqual(['input', 'change'])
  })

  it('returns false when the target tool has no text input', () => {
    const container = document.createElement('div')
    container.appendChild(document.createElement('canvas'))
    expect(fillHandoff(container, { text: 'x' })).toBe(false)
  })

  it('clearHandoff removes a pending payload', () => {
    sendToTool('yaml', 'x', 'json')
    clearHandoff()
    expect(takeHandoff('yaml')).toBeNull()
  })
})
