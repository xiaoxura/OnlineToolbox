import "../../styles/tools/markdown.css"
import { createElement } from '../../utils/dom.js'
import { marked } from 'marked'
import { sanitizeHtml } from '../../utils/sanitize.js'
import { debounce } from '../../utils/debounce.js'

marked.setOptions({
  gfm: true,
  breaks: true,
  tables: true
})

export default {
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
      preview.innerHTML = sanitizeHtml(marked.parse(raw))
    }

    const schedulePreview = debounce(updatePreview)
    input.addEventListener('input', () => {
      // Keep small documents instant; debounce only when parsing gets costly.
      if (input.value.length > 20000) schedulePreview()
      else updatePreview()
    })

    const leftCol = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label' }, ['Markdown 源码']),
      input
    ])

    const rightCol = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label' }, ['预览']),
      preview
    ])

    const row = createElement('div', { className: 'form-row markdown-split' }, [leftCol, rightCol])

    container.appendChild(row)
    updatePreview()

    return () => schedulePreview.cancel()
  }
}
