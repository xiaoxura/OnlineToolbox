import { createElement, createCopyButton, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'unicode',
  name: 'Unicode 编解码',
  description: '文本与 Unicode 编码互相转换',
  category: 'encoding',
  icon: 'unicode',
  render(container) {
    let mode = 'text-to-unicode' // 'text-to-unicode' or 'unicode-to-text'

    const inputLabel = createElement('label', { className: 'label' }, ['输入'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入文本或 Unicode 编码...',
      rows: 6,
      onInput: () => {
        const text = inputTextarea.value
        if (!text) { outputTextarea.value = ''; return }
        try {
          if (mode === 'text-to-unicode') {
            outputTextarea.value = textToUnicode(text)
          } else {
            outputTextarea.value = unicodeToText(text)
          }
        } catch (e) {
          outputTextarea.value = '转换错误: ' + e.message
        }
      }
    })

    const outputLabel = createElement('label', { className: 'label' }, ['输出结果'])
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 6,
      readOnly: true
    })

    const tabs = createTabGroup([
      { value: 'text-to-unicode', label: '文本→Unicode' },
      { value: 'unicode-to-text', label: 'Unicode→文本' }
    ], (key) => {
      mode = key
      inputTextarea.placeholder = key === 'text-to-unicode'
        ? '请输入文本...'
        : '请输入 Unicode 编码，如 \\u4f60\\u597d 或 \\u{1F600}...'
    })

    function textToUnicode(text) {
      const result = []
      for (const char of text) {
        const code = char.codePointAt(0)
        if (code <= 0xFFFF) {
          result.push('\\u' + code.toString(16).padStart(4, '0').toUpperCase())
        } else {
          result.push('\\u{' + code.toString(16).toUpperCase() + '}')
        }
      }
      return result.join('')
    }

    function unicodeToText(text) {
      // Handle \u{XXXXX} format (supplementary plane)
      let result = text.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => {
        return String.fromCodePoint(parseInt(hex, 16))
      })
      // Handle \uXXXX format (BMP)
      result = result.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
        return String.fromCharCode(parseInt(hex, 16))
      })
      return result
    }

    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        try {
          if (mode === 'text-to-unicode') {
            outputTextarea.value = textToUnicode(text)
          } else {
            outputTextarea.value = unicodeToText(text)
          }
        } catch (e) {
          outputTextarea.value = '转换错误: ' + e.message
        }
      }
    }, ['转换'])

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick: () => {
        if (mode === 'text-to-unicode') {
          inputTextarea.value = '你好世界！Hello 🌍🎉 程序员的日常：写Bug→修Bug→循环'
        } else {
          inputTextarea.value = '\\u4f60\\u597d\\u4e16\\u754c\\uff01Hello \\u{1F30D}\\u{1F389}'
        }
        inputTextarea.dispatchEvent(new Event('input'))
      }
    })

    const clearBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '清空',
      onClick: () => {
        inputTextarea.value = ''
        outputTextarea.value = ''
      }
    })

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [convertBtn, sampleBtn, clearBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(tabs)
    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
