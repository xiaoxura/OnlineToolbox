import { describe, expect, it } from 'vitest'
import { buildInfo, formatBuildTime, formatBuildTitle } from '../src/build-info.js'

describe('build info', () => {
  it('falls back to an empty descriptor outside Vite', () => {
    expect(buildInfo).toMatchObject({
      builtAt: '',
      commit: '',
      commitShort: '',
      commitDate: '',
      branch: ''
    })
  })

  it('formats the build timestamp in Beijing time', () => {
    expect(formatBuildTime('2026-10-30T06:20:22.000Z')).toBe('2026-10-30 14:20')
    expect(formatBuildTime('2026-01-01T16:05:00.000Z')).toBe('2026-01-02 00:05')
  })

  it('honours an explicit time zone', () => {
    expect(formatBuildTime('2026-10-30T06:20:22.000Z', 'UTC')).toBe('2026-10-30 06:20')
  })

  it('returns an empty string for missing or invalid timestamps', () => {
    expect(formatBuildTime('')).toBe('')
    expect(formatBuildTime('not-a-date')).toBe('')
  })

  it('includes the commit in the tooltip text', () => {
    expect(formatBuildTitle({ builtAt: '2026-10-30T06:20:22.000Z', commitShort: '9981243' }))
      .toBe('构建于 2026-10-30 14:20（北京时间） · 提交 9981243')
    expect(formatBuildTitle({ builtAt: '2026-10-30T06:20:22.000Z' }))
      .toBe('构建于 2026-10-30 14:20（北京时间）')
  })
})
