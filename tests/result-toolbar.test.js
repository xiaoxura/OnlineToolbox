import { describe, expect, it } from 'vitest'
import { loadToolById } from '../src/tools/registry.js'
import { applyTwoColumnLayout, enhanceFormAccessibility, enhanceResultSections } from '../src/utils/dom.js'

function renderEnhanced(id) {
  return loadToolById(id).then(tool => {
    const container = document.createElement('main')
    document.body.replaceChildren(container)
    tool.render(container)
    applyTwoColumnLayout(container)
    enhanceFormAccessibility(container)
    enhanceResultSections(container, { toolName: id })
    return container
  })
}

describe('result section toolbar', () => {
  it('injects copy + download into a readonly-textarea output (base64)', async () => {
    const container = await renderEnhanced('base64')
    // The output section is the one holding a readonly textarea.
    const output = [...container.querySelectorAll('.tool-section')]
      .find(s => s.querySelector('.tool-section-body textarea[readonly]'))
    expect(output).not.toBeNull()
    const labels = [...output.querySelectorAll('.tool-section-header .btn-icon')].map(b => b.getAttribute('aria-label'))
    expect(labels).toContain('下载为文件')
    // base64 already has a copy button; we must not duplicate it.
    expect(labels.filter(l => l === '复制').length).toBeLessThanOrEqual(1)
  })

  it('adds wrap + collapse toggles for a result-box output (user-agent)', async () => {
    const container = await renderEnhanced('user-agent')
    const box = container.querySelector('.result-box')
    expect(box).not.toBeNull()
    const header = box.closest('.tool-section').querySelector('.tool-section-header')
    const labels = [...header.querySelectorAll('.btn-icon')].map(b => b.getAttribute('aria-label'))
    expect(labels).toContain('切换自动换行')
    expect(labels).toContain('折叠结果')
  })

  it('is idempotent — a second enhance pass adds nothing', async () => {
    const container = await renderEnhanced('user-agent')
    const before = container.querySelectorAll('.btn-icon').length
    enhanceResultSections(container, { toolName: 'user-agent' })
    expect(container.querySelectorAll('.btn-icon').length).toBe(before)
  })

  it('wrap toggle flips white-space on the result box', async () => {
    const container = await renderEnhanced('user-agent')
    const box = container.querySelector('.result-box')
    const wrapBtn = [...box.closest('.tool-section').querySelectorAll('.btn-icon')]
      .find(b => b.getAttribute('aria-label') === '切换自动换行')
    expect(box.classList.contains('nowrap')).toBe(false)
    wrapBtn.click()
    expect(box.classList.contains('nowrap')).toBe(true)
    wrapBtn.click()
    expect(box.classList.contains('nowrap')).toBe(false)
  })

  it('collapse toggle collapses and expands the result box', async () => {
    const container = await renderEnhanced('user-agent')
    const box = container.querySelector('.result-box')
    const collapseBtn = [...box.closest('.tool-section').querySelectorAll('.btn-icon')]
      .find(b => ['折叠结果', '展开结果'].includes(b.getAttribute('aria-label')))
    collapseBtn.click()
    expect(box.classList.contains('collapsed')).toBe(true)
    expect(collapseBtn.getAttribute('aria-label')).toBe('展开结果')
    collapseBtn.click()
    expect(box.classList.contains('collapsed')).toBe(false)
  })

  it('does not inject a toolbar into pure-input sections', async () => {
    const container = await renderEnhanced('base64')
    const input = container.querySelector('.tool-io-input .tool-section')
    // Input section holds an editable textarea, so no result toolbar.
    expect(input.querySelector('.btn-icon[aria-label="下载为文件"]')).toBeNull()
  })
})
