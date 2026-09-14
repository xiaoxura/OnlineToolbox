import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

const ALGORITHMS = {
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha512: 'SHA-512'
}

export default {
  id: 'sha',
  name: 'SHA 哈希',
  description: '计算 SHA-1/SHA-256/SHA-512 哈希值',
  category: 'crypto',
  icon: 'sha',
  render(container) {
    let currentAlgo = 'sha256'
    let requestId = 0

    async function computeHash() {
      const text = inputTextarea.value
      if (!text) {
        outputTextarea.value = ''
        return
      }
      const id = ++requestId
      try {
        const digest = await crypto.subtle.digest(ALGORITHMS[currentAlgo], new TextEncoder().encode(text))
        if (id !== requestId) return
        outputTextarea.value = [...new Uint8Array(digest)]
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join('')
      } catch (error) {
        if (id !== requestId) return
        outputTextarea.value = `计算失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    const inputLabel = createElement('label', { className: 'label' }, ['输入文本'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要计算 SHA 哈希的文本...',
      rows: 6,
      onInput: computeHash
    })

    const tabs = createSegmentedGroup([
      { label: 'SHA-1', value: 'sha1' },
      { label: 'SHA-256', value: 'sha256' },
      { label: 'SHA-512', value: 'sha512' }
    ], (value) => {
      currentAlgo = value
      computeHash()
    })

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
        inputTextarea.value = 'Hello, World! 你好世界'
        computeHash()
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [sampleBtn])
    const outputSection = createSection('哈希值', outputTextarea, [copyBtn])

    container.appendChild(inputLabel)
    container.appendChild(inputTextarea)
    container.appendChild(tabs)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
