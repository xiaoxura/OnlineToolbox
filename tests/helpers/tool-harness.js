// Test harness for exercising a tool's rendered UI in jsdom.
// Not a test file (filename does not match the vitest include glob).
import { loadToolById } from '../../src/tools/registry.js'

export async function mountTool(id) {
  const container = document.createElement('main')
  document.body.replaceChildren(container)
  const { render } = await loadToolById(id)
  render(container)
  return container
}

export function editableTextareas(container) {
  return [...container.querySelectorAll('textarea:not([readonly])')]
}

export function readOnlyTextareas(container) {
  return [...container.querySelectorAll('textarea[readonly]')]
}

export function outputValue(container, index = 0) {
  return readOnlyTextareas(container)[index]?.value ?? ''
}

export function outputValues(container) {
  return readOnlyTextareas(container).map(ta => ta.value)
}

export function setValue(el, value) {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export function findButton(container, text) {
  return [...container.querySelectorAll('button')].find(button => button.textContent.includes(text))
}

export function clickText(container, text) {
  const button = findButton(container, text)
  if (!button) throw new Error(`button not found: ${text}`)
  button.click()
  return button
}

export function clickPrimary(container) {
  const button = container.querySelector('.btn-primary')
  if (!button) throw new Error('no .btn-primary button found')
  button.click()
  return button
}

export function errorText(container) {
  return [...container.querySelectorAll('.error-text')].map(el => el.textContent).filter(Boolean).join(' | ')
}

export function flush(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
