import { createElement, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import { marked } from 'marked'

export default {
  id: 'md-to-html',
  name: 'Markdown 转 HTML',
  description: '将 Markdown 文本实时转换为 HTML 代码',
  category: 'converter',
  icon: 'markdown',

  render(container) {
    const section = createSection('Markdown 转 HTML')

    // Input area
    const inputGroup = createElement('div', { className: 'form-group' })
    const inputLabel = createElement('label', { className: 'label', textContent: '输入 Markdown' })
    const textarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 Markdown 文本...',
      rows: 12
    })
    inputGroup.append(inputLabel, textarea)

    // Convert button
    const btnGroup = createElement('div', { className: 'btn-group' })
    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '转换'
    })
    btnGroup.append(convertBtn)

    // Output area with tabs
    const outputGroup = createElement('div', { className: 'form-group' })
    const outputLabel = createElement('label', { className: 'label', textContent: 'HTML 输出' })

    const tabs = createTabGroup([
      { id: 'source', label: 'HTML源码', active: true },
      { id: 'preview', label: '预览效果' }
    ])

    const sourcePanel = createElement('div', { className: 'tool-section' })
    const htmlOutput = createElement('textarea', {
      className: 'textarea',
      readOnly: true,
      rows: 12
    })
    sourcePanel.append(htmlOutput)

    const previewPanel = createElement('div', {
      className: 'tool-section result-box',
      style: 'display: none'
    })

    tabs.panel.append(sourcePanel, previewPanel)

    // Copy button
    const copyGroup = createElement('div', { className: 'btn-group' })
    const copyBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '复制 HTML'
    })
    copyGroup.append(copyBtn)

    outputGroup.append(outputLabel, tabs.container, copyGroup)

    section.append(inputGroup, btnGroup, outputGroup)
    container.append(section)

    // Convert function
    function doConvert() {
      const md = textarea.value
      if (!md.trim()) {
        htmlOutput.value = ''
        previewPanel.innerHTML = ''
        return
      }
      const html = marked.parse(md)
      htmlOutput.value = html
      previewPanel.innerHTML = html
    }

    // Real-time conversion on input
    textarea.addEventListener('input', doConvert)

    convertBtn.addEventListener('click', doConvert)

    // Tab switching
    tabs.container.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.container.querySelectorAll('[data-tab]').forEach(t => {
          t.classList.remove('active')
        })
        tab.classList.add('active')
        const tabId = tab.dataset.tab
        sourcePanel.style.display = tabId === 'source' ? '' : 'none'
        previewPanel.style.display = tabId === 'preview' ? '' : 'none'
      })
    })

    copyBtn.addEventListener('click', () => {
      if (htmlOutput.value) {
        copyToClipboard(htmlOutput.value)
      }
    })
  }
}
