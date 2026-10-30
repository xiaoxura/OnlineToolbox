import { describe, expect, it } from 'vitest'
import { convertBatch, convertChinese } from '../src/tools/text/zh-convert.js'

describe('zh-convert edge cases', () => {
  it('converts batches line by line and keeps empty lines', async () => {
    await expect(convertBatch(['汉字', '', '测试'])).resolves.toEqual(['漢字', '', '測試'])
  })

  it('validates direction and variant before loading the dictionary', async () => {
    await expect(convertBatch('not-an-array')).rejects.toThrow(/字符串数组/)
    await expect(convertChinese('汉字', { direction: 'x2y' })).rejects.toThrow(/不支持的转换方向/)
    await expect(convertChinese('汉字', { variant: 'xx' })).rejects.toThrow(/不支持的转换变体/)
  })

  it('returns an empty string for empty input without loading OpenCC', async () => {
    await expect(convertChinese('')).resolves.toBe('')
  })

  it('supports t2s and the Taiwan variant', async () => {
    await expect(convertChinese('漢字', { direction: 't2s' })).resolves.toBe('汉字')
    await expect(convertChinese('汉语', { variant: 'tw' })).resolves.toBeTruthy()
  })
})
