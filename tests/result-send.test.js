import { afterEach, describe, expect, it } from 'vitest'
import { loadToolById } from '../src/tools/registry.js'
import { applyTwoColumnLayout, enhanceFormAccessibility, enhanceResultSections } from '../src/utils/dom.js'
import { closeToolPicker } from '../src/app/tool-picker.js'

async function renderEnhanced(id) {
  const tool = await loadToolById(id)
  const container = document.createElement('main')
  document.body.replaceChildren(container)
  tool.render(container)
  applyTwoColumnLayout(container)
  enhanceFormAccessibility(container)
  enhanceResultSections(container, { toolName: id })
  return container
}

function sendButton(container) {
  return [...container.querySelectorAll('.btn-icon')]
    .find(button => button.getAttribute('aria-label') === '发送到其他工具')
}

afterEach(() => {
  closeToolPicker()
  sessionStorage.clear()
  window.location.hash = ''
  document.body.replaceChildren()
})

describe('send result to another tool', () => {
  it('opens the picker, stores a handoff and navigates to the target', async () => {
    const container = await renderEnhanced('base64')
    const input = container.querySelector('textarea:not([readonly])')
    input.value = 'hello'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const button = sendButton(container)
    expect(button).toBeTruthy()
    button.click()
    const options = [...document.querySelectorAll('.tool-picker-option')]
    expect(options.length).toBeGreaterThan(0)
    const targetId = options[0].dataset.toolId
    options[0].click()
    expect(window.location.hash).toBe(`#/${targetId}`)
    const payload = JSON.parse(sessionStorage.getItem('toolbox:handoff'))
    expect(payload.targetId).toBe(targetId)
    expect(payload.fromId).toBe('base64')
    expect(payload.text).toBe('aGVsbG8=')
  })

  it('shows a hint instead of a picker when the result is empty', async () => {
    const container = await renderEnhanced('base64')
    sendButton(container).click()
    expect(document.querySelector('.tool-picker-overlay')).toBeNull()
    expect(document.querySelector('.toast').textContent).toContain('没有可发送的内容')
  })
})
