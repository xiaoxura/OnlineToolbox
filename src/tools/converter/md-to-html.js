import { createElement, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
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
    const sourcePanel = createElement('div', { className: 'tool-section' }, [htmlOutput])
    const previewPanel = createElement('div', {
      className: 'tool-section result-box',
      style: { display: 'none' }
    })

    const tabs = createTabGroup([
      { label: 'HTML 源码', value: 'source' },
      { label: '预览效果', value: 'preview' }
    ], value => {
      sourcePanel.style.display = value === 'source' ? '' : 'none'
      previewPanel.style.display = value === 'preview' ? '' : 'none'
    })

    const copyBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '复制 HTML',
      onClick: () => {
        if (htmlOutput.value) copyToClipboard(htmlOutput.value)
      }
    })

    const outputGroup = createElement('div', { className: 'form-group' }, [
      createElement('div', { className: 'label', textContent: 'HTML 输出' }),
      tabs,
      sourcePanel,
      previewPanel,
      createElement('div', { className: 'btn-group' }, [copyBtn])
    ])

    const section = createSection('Markdown 转 HTML', createElement('div', {}, [
      inputGroup,
      outputGroup
    ]))
    container.append(section)

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
