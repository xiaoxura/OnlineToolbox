import { createElement, createSection } from '../../utils/dom.js'
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
  tables: true
})

export default {
  id: 'markdown',
  name: 'Markdown 预览',
  description: '实时预览 Markdown 文本',
  category: 'text',
  icon: 'html',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '在此输入 Markdown 文本...'
    })

    const preview = createElement('div', {
      className: 'markdown-preview result-box'
    })

    function updatePreview() {
      const raw = input.value
      if (!raw.trim()) {
        preview.innerHTML = '<p style="color:var(--color-text-muted)">预览区域</p>'
        return
      }
      preview.innerHTML = marked.parse(raw)
    }

    input.addEventListener('input', updatePreview)

    const leftCol = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label' }, ['Markdown 源码']),
      input
    ])

    const rightCol = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label' }, ['预览']),
      preview
    ])

    const row = createElement('div', { className: 'form-row' }, [leftCol, rightCol])

    container.appendChild(row)
    updatePreview()
  }
}
