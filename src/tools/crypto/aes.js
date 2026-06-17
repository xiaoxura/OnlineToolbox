import { createElement, createCopyButton, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import CryptoJS from 'crypto-js'

export default {
  id: 'aes',
  name: 'AES 加解密',
  description: 'AES 对称加密和解密',
  category: 'crypto',
  icon: 'aes',
  render(container) {
    let currentMode = 'CBC'
    let currentPadding = 'Pkcs7'

    const modeMap = {
      CBC: CryptoJS.mode.CBC,
      ECB: CryptoJS.mode.ECB,
      CTR: CryptoJS.mode.CTR
    }

    const paddingMap = {
      Pkcs7: CryptoJS.pad.Pkcs7,
      ZeroPadding: CryptoJS.pad.ZeroPadding,
      NoPadding: CryptoJS.pad.NoPadding
    }

    // Input
    const inputLabel = createElement('label', { className: 'label' }, ['输入文本'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要加密或解密的文本...',
      rows: 5
    })

    // Key
    const keyLabel = createElement('label', { className: 'label' }, ['密钥 (Key)'])
    const keyInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '请输入密钥...'
    })

    // IV
    const ivLabel = createElement('label', { className: 'label' }, ['初始向量 (IV)'])
    const ivInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: 'CBC/CTR 模式需要 IV，留空则自动生成...'
    })

    const ivGroup = createElement('div', { className: 'form-group' }, [ivLabel, ivInput])

    function updateIvVisibility() {
      ivGroup.style.display = (currentMode === 'CBC' || currentMode === 'CTR') ? 'block' : 'none'
    }

    // Mode tabs
    const modeLabel = createElement('label', { className: 'label' }, ['加密模式'])
    const modeTabs = createTabGroup([
      { label: 'CBC', value: 'CBC' },
      { label: 'ECB', value: 'ECB' },
      { label: 'CTR', value: 'CTR' }
    ], (value) => {
      currentMode = value
      updateIvVisibility()
    })

    // Padding tabs
    const paddingLabel = createElement('label', { className: 'label' }, ['填充方式'])
    const paddingTabs = createTabGroup([
      { label: 'Pkcs7', value: 'Pkcs7' },
      { label: 'ZeroPadding', value: 'ZeroPadding' },
      { label: 'NoPadding', value: 'NoPadding' }
    ], (value) => {
      currentPadding = value
    })

    // Output
    const outputLabel = createElement('label', { className: 'label' }, ['输出结果'])
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 5,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    // Encrypt button
    const encryptBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = inputTextarea.value
        const key = keyInput.value
        if (!text || !key) {
          outputTextarea.value = '请输入文本和密钥'
          return
        }
        try {
          const options = {
            mode: modeMap[currentMode],
            padding: paddingMap[currentPadding]
          }
          if (currentMode === 'CBC' || currentMode === 'CTR') {
            let ivValue = ivInput.value
            if (!ivValue) {
              ivValue = CryptoJS.lib.WordArray.random(16).toString()
              ivInput.value = ivValue
            }
            options.iv = CryptoJS.enc.Utf8.parse(ivValue)
          }
          const encrypted = CryptoJS.AES.encrypt(text, key, options)
          outputTextarea.value = encrypted.toString()
        } catch (e) {
          outputTextarea.value = '加密错误: ' + e.message
        }
      }
    }, ['加密'])

    // Decrypt button
    const decryptBtn = createElement('button', {
      className: 'btn btn-secondary',
      onClick: () => {
        const text = inputTextarea.value
        const key = keyInput.value
        if (!text || !key) {
          outputTextarea.value = '请输入文本和密钥'
          return
        }
        try {
          const options = {
            mode: modeMap[currentMode],
            padding: paddingMap[currentPadding]
          }
          if (currentMode === 'CBC' || currentMode === 'CTR') {
            const ivValue = ivInput.value
            if (!ivValue) {
              outputTextarea.value = 'CBC/CTR 模式解密需要提供 IV'
              return
            }
            options.iv = CryptoJS.enc.Utf8.parse(ivValue)
          }
          const decrypted = CryptoJS.AES.decrypt(text, key, options)
          const result = decrypted.toString(CryptoJS.enc.Utf8)
          outputTextarea.value = result || '解密失败，请检查密钥和密文'
        } catch (e) {
          outputTextarea.value = '解密错误: ' + e.message
        }
      }
    }, ['解密'])

    const btnGroup = createElement('div', { className: 'btn-group' }, [encryptBtn, decryptBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(inputLabel)
    container.appendChild(inputTextarea)
    container.appendChild(keyLabel)
    container.appendChild(keyInput)
    container.appendChild(ivGroup)
    container.appendChild(modeLabel)
    container.appendChild(modeTabs)
    container.appendChild(paddingLabel)
    container.appendChild(paddingTabs)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)

    updateIvVisibility()
  }
}
