import { afterEach, describe, expect, it } from 'vitest'
import {
  countGraphemes,
  splitGraphemes,
  truncateToBytes,
  truncateWithStats,
  utf8ByteLength
} from '../src/tools/text/byte-truncate.js'

const originalSegmenter = Intl.Segmenter

afterEach(() => {
  Intl.Segmenter = originalSegmenter
})

describe('byte truncation edge cases', () => {
  it('validates the byte budget', () => {
    expect(() => truncateToBytes('x', -1)).toThrow(/非负整数/)
    expect(() => truncateToBytes('x', Number.NaN)).toThrow(/非负整数/)
  })

  it('falls back to a manual grapheme splitter without Intl.Segmenter', () => {
    Intl.Segmenter = undefined
    expect(splitGraphemes('a👨‍👩‍👧b')).toHaveLength(3)
    expect(countGraphemes('🇨🇳')).toBeGreaterThan(0)
    expect(utf8ByteLength('你好')).toBe(6)
  })

  it('falls back from a custom ellipsis to the default one and then to none', () => {
    // Only one byte of room: a 3-byte custom marker cannot fit, "…" cannot either.
    const tight = truncateToBytes('abc', 1, { ellipsis: true, ellipsisText: '...' })
    expect(tight.text).toBe('a')
    const withDefault = truncateToBytes('abc你好', 4, { ellipsis: true, ellipsisText: '........' })
    expect(withDefault.text).toBe('a…')
    const noMarker = truncateToBytes('你好', 2, { ellipsis: true, ellipsisText: '...' })
    expect(noMarker.text).not.toContain('…')
  })

  it('reports stats for tool output', () => {
    const stats = truncateWithStats('你好世界', 7)
    expect(stats.originalBytes).toBe(12)
    expect(stats.bytes).toBeLessThanOrEqual(7)
    expect(stats.removed).toBeGreaterThan(0)
  })

  it('returns the original text when it already fits', () => {
    expect(truncateToBytes('abc', 3)).toEqual({ text: 'abc', bytes: 3, removed: 0 })
    expect(truncateToBytes('', 0)).toEqual({ text: '', bytes: 0, removed: 0 })
  })
})
