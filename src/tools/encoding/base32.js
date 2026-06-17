import { createElement, createCopyButton } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'base32',
  name: 'Base32 编解码',
  description: 'Base32 编码与解码（RFC 4648 字母表: A-Z2-7）',
  category: 'encoding',
  icon: 'base32',
  render(container) {
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

    function base32Encode(input) {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(input)
      let bits = ''
      for (const byte of bytes) {
        bits += byte.toString(2).padStart(8, '0')
      }
      // Pad to multiple of 5
      while (bits.length % 5 !== 0) {
        bits += '0'
      }
      let result = ''
      for (let i = 0; i < bits.length; i += 5) {
        const index = parseInt(bits.substr(i, 5), 2)
        result += ALPHABET[index]
      }
      // Add padding
      const padLength = (8 - (result.length % 8)) % 8
      result += '='.repeat(padLength)
      return result
    }

    function base32Decode(input) {
      const cleanInput = input.trim().toUpperCase().replace(/=+$/, '')
      let bits = ''
      for (const char of cleanInput) {
        const index = ALPHABET.indexOf(char)
        if (index === -1) {
          throw new Error('无效的 Base32 字符: ' + char)
        }
        bits += index.toString(2).padStart(5, '0')
      }
      // Truncate to full bytes
      const fullBytes = Math.floor(bits.length / 8)
      const bytes = new Uint8Array(fullBytes)
      for (let i = 0; i < fullBytes; i++) {
        bytes[i] = parseInt(bits.substr(i * 8, 8), 2)
      }
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(bytes)
    }

    const inputLabel = createElement('label', { className: 'label' }, ['输入文本'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要编码或解码的文本...',
      rows: 6,
      onInput: () => {
        const text = inputTextarea.value
        if (!text) { outputTextarea.value = ''; return }
        try {
          if (/^[A-Za-z2-7=\s]+$/.test(text)) {
            outputTextarea.value = base32Decode(text)
          } else {
            outputTextarea.value = base32Encode(text)
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

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const encodeBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        try {
          outputTextarea.value = base32Encode(text)
        } catch (e) {
          outputTextarea.value = '编码错误: ' + e.message
        }
      }
    }, ['编码'])

    const decodeBtn = createElement('button', {
      className: 'btn btn-secondary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        try {
          outputTextarea.value = base32Decode(text)
        } catch (e) {
          outputTextarea.value = '解码错误: ' + e.message
        }
      }
    }, ['解码'])

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = 'Hello, World! 你好世界'
        encodeBtn.click()
      }
    })

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [encodeBtn, decodeBtn, sampleBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
