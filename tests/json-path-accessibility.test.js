import { describe, expect, it } from 'vitest'
import jsonPathTool from '../src/tools/converter/json-path.js'

describe('JSONPath tree accessibility', () => {
  it('keeps selection and expansion as sibling buttons with linked regions', () => {
    const root = document.createElement('main')
    jsonPathTool.render(root)
    const sampleButton = [...root.querySelectorAll('button')].find(button => button.textContent === '示例数据')

    expect(sampleButton).toBeDefined()
    sampleButton?.click()

    expect(root.querySelector('button button')).toBeNull()
    expect(root.querySelector('.json-tree-node[role="button"]')).toBeNull()
    expect(root.querySelector('.json-node-select')?.tagName).toBe('BUTTON')

    const toggles = [...root.querySelectorAll('.json-toggle')]
    expect(toggles.length).toBeGreaterThan(0)
    expect(new Set(toggles.map(toggle => toggle.getAttribute('aria-controls'))).size).toBe(toggles.length)
    for (const toggle of toggles) {
      const controlledId = toggle.getAttribute('aria-controls')
      expect(controlledId).toBeTruthy()
      expect(root.querySelector(`#${controlledId}`)).not.toBeNull()
      expect(toggle.getAttribute('aria-label')).toContain('$')
    }

    const firstToggle = toggles[0]
    const firstRegion = root.querySelector(`#${firstToggle.getAttribute('aria-controls')}`)
    firstToggle.click()
    expect(firstToggle.getAttribute('aria-expanded')).toBe('false')
    expect(firstRegion.style.display).toBe('none')

    expect(root.querySelector('[role="status"]')?.textContent).toBe('查询完成，找到 1 个结果')
  })
})
