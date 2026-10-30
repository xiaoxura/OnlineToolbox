import { describe, expect, it } from 'vitest'
import { getRelatedTools, getToolsByCategoryAndSearch, tools } from '../src/tools/registry.js'

describe('pinyin search', () => {
  it('matches pinyin initials and full spellings', () => {
    expect(getToolsByCategoryAndSearch('all', 'sjc')[0].id).toBe('timestamp')
    const regexResults = getToolsByCategoryAndSearch('all', 'zhengze').map(tool => tool.id)
    expect(regexResults).toContain('regex')
    expect(getToolsByCategoryAndSearch('all', 'jianfan').map(tool => tool.id)).toContain('zh-convert')
  })

  it('keeps keyword and description matches working', () => {
    expect(getToolsByCategoryAndSearch('all', 'token').map(tool => tool.id)).toContain('jwt')
    expect(getToolsByCategoryAndSearch('all', 'unix time').map(tool => tool.id)).toContain('timestamp')
    expect(getToolsByCategoryAndSearch('converter', 'JSON').length).toBeGreaterThan(0)
  })

  it('tolerates a small typo when the exact search finds nothing', () => {
    expect(getToolsByCategoryAndSearch('all', 'jsonn').map(tool => tool.id)).toContain('json')
    expect(getToolsByCategoryAndSearch('all', 'timestmp').map(tool => tool.id)).toContain('timestamp')
    expect(getToolsByCategoryAndSearch('all', 'zzzz')).toHaveLength(0)
    expect(getToolsByCategoryAndSearch('all', 'unix tme')).toHaveLength(0)
  })

  it('ships a pinyin entry for every tool', async () => {
    const { searchPinyin } = await import('../src/tools/search-index.js')
    for (const tool of tools) {
      expect(searchPinyin[tool.id], `missing pinyin for ${tool.id}`).toBeTruthy()
    }
  })
})

describe('related tools', () => {
  it('prefers hand-picked neighbours over same-category order', () => {
    const related = getRelatedTools({ id: 'json', category: 'formatter', keywords: [], name: 'JSON' }, 6)
    const ids = related.map(tool => tool.id)
    expect(ids).toContain('json-yaml')
    expect(ids).not.toContain('css')
  })

  it('never includes the tool itself and respects the limit', () => {
    const json = tools.find(tool => tool.id === 'json')
    const related = getRelatedTools(json, 4)
    expect(related.length).toBeLessThanOrEqual(4)
    expect(related.some(tool => tool.id === 'json')).toBe(false)
  })

  it('falls back to keyword overlap for tools without a manual list', () => {
    const tool = tools.find(item => item.id === 'htpasswd-generator')
    const ids = getRelatedTools(tool, 6).map(item => item.id)
    expect(ids).toContain('bcrypt')
  })
})
