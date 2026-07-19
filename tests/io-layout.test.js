import { describe, expect, it } from 'vitest'
import { tools, loadToolById } from '../src/tools/registry.js'
import { applyTwoColumnLayout, enhanceFormAccessibility } from '../src/utils/dom.js'

// Authoritative split/stacked census, derived by reading every tool's rendered
// structure. SPLIT tools are "paste a large input → see its result"; they gain a
// side-by-side layout on wide screens. STACKED tools are lookup tables,
// generators, calculators, multi-input/two-way converters and custom layouts
// that stay full-width.
const EXPECT_SPLIT = new Set([
  'base64', 'url-encode', 'html-entity', 'unicode', 'hex', 'base58', 'base32',
  'punycode', 'md5', 'sha', 'aes', 'des', 'hmac', 'char-count', 'case-convert',
  'text-dedup', 'text-sort', 'regex', 'text-replace', 'escape', 'text-encrypt',
  'json-yaml', 'json-xml', 'json-csv', 'csv-json', 'html-to-jsx', 'json', 'css',
  'html', 'sql', 'xml', 'user-agent', 'json-schema', 'format-check', 'svg-compress'
])

describe('two-column IO layout', () => {
  for (const descriptor of tools) {
    it(`${descriptor.id}: matches the expected split decision`, async () => {
      const tool = await loadToolById(descriptor.id)
      const container = document.createElement('main')
      document.body.replaceChildren(container)
      tool.render(container)
      const split = applyTwoColumnLayout(container)
      enhanceFormAccessibility(container)

      expect(split, `${descriptor.id} split mismatch`).toBe(EXPECT_SPLIT.has(descriptor.id))

      // Idempotent: a second pass must not re-wrap.
      expect(applyTwoColumnLayout(container)).toBe(false)

      if (split) {
        const grid = container.querySelector(':scope > .tool-io-grid')
        expect(grid, `${descriptor.id} produced a top-level split grid`).not.toBeNull()
        const cols = grid.querySelectorAll(':scope > .tool-io-col')
        expect(cols).toHaveLength(2)
        expect(grid.querySelector('.tool-io-output').childElementCount).toBeGreaterThan(0)
        // The input column must hold the editable textarea.
        expect(grid.querySelector('.tool-io-input textarea:not([readonly])')).not.toBeNull()
      } else {
        expect(container.querySelector('.tool-io-grid')).toBeNull()
      }
    })
  }

  it('keeps the toolbox split coverage within the expected band', async () => {
    let split = 0
    for (const descriptor of tools) {
      const tool = await loadToolById(descriptor.id)
      const container = document.createElement('main')
      document.body.replaceChildren(container)
      tool.render(container)
      if (applyTwoColumnLayout(container)) split++
    }
    expect(split).toBe(EXPECT_SPLIT.size)
  })
})
