import { describe, expect, it } from 'vitest'
import { enhanceResultSections } from '../src/utils/dom.js'

function buildSection({ withGroup = false, boxClass = 'result-box' } = {}) {
  const container = document.createElement('main')
  const section = document.createElement('section')
  section.className = 'tool-section'
  const header = document.createElement('div')
  header.className = 'tool-section-header'
  const title = document.createElement('h2')
  title.textContent = '输出'
  header.appendChild(title)
  if (withGroup) {
    const group = document.createElement('div')
    group.className = 'btn-group'
    header.appendChild(group)
  }
  const body = document.createElement('div')
  body.className = 'tool-section-body'
  const box = document.createElement('div')
  box.className = boxClass
  box.textContent = 'result text'
  body.appendChild(box)
  section.append(header, body)
  container.appendChild(section)
  document.body.replaceChildren(container)
  return container
}

describe('result toolbar extra branches', () => {
  it('creates a button group when the header has none and copies content', () => {
    const container = buildSection()
    enhanceResultSections(container, { toolName: 'demo' })
    const header = container.querySelector('.tool-section-header')
    expect(header.querySelector('.btn-group')).not.toBeNull()
    const copy = [...header.querySelectorAll('.btn-icon')].find(button => button.getAttribute('aria-label') === '复制')
    expect(copy).toBeTruthy()
    copy.click()
    expect(copy.classList.contains('copied')).toBe(true)
  })

  it('skips visual previews marked with data-no-toolbar', () => {
    const container = buildSection({ boxClass: 'result-box visual-preview' })
    enhanceResultSections(container, { toolName: 'demo' })
    expect(container.querySelector('.btn-icon')).toBeNull()
  })

  it('adds wrap and collapse only when a result-box exists', () => {
    const container = buildSection({ boxClass: 'result-box' })
    enhanceResultSections(container, { toolName: 'demo' })
    const labels = [...container.querySelectorAll('.btn-icon')].map(button => button.getAttribute('aria-label'))
    expect(labels).toContain('切换自动换行')
    expect(labels).toContain('折叠结果')
    expect(labels).toContain('发送到其他工具')
  })
})
