import { createCopyButton, createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export default {
  id: 'md-to-html',
  name: 'Markdown 转 HTML',
  description: '将 Markdown 文本实时转换为 HTML 代码',
  category: 'converter',
  icon: 'markdown',

  render(container) {
    const textarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 Markdown 文本...',
      rows: 12
    })
    const inputGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: '输入 Markdown' }),
      textarea
    ])

    const htmlOutput = createElement('textarea', {
      className: 'textarea',
      readOnly: true,
      rows: 12,
      'aria-label': 'HTML 源码输出'
    })
    const sourcePanel = createElement('div', {}, [htmlOutput])
    const previewPanel = createElement('div', {
      className: 'markdown-preview',
      hidden: true
    })

    const tabs = createSegmentedGroup([
      { label: 'HTML 源码', value: 'source' },
      { label: '预览效果', value: 'preview' }
    ], value => {
      sourcePanel.hidden = value !== 'source'
      previewPanel.hidden = value !== 'preview'
    }, { label: '输出视图' })

    const copyBtn = createCopyButton(() => htmlOutput.value)

    const outputGroup = createElement('div', { className: 'tool-stack' }, [
      tabs,
      sourcePanel,
      previewPanel
    ])

    container.append(inputGroup, createSection('HTML 输出', outputGroup, [copyBtn]))

    function doConvert() {
      const markdown = textarea.value
      if (!markdown.trim()) {
        htmlOutput.value = ''
        previewPanel.innerHTML = ''
        return
      }

      const html = marked.parse(markdown)
      htmlOutput.value = html
      previewPanel.innerHTML = DOMPurify.sanitize(html)
    }

    textarea.addEventListener('input', doConvert)
  }
}
