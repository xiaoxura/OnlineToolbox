import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'
import { hmac } from '@noble/hashes/hmac.js'
import { md5, sha1 } from '@noble/hashes/legacy.js'
import { sha256, sha512 } from '@noble/hashes/sha2.js'
import { toHex } from '../../utils/hash.js'

export default {
  render(container) {
    let currentAlgo = 'sha256'

    const hmacFunctions = {
      md5: (message, key) => hmac(md5, key, message),
      sha1: (message, key) => hmac(sha1, key, message),
      sha256: (message, key) => hmac(sha256, key, message),
      sha512: (message, key) => hmac(sha512, key, message)
    }

    function computeHmac() {
      const message = messageTextarea.value
      const key = keyInput.value
      if (!message || !key) {
        outputTextarea.value = ''
        return
      }
      const fn = hmacFunctions[currentAlgo]
      const encoder = new TextEncoder()
      outputTextarea.value = toHex(fn(encoder.encode(message), encoder.encode(key)))
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
    const tabs = createSegmentedGroup([
      { label: 'MD5', value: 'md5' },
      { label: 'SHA1', value: 'sha1' },
      { label: 'SHA256', value: 'sha256' },
      { label: 'SHA512', value: 'sha512' }
    ], (value) => {
      currentAlgo = value
      computeHmac()
    })

    // Output
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 3,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick: () => {
        messageTextarea.value = 'Hello, World! 这是一条测试消息'
        keyInput.value = 'my-hmac-secret-key'
        computeHmac()
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [sampleBtn])
    const outputSection = createSection('HMAC 签名', outputTextarea, [copyBtn])

    container.appendChild(messageLabel)
    container.appendChild(messageTextarea)
    container.appendChild(keyLabel)
    container.appendChild(keyInput)
    container.appendChild(tabs)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
