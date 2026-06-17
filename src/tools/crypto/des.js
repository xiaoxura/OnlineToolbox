import { createElement, createCopyButton, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import CryptoJS from 'crypto-js'

export default {
  id: 'des',
  name: 'DES 加解密',
  description: 'DES/3DES 对称加密和解密',
  category: 'crypto',
  icon: 'des',
  render(container) {
    let currentAlgo = 'des'
    let currentMode = 'CBC'

    const modeMap = {
      CBC: CryptoJS.mode.CBC,
      ECB: CryptoJS.mode.ECB
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
      placeholder: 'DES 需要 8 字节密钥，3DES 需要 24 字节密钥...'
    })

    // IV
    const ivLabel = createElement('label', { className: 'label' }, ['初始向量 (IV)'])
    const ivInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: 'CBC 模式需要 IV，留空则自动生成...'
    })

    const ivGroup = createElement('div', { className: 'form-group' }, [ivLabel, ivInput])

    function updateIvVisibility() {
      ivGroup.style.display = currentMode === 'CBC' ? 'block' : 'none'
    }

    // Algorithm tabs
    const algoLabel = createElement('label', { className: 'label' }, ['算法'])
    const algoTabs = createTabGroup([
      { label: 'DES', value: 'des' },
      { label: 'Triple DES', value: '3des' }
    ], (value) => {
      currentAlgo = value
    })

    // Mode tabs
    const modeLabel = createElement('label', { className: 'label' }, ['加密模式'])
    const modeTabs = createTabGroup([
      { label: 'CBC', value: 'CBC' },
      { label: 'ECB', value: 'ECB' }
    ], (value) => {
      currentMode = value
      updateIvVisibility()
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

    function getEncryptFunction() {
      return currentAlgo === 'des' ? CryptoJS.DES.encrypt : CryptoJS.TripleDES.encrypt
    }

    function getDecryptFunction() {
      return currentAlgo === 'des' ? CryptoJS.DES.decrypt : CryptoJS.TripleDES.decrypt
    }

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
            padding: CryptoJS.pad.Pkcs7
          }
          if (currentMode === 'CBC') {
            let ivValue = ivInput.value
            if (!ivValue) {
              ivValue = CryptoJS.lib.WordArray.random(8).toString()
              ivInput.value = ivValue
            }
            options.iv = CryptoJS.enc.Utf8.parse(ivValue)
          }
          const encrypted = getEncryptFunction()(text, key, options)
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
            padding: CryptoJS.pad.Pkcs7
          }
          if (currentMode === 'CBC') {
            const ivValue = ivInput.value
            if (!ivValue) {
              outputTextarea.value = 'CBC 模式解密需要提供 IV'
              return
            }
            options.iv = CryptoJS.enc.Utf8.parse(ivValue)
          }
          const decrypted = getDecryptFunction()(text, key, options)
          const result = decrypted.toString(CryptoJS.enc.Utf8)
          outputTextarea.value = result || '解密失败，请检查密钥和密文'
        } catch (e) {
          outputTextarea.value = '解密错误: ' + e.message
        }
      }
    }, ['解密'])

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = '这是一段需要加密的测试文本 Hello World!'
        keyInput.value = '8bytekey'
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [encryptBtn, decryptBtn, sampleBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(inputLabel)
    container.appendChild(inputTextarea)
    container.appendChild(keyLabel)
    container.appendChild(keyInput)
    container.appendChild(ivGroup)
    container.appendChild(algoLabel)
    container.appendChild(algoTabs)
    container.appendChild(modeLabel)
    container.appendChild(modeTabs)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)

    updateIvVisibility()
  }
}
