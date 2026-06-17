import { createElement, createCopyButton } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'html-entity',
  name: 'HTML 实体编解码',
  description: 'HTML 实体转义与反转义',
  category: 'encoding',
  icon: 'html-entity',
  render(container) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }

    const unescapeMap = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'"
    }

    function escapeHtml(text) {
      return text.replace(/[&<>"']/g, (char) => escapeMap[char])
    }

    function unescapeHtml(text) {
      return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (entity) => unescapeMap[entity])
    }

    const inputLabel = createElement('label', { className: 'label' }, ['输入文本'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要转义或反转义的HTML文本...',
      rows: 6
    })

    const outputLabel = createElement('label', { className: 'label' }, ['输出结果'])
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 6,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const escapeBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        outputTextarea.value = escapeHtml(text)
      }
    }, ['转义'])

    const unescapeBtn = createElement('button', {
      className: 'btn btn-secondary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        outputTextarea.value = unescapeHtml(text)
      }
    }, ['反转义'])

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [escapeBtn, unescapeBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
