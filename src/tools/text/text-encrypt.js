import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'
import { decryptPassphrase, encryptPassphrase } from '../../utils/openssl-aes.js'

export default {
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

    const tabs = createSegmentedGroup([
      { label: '加密', value: 'encrypt' },
      { label: '解密', value: 'decrypt' }
    ], (value) => {
      mode = value
    })

    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 5,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick() {
        inputTextarea.value = '这是一段需要加密的机密文本，包含中文和English混合内容。'
        keyInput.value = 'MySecretKey123'
      }
    })

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
            outputTextarea.value = encryptPassphrase(text, key)
          } else {
            // A wrong key can fail while unpadding or while decoding UTF-8.
            // Both mean "could not decrypt", so they share one message instead
            // of surfacing two different low-level errors.
            try {
              outputTextarea.value = decryptPassphrase(text, key) || '解密失败，请检查密钥和密文'
            } catch {
              outputTextarea.value = '解密失败，请检查密钥和密文'
            }
          }
        } catch (e) {
          outputTextarea.value = (mode === 'encrypt' ? '加密' : '解密') + '错误: ' + (e instanceof Error ? e.message : String(e))
        }
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [exampleBtn, actionBtn])
    const outputSection = createSection('输出结果', outputTextarea, [copyBtn])

    container.appendChild(inputLabel)
    container.appendChild(inputTextarea)
    container.appendChild(keyGroup)
    container.appendChild(tabs)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
