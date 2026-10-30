import { afterEach, describe, expect, it } from 'vitest'
import { mountTool, clickText, errorText, setValue } from './helpers/tool-harness.js'
import { parseChatMessages } from '../src/tools/ai/token-counter.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('token counter chat parsing', () => {
  it('accepts a message array or an object with messages', () => {
    expect(parseChatMessages('[{"role":"user","content":"hi"}]')).toEqual([{ role: 'user', content: 'hi' }])
    expect(parseChatMessages('{"messages":[{"role":"system"}]}')).toEqual([{ role: 'system', content: '' }])
  })

  it('reports every malformed shape with a readable message', () => {
    expect(() => parseChatMessages('not json')).toThrow(/不是合法的 JSON/)
    expect(() => parseChatMessages('{}')).toThrow(/需要一个消息数组/)
    expect(() => parseChatMessages('[]')).toThrow(/消息数组为空/)
    expect(() => parseChatMessages('[1]')).toThrow(/不是对象/)
    expect(() => parseChatMessages('[{"content":"x"}]')).toThrow(/缺少 role/)
    expect(() => parseChatMessages('[{"role":"wizard"}]')).toThrow(/role 无效/)
    expect(() => parseChatMessages('[{"role":"user","content":1}]')).toThrow(/content 需要是字符串/)
  })
})

describe('token counter UI error branches', () => {
  it('shows an error for invalid chat JSON instead of a count', async () => {
    const container = await mountTool('token-counter')
    clickText(container, '对话消息')
    const input = container.querySelector('textarea:not([readonly])')
    setValue(input, 'not json')
    clickText(container, '计算 Token')
    expect(errorText(container)).toContain('不是合法的 JSON')
  })

  it('does nothing for whitespace-only input', async () => {
    const container = await mountTool('token-counter')
    const input = container.querySelector('textarea:not([readonly])')
    setValue(input, '   ')
    clickText(container, '计算 Token')
    expect(container.querySelector('.stats-row').children).toHaveLength(0)
  })
})
