import { describe, expect, it } from 'vitest'
import { enhanceFormAccessibility } from '../src/utils/dom.js'

describe('tool control consistency', () => {
  it.each([
    ['CSV to JSON', '../src/tools/converter/csv-json.js'],
    ['JSON to CSV', '../src/tools/converter/json-csv.js']
  ])('normalizes the %s options', async (_name, modulePath) => {
    const { default: tool } = await import(modulePath)
    const root = document.createElement('main')
    tool.render(root)
    enhanceFormAccessibility(root)

    const select = root.querySelector('select')
    const checkbox = root.querySelector('input[type="checkbox"]')
    const label = checkbox.closest('label')
    expect(select.classList.contains('select')).toBe(true)
    expect(checkbox.classList.contains('checkbox')).toBe(true)
    expect(label?.classList.contains('option-item')).toBe(true)
    expect(checkbox.checked).toBe(true)
    label.click()
    expect(checkbox.checked).toBe(false)
  })

  it('keeps gradient stop deletion honest and updates generated CSS', async () => {
    const { default: tool } = await import('../src/tools/generator/gradient-gen.js')
    const root = document.createElement('main')
    tool.render(root)

    expect(root.querySelectorAll('.gradient-stop-row')).toHaveLength(2)
    expect([...root.querySelectorAll('.gradient-stop-remove')].every(button => button.disabled)).toBe(true)

    const addButton = [...root.querySelectorAll('button')].find(button => button.textContent.includes('添加色标'))
    addButton.click()
    expect(root.querySelectorAll('.gradient-stop-row')).toHaveLength(3)
    expect([...root.querySelectorAll('.gradient-stop-remove')].every(button => !button.disabled)).toBe(true)

    const color = root.querySelector('.gradient-stop-row input[type="color"]')
    color.value = '#123456'
    color.dispatchEvent(new Event('change'))
    expect(root.querySelector('textarea[readonly]').value).toContain('#123456 0%')

    root.querySelector('.gradient-stop-remove').click()
    expect(root.querySelectorAll('.gradient-stop-row')).toHaveLength(2)
    expect([...root.querySelectorAll('.gradient-stop-remove')].every(button => button.disabled)).toBe(true)
  })

  it('keeps detected JSON and YAML formats synchronized with the segmented control', async () => {
    const { default: tool } = await import('../src/tools/converter/json-yaml.js')
    const root = document.createElement('main')
    tool.render(root)

    const input = root.querySelector('textarea')
    const checkedValue = () => root.querySelector('[role="radio"][aria-checked="true"]')?.dataset.value
    input.value = 'name: example'
    input.dispatchEvent(new Event('input'))
    expect(checkedValue()).toBe('yaml')

    input.value = '{"name":"example"}'
    input.dispatchEvent(new Event('input'))
    expect(checkedValue()).toBe('json')
  })
})
