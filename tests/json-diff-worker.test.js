import { describe, expect, it } from 'vitest'
import { diffJson } from '../src/tools/converter/json-diff.js'

describe('json diff worker payload', () => {
  it('accepts the single-array form used by runInWorker', () => {
    const diffs = diffJson(['{"a":1}', '{"a":2}'])
    expect(diffs).toEqual([{ type: 'changed', path: 'a', oldValue: 1, newValue: 2 }])
  })

  it('still accepts two strings and reports parse errors per side', () => {
    expect(diffJson('{"a":1}', '{"a":1}')).toEqual([])
    expect(() => diffJson('{bad', '{}')).toThrow(/原始 JSON 解析失败/)
    expect(() => diffJson('{}', '{bad')).toThrow(/修改后 JSON 解析失败/)
  })
})
