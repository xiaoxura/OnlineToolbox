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
      expect(container.querySelector('select.input'), `${descriptor.id}: select uses text-input styling`).toBeNull()
      expect(container.querySelector('button[class="btn"]'), `${descriptor.id}: button has no visual variant`).toBeNull()
      for (const choice of container.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
        expect(choice.closest('label'), `${descriptor.id}: choice is not wrapped by a clickable label`).not.toBeNull()
      }
      expect(container.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box'), `${descriptor.id}: nested result card`).toBeNull()
      expect(container.querySelector('.result-box > label + input, .result-box > label + textarea'), `${descriptor.id}: legacy double-framed result`).toBeNull()
      for (const table of container.querySelectorAll('table.result-table')) {
        expect(table.parentElement?.classList.contains('table-scroll'), `${descriptor.id}: result table is not scrollable`).toBe(true)
      }
      for (const tab of container.querySelectorAll('[role="tab"]')) {
        const panelId = tab.getAttribute('aria-controls')
        expect(panelId, `${descriptor.id}: tab without aria-controls`).toBeTruthy()
        expect(container.querySelector(`#${panelId}`)?.getAttribute('role'), `${descriptor.id}: missing tabpanel`).toBe('tabpanel')
      }
      for (const group of container.querySelectorAll('[role="radiogroup"]')) {
        expect(group.querySelectorAll('[role="radio"][aria-checked="true"]'), `${descriptor.id}: invalid segmented state`).toHaveLength(1)
      }
      for (const group of container.querySelectorAll('.filter-group')) {
        expect(group.querySelectorAll('[aria-pressed="true"]'), `${descriptor.id}: invalid filter state`).toHaveLength(1)
      }
    })
  }
})
