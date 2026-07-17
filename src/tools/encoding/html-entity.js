import { createElement, createCopyButton, createSection } from '../../utils/dom.js'

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
      rows: 6,
      onInput: () => {
        const text = inputTextarea.value
        if (!text) { outputTextarea.value = ''; return }
        outputTextarea.value = escapeHtml(text)
      }
    })

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

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = '<div class="container">\n  <h1>Hello & Welcome</h1>\n  <p>他说："你好！" & \'世界\'</p>\n  <a href="https://example.com?a=1&b=2">链接</a>\n</div>'
        inputTextarea.dispatchEvent(new Event('input'))
      }
    })

    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '清空',
      onClick: () => {
        inputTextarea.value = ''
        outputTextarea.value = ''
      }
    })

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [escapeBtn, unescapeBtn, sampleBtn, clearBtn])
    const outputSection = createSection('输出结果', outputTextarea, [copyBtn])

    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
