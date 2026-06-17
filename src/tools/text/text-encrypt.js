import { createElement, createCopyButton, createTabGroup } from '../../utils/dom.js'
import CryptoJS from 'crypto-js'

export default {
  id: 'text-encrypt',
  name: '文本加密',
  description: '使用 AES 加密和解密文本',
  category: 'text',
  icon: 'aes',
  render(container) {
    let mode = 'encrypt'

    const inputLabel = createElement('label', { className: 'label' }, ['输入文本'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要加密或解密的文本...',
      rows: 5
    })

    const keyLabel = createElement('label', { className: 'label' }, ['密钥 (Key)'])
    const keyInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '请输入密钥...'
    })

    const keyGroup = createElement('div', { className: 'form-group' }, [keyLabel, keyInput])

    const tabs = createTabGroup([
      { label: '加密', value: 'encrypt' },
      { label: '解密', value: 'decrypt' }
    ], (value) => {
      mode = value
    })

    const outputLabel = createElement('label', { className: 'label' }, ['输出结果'])
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 5,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const actionBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '执行',
      onClick: () => {
        const text = inputTextarea.value
        const key = keyInput.value
        if (!text) {
          outputTextarea.value = ''
          return
        }
        if (!key) {
          outputTextarea.value = '请输入密钥'
          return
        }
        try {
          if (mode === 'encrypt') {
            const encrypted = CryptoJS.AES.encrypt(text, key).toString()
            outputTextarea.value = encrypted
          } else {
            const decrypted = CryptoJS.AES.decrypt(text, key)
            const result = decrypted.toString(CryptoJS.enc.Utf8)
            outputTextarea.value = result || '解密失败，请检查密钥和密文'
          }
        } catch (e) {
          outputTextarea.value = (mode === 'encrypt' ? '加密' : '解密') + '错误: ' + e.message
        }
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [tabs, actionBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [
      createElement('div', { className: 'form-group' }, [outputLabel, outputTextarea]),
      copyBtn
    ])

    container.appendChild(inputLabel)
    container.appendChild(inputTextarea)
    container.appendChild(keyGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
