import { describe, expect, it } from 'vitest'

describe('Markdown preview security', () => {
  it('sanitizes scripts, event handlers and javascript URLs', async () => {
    const { default: tool } = await import('../src/tools/text/markdown.js')
    const container = document.createElement('main')
    tool.render(container)
    const input = container.querySelector('textarea')
    input.value = '<img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">bad</a>'
    input.dispatchEvent(new Event('input'))
    const preview = container.querySelector('.markdown-preview')
    expect(preview.querySelector('script')).toBeNull()
    expect(preview.querySelector('[onerror]')).toBeNull()
    expect(preview.querySelector('a')?.getAttribute('href')).toBeNull()
  })
})
