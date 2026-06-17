import { createElement, createCopyButton } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'base64',
  name: 'Base64 编解码',
  description: 'Base64 编码与解码，支持 UTF-8 中文',
  category: 'encoding',
  icon: 'base64',
  render(container) {
    const inputLabel = createElement('label', { className: 'label' }, ['输入文本'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要编码或解码的文本...',
      rows: 6
    })

    const outputLabel = createElement('label', { className: 'label' }, ['输出结果'])
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 6,
      readOnly: true
    })

    const encodeBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        try {
          const encoder = new TextEncoder()
          const bytes = encoder.encode(text)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          outputTextarea.value = btoa(binary)
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
          const binary = atob(text.trim())
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          const decoder = new TextDecoder('utf-8')
          outputTextarea.value = decoder.decode(bytes)
        } catch (e) {
          outputTextarea.value = '解码错误: ' + e.message
        }
      }
    }, ['解码'])

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [encodeBtn, decodeBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
