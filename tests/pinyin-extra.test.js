import { describe, expect, it } from 'vitest'
import { toPinyin } from '../src/tools/text/pinyin.js'

describe('pinyin edge cases', () => {
  it('keeps non-Chinese text and handles empty input', async () => {
    await expect(toPinyin('')).resolves.toBe('')
    await expect(toPinyin('Hello 123')).resolves.toContain('Hello')
  })

  it('supports first-reading style and tone marks', async () => {
    const first = await toPinyin('重庆', { style: 'first' })
    expect(typeof first).toBe('string')
    const toned = await toPinyin('你好', { tone: true })
    expect(toned).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/)
  })

  it('uses a custom separator', async () => {
    const output = await toPinyin('你好世界', { separator: '-' })
    expect(output).toContain('-')
  })
})
