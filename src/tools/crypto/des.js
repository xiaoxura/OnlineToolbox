import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { desCrypt } from '../../utils/des.js'
import { fromBase64, toBase64 } from '../../utils/hash.js'

// Derive fixed-length raw key material from a passphrase. The IV stays explicit
// (unlike crypto-js's OpenSSL-style passphrase mode, which ignores it).
function deriveKey(passphrase, bytes) {
  return sha256(new TextEncoder().encode(String(passphrase ?? ''))).slice(0, bytes)
}

// Accept a 16-char hex IV or an 8-character text IV.
function parseIv(value) {
  const text = String(value ?? '')
  if (/^[0-9a-fA-F]{16}$/.test(text)) return Uint8Array.from(text.match(/../g), pair => parseInt(pair, 16))
  const bytes = new TextEncoder().encode(text)
  if (bytes.length !== 8) throw new Error('IV 必须是 8 字节（8 个字符或 16 位十六进制）')
  return bytes
}

function decodeCiphertext(text) {
  const value = String(text ?? '').trim()
  if (!value) throw new Error('请输入密文')
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    return Uint8Array.from(value.match(/../g), pair => parseInt(pair, 16))
  }
  try {
    return fromBase64(value)
  } catch {
    throw new Error('密文不是合法的 Base64 或十六进制')
  }
}

export default {
  render(container) {
    let currentAlgo = 'des'
    let currentMode = 'CBC'

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
    const algoTabs = createSegmentedGroup([
      { label: 'DES', value: 'des' },
      { label: 'Triple DES', value: '3des' }
    ], (value) => {
      currentAlgo = value
    }, { label: '算法' })

    // Mode tabs
    const modeLabel = createElement('label', { className: 'label' }, ['加密模式'])
    const modeTabs = createSegmentedGroup([
      { label: 'CBC', value: 'CBC' },
      { label: 'ECB', value: 'ECB' }
    ], (value) => {
      currentMode = value
      updateIvVisibility()
    }, { label: '加密模式' })

    // Output
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 5,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)
    const keyBytes = () => currentAlgo === '3des' ? 24 : 8

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
          let iv
          if (currentMode === 'CBC') {
            let ivValue = ivInput.value
            if (!ivValue) {
              const random = new Uint8Array(8)
              crypto.getRandomValues(random)
              ivValue = [...random].map(byte => byte.toString(16).padStart(2, '0')).join('')
              ivInput.value = ivValue
            }
            iv = parseIv(ivValue)
          }
          const encrypted = desCrypt(
            new TextEncoder().encode(text),
            deriveKey(key, keyBytes()),
            { triple: currentAlgo === '3des', mode: currentMode, iv }
          )
          outputTextarea.value = toBase64(encrypted)
        } catch (e) {
          outputTextarea.value = '加密错误: ' + (e instanceof Error ? e.message : String(e))
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
          let iv
          if (currentMode === 'CBC') {
            const ivValue = ivInput.value
            if (!ivValue) {
              outputTextarea.value = 'CBC 模式解密需要提供 IV'
              return
            }
            iv = parseIv(ivValue)
          }
          const decrypted = desCrypt(
            decodeCiphertext(text),
            deriveKey(key, keyBytes()),
            { decrypt: true, triple: currentAlgo === '3des', mode: currentMode, iv }
          )
          outputTextarea.value = new TextDecoder().decode(decrypted) || '解密失败，请检查密钥和密文'
        } catch (e) {
          outputTextarea.value = '解密错误: ' + (e instanceof Error ? e.message : String(e))
        }
      }
    }, ['解密'])

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = '这是一段需要加密的测试文本 Hello World!'
        keyInput.value = '8bytekey'
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [encryptBtn, decryptBtn, sampleBtn])
    const outputSection = createSection('输出结果', outputTextarea, [copyBtn])

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
