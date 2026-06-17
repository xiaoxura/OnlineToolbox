import { createElement, createCopyButton, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'url-encode',
  name: 'URL 编解码',
  description: 'URL 编码与解码，支持组件编码和完整URL编码',
  category: 'encoding',
  icon: 'url-encode',
  render(container) {
    let mode = 'component' // 'component' or 'full'

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

    const tabs = createTabGroup([
      { value: 'component', label: '组件编码' },
      { value: 'full', label: '完整URL编码' }
    ], (key) => {
      mode = key
    })

    const encodeBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        try {
          if (mode === 'component') {
            outputTextarea.value = encodeURIComponent(text)
          } else {
            outputTextarea.value = encodeURI(text)
          }
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
          if (mode === 'component') {
            outputTextarea.value = decodeURIComponent(text)
          } else {
            outputTextarea.value = decodeURI(text)
          }
        } catch (e) {
          outputTextarea.value = '解码错误: ' + e.message
        }
      }
    }, ['解码'])

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [encodeBtn, decodeBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(tabs)
    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
