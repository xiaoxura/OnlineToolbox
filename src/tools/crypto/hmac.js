import { createElement, createCopyButton, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import CryptoJS from 'crypto-js'

export default {
  id: 'hmac',
  name: 'HMAC 生成',
  description: '生成 HMAC 签名',
  category: 'crypto',
  icon: 'hmac',
  render(container) {
    let currentAlgo = 'sha256'

    const hmacFunctions = {
      md5: CryptoJS.HmacMD5,
      sha1: CryptoJS.HmacSHA1,
      sha256: CryptoJS.HmacSHA256,
      sha512: CryptoJS.HmacSHA512
    }

    function computeHmac() {
      const message = messageTextarea.value
      const key = keyInput.value
      if (!message || !key) {
        outputTextarea.value = ''
        return
      }
      const fn = hmacFunctions[currentAlgo]
      outputTextarea.value = fn(message, key).toString()
    }

    // Message input
    const messageLabel = createElement('label', { className: 'label' }, ['消息内容'])
    const messageTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要签名的消息...',
      rows: 5,
      onInput: computeHmac
    })

    // Key input
    const keyLabel = createElement('label', { className: 'label' }, ['密钥 (Key)'])
    const keyInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '请输入 HMAC 密钥...',
      onInput: computeHmac
    })

    // Algorithm tabs
    const tabs = createTabGroup([
      { label: 'MD5', value: 'md5' },
      { label: 'SHA1', value: 'sha1' },
      { label: 'SHA256', value: 'sha256' },
      { label: 'SHA512', value: 'sha512' }
    ], (value) => {
      currentAlgo = value
      computeHmac()
    })

    // Output
    const outputLabel = createElement('label', { className: 'label' }, ['HMAC 签名'])
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
        messageTextarea.value = 'Hello, World! 这是一条测试消息'
        keyInput.value = 'my-hmac-secret-key'
        computeHmac()
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [sampleBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(messageLabel)
    container.appendChild(messageTextarea)
    container.appendChild(keyLabel)
    container.appendChild(keyInput)
    container.appendChild(tabs)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
