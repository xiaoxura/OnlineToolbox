import { describe, expect, it } from 'vitest'
import { loadToolById } from '../src/tools/registry.js'
import { applyTwoColumnLayout } from '../src/utils/dom.js'

function renderSplit(id) {
  return loadToolById(id).then(tool => {
    const container = document.createElement('main')
    document.body.replaceChildren(container)
    tool.render(container)
    applyTwoColumnLayout(container)
    return container
  })
}

describe('IO swap button', () => {
  it('appears between the columns when both sides hold a textarea (base64)', async () => {
    const container = await renderSplit('base64')
    const grid = container.querySelector('.tool-io-grid.has-swap')
    expect(grid).not.toBeNull()
    expect(grid.querySelector('.io-swap-btn')).not.toBeNull()
    expect(grid.querySelectorAll(':scope > .tool-io-col')).toHaveLength(2)
    expect(grid.querySelector('.tool-io-swap')).not.toBeNull()
  })

  it('swaps output back into input and re-runs (base64 encode→decode)', async () => {
    const container = await renderSplit('base64')
    const inputTA = container.querySelector('.tool-io-input textarea:not([readonly])')
    const outputTA = container.querySelector('.tool-io-output textarea[readonly]')

    // Encode something first.
    inputTA.value = 'Hello, 世界'
    inputTA.dispatchEvent(new Event('input', { bubbles: true }))
    const encoded = outputTA.value
    expect(encoded.length).toBeGreaterThan(0)
    expect(encoded).not.toBe('Hello, 世界')

    // Swap: direction flips to decode and the encoded text becomes the input.
    container.querySelector('.io-swap-btn').click()
    expect(inputTA.value).toBe(encoded)
    // After re-running in decode mode, the output is the original text again.
    expect(outputTA.value).toBe('Hello, 世界')
  })

  it('does not add a swap button when there is no readonly output textarea', async () => {
    // char-count splits but its output is a stats section, not a readonly textarea.
    const container = await renderSplit('char-count')
    const grid = container.querySelector('.tool-io-grid')
    expect(grid).not.toBeNull()
    expect(grid.classList.contains('has-swap')).toBe(false)
    expect(grid.querySelector('.io-swap-btn')).toBeNull()
  })
})
