import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'base64',
  name: 'Base64 编解码',
  description: 'Base64 编码与解码，支持 UTF-8 中文',
  category: 'encoding',
  icon: 'base64',
  render(container) {
    let mode = 'encode' // 'encode' or 'decode'

    // --- Encode / Decode helpers (UTF-8 aware) ---
    function encodeBase64(text) {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(text)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    }

    function decodeBase64(text) {
      const binary = atob(text.trim())
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return new TextDecoder('utf-8').decode(bytes)
    }

    // --- UI elements ---
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要编码的文本...',
      rows: 6,
      onInput: () => {
        const text = inputTextarea.value
        if (!text) {
          outputTextarea.value = ''
          return
        }
        try {
          if (mode === 'encode') {
            outputTextarea.value = encodeBase64(text)
          } else {
            outputTextarea.value = decodeBase64(text)
          }
        } catch (e) {
          outputTextarea.value = (mode === 'encode' ? '编码' : '解码') + '错误: ' + e.message
        }
      }
    })

    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 6,
      readOnly: true
    })

    // --- Tab group ---
    const tabs = createTabGroup([
      { value: 'encode', label: '编码' },
      { value: 'decode', label: '解码' }
    ], (key) => {
      mode = key
      inputTextarea.placeholder = key === 'encode'
        ? '请输入要编码的文本...'
        : '请输入要解码的 Base64 字符串...'
      // Re-convert with current input
      inputTextarea.dispatchEvent(new Event('input'))
    })

    // --- Action buttons ---
    const exampleText = 'Hello, 世界！\n这是一个 Base64 编解码工具。\n支持 UTF-8 中英文混合内容。'
    const exampleBase64 = encodeBase64(exampleText)

    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      onClick: () => {
        inputTextarea.value = mode === 'encode' ? exampleText : exampleBase64
        inputTextarea.dispatchEvent(new Event('input'))
      }
    }, ['示例数据'])

    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      onClick: () => {
        inputTextarea.value = ''
        outputTextarea.value = ''
      }
    }, ['清空'])

    const copyBtn = createCopyButton(() => outputTextarea.value)

    // --- Layout ---
    const inputSection = createSection('输入', inputTextarea, [exampleBtn, clearBtn])
    const outputSection = createSection('输出结果', outputTextarea, [copyBtn])

    container.appendChild(tabs)
    container.appendChild(inputSection)
    container.appendChild(outputSection)
  }
}
