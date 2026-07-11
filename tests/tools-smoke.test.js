import { describe, expect, it } from 'vitest'
import { tools } from '../src/tools/registry.js'
import { enhanceFormAccessibility } from '../src/utils/dom.js'

describe('tool render smoke tests', () => {
  for (const descriptor of tools) {
    it(`renders ${descriptor.id} without throwing`, async () => {
      const { default: tool } = await descriptor.load()
      const container = document.createElement('main')
      document.body.replaceChildren(container)
      expect(() => tool.render(container)).not.toThrow()
      enhanceFormAccessibility(container)
      expect(container.childElementCount).toBeGreaterThan(0)
      for (const control of container.querySelectorAll('input, textarea, select')) {
        const hasName = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
        expect(Boolean(hasName), `${descriptor.id}: unnamed ${control.tagName}`).toBe(true)
      }
    })
  }
})
