import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountTool, findButton, flush, setValue } from './helpers/tool-harness.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('zh-convert UI branches', () => {
  it('clears output for empty input and supports sample + variant switch', async () => {
    const container = await mountTool('zh-convert')
    const input = container.querySelector('textarea')
    const output = container.querySelector('textarea[readonly]')
    setValue(input, '')
    findButton(container, '转换').click()
    expect(output.value).toBe('')
    expect(container.querySelector('.error-text').textContent).toBe('')

    findButton(container, '示例数据').click()
    await vi.waitFor(() => expect(output.value.length).toBeGreaterThan(0), { timeout: 15000 })

    const variant = container.querySelector('select')
    variant.value = 'tw'
    variant.dispatchEvent(new Event('change', { bubbles: true }))
    await flush(400)
    expect(output.value.length).toBeGreaterThan(0)
  })
})
