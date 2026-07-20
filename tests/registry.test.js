import { describe, expect, it } from 'vitest'
import { categories, getToolById, getToolsByCategoryAndSearch, tools } from '../src/tools/registry.js'

describe('tool registry', () => {
  it('contains at least 100 unique and complete descriptors', () => {
    expect(tools.length).toBeGreaterThanOrEqual(100)
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length)
    const categoryIds = new Set(categories.map(category => category.id))
    for (const tool of tools) {
      expect(tool).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        icon: expect.any(String),
        load: expect.any(Function)
      })
      expect(categoryIds.has(tool.category)).toBe(true)
      expect(getToolById(tool.id)).toBe(tool)
    }
  })

  it('filters by category and case-insensitive search', () => {
    expect(getToolsByCategoryAndSearch('crypto', '')).toHaveLength(6)
    expect(getToolsByCategoryAndSearch('all', 'base64').map(tool => tool.id)).toContain('base64')
    expect(getToolsByCategoryAndSearch('converter', 'JSON')).not.toHaveLength(0)
    expect(getToolsByCategoryAndSearch('all', 'token').map(tool => tool.id)).toContain('jwt')
    expect(getToolsByCategoryAndSearch('all', 'unix time').map(tool => tool.id)).toContain('timestamp')
  })

  it('keeps lazy metadata aligned with every implementation', async () => {
    for (const descriptor of tools) {
      const { default: implementation } = await descriptor.load()
      expect(implementation.id).toBe(descriptor.id)
      expect(implementation.name).toBe(descriptor.name)
      expect(implementation.description).toBe(descriptor.description)
      expect(implementation.category).toBe(descriptor.category)
      expect(implementation.render).toEqual(expect.any(Function))
    }
  })
})
