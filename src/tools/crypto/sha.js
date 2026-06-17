import { createElement, createCopyButton, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import CryptoJS from 'crypto-js'

export default {
  id: 'sha',
  name: 'SHA 哈希',
  description: '计算 SHA-1/SHA-256/SHA-512 哈希值',
  category: 'crypto',
  icon: 'sha',
  render(container) {
    let currentAlgo = 'sha256'

    const hashFunctions = {
      sha1: CryptoJS.SHA1,
      sha256: CryptoJS.SHA256,
      sha512: CryptoJS.SHA512
    }

    function computeHash() {
      const text = inputTextarea.value
      if (!text) {
        outputTextarea.value = ''
        return
      }
      const fn = hashFunctions[currentAlgo]
      outputTextarea.value = fn(text).toString()
    }

    const inputLabel = createElement('label', { className: 'label' }, ['输入文本'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要计算 SHA 哈希的文本...',
      rows: 6,
      onInput: computeHash
    })

    const tabs = createTabGroup([
      { label: 'SHA-1', value: 'sha1' },
      { label: 'SHA-256', value: 'sha256' },
      { label: 'SHA-512', value: 'sha512' }
    ], (value) => {
      currentAlgo = value
      computeHash()
    })

    const outputLabel = createElement('label', { className: 'label' }, ['哈希值'])
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 3,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = 'Hello, World! 你好世界'
        computeHash()
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [sampleBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(inputLabel)
    container.appendChild(inputTextarea)
    container.appendChild(tabs)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
