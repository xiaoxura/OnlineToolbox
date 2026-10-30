import { afterEach, describe, expect, it } from 'vitest'
import { mountTool, clickText, errorText, outputValue, setValue } from './helpers/tool-harness.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('json-lines error branches', () => {
  it('reports the offending line for invalid JSONL', async () => {
    const container = await mountTool('json-lines')
    setValue(container.querySelector('textarea:not([readonly])'), '{"a":1}\n{bad}\n')
    clickText(container, '转换')
    expect(errorText(container)).toContain('第 2 行不是有效 JSON')
  })

  it('requires an array in JSON to JSONL mode', async () => {
    const container = await mountTool('json-lines')
    clickText(container, 'JSON → JSONL')
    setValue(container.querySelector('textarea:not([readonly])'), '{"a":1}')
    clickText(container, '转换')
    expect(errorText(container)).toContain('JSON 输入必须是数组')
  })

  it('round-trips an array with blank input producing empty output', async () => {
    const container = await mountTool('json-lines')
    clickText(container, 'JSON → JSONL')
    setValue(container.querySelector('textarea:not([readonly])'), '[{"a":1},{"b":2}]')
    clickText(container, '转换')
    expect(outputValue(container)).toBe('{"a":1}\n{"b":2}')
    setValue(container.querySelector('textarea:not([readonly])'), '   ')
    clickText(container, '转换')
    expect(outputValue(container)).toBe('')
  })
})
