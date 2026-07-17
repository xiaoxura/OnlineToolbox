import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

export default {
  id: 'hex',
  name: 'Hex 编解码',
  description: '文本与十六进制编码互相转换，支持数字进制转换',
  category: 'encoding',
  icon: 'hex',
  render(container) {
    let mode = 'text-to-hex' // 'text-to-hex', 'hex-to-text', 'hex-to-dec', 'dec-to-hex'

    const inputLabel = createElement('label', { className: 'label' }, ['输入'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入文本...',
      rows: 6,
      onInput: () => convertBtn.click()
    })

    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 6,
      readOnly: true
    })

    const tabs = createSegmentedGroup([
      { value: 'text-to-hex', label: '文本→Hex' },
      { value: 'hex-to-text', label: 'Hex→文本' },
      { value: 'hex-to-dec', label: 'Hex→Decimal' },
      { value: 'dec-to-hex', label: 'Decimal→Hex' }
    ], (key) => {
      mode = key
      const placeholders = {
        'text-to-hex': '请输入文本...',
        'hex-to-text': '请输入十六进制字符串，如 48656C6C6F...',
        'hex-to-dec': '请输入十六进制数，如 FF 或 0xFF...',
        'dec-to-hex': '请输入十进制数，如 255...'
      }
      inputTextarea.placeholder = placeholders[key]
    })

    function textToHex(text) {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(text)
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
    }

    function hexToText(hex) {
      const cleanHex = hex.replace(/[\s,]/g, '').replace(/^0x/i, '')
      if (cleanHex.length % 2 !== 0) throw new Error('十六进制字符串长度必须为偶数')
      const bytes = new Uint8Array(cleanHex.length / 2)
      for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16)
      }
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(bytes)
    }

    function hexToDec(hex) {
      const values = hex.trim().split(/[\s,]+/)
      return values.map(v => {
        const clean = v.replace(/^0x/i, '').trim()
        if (!clean) return ''
        const num = parseInt(clean, 16)
        if (isNaN(num)) throw new Error('无效的十六进制数: ' + v)
        return num.toString()
      }).join(' ')
    }

    function decToHex(dec) {
      const values = dec.trim().split(/[\s,]+/)
      return values.map(v => {
        const num = parseInt(v.trim(), 10)
        if (isNaN(num)) throw new Error('无效的十进制数: ' + v)
        return num.toString(16).toUpperCase().padStart(2, '0')
      }).join(' ')
    }

    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        try {
          switch (mode) {
            case 'text-to-hex':
              outputTextarea.value = textToHex(text)
              break
            case 'hex-to-text':
              outputTextarea.value = hexToText(text)
              break
            case 'hex-to-dec':
              outputTextarea.value = hexToDec(text)
              break
            case 'dec-to-hex':
              outputTextarea.value = decToHex(text)
              break
          }
        } catch (e) {
          outputTextarea.value = '转换错误: ' + e.message
        }
      }
    }, ['转换'])

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick: () => {
        const samples = {
          'text-to-hex': 'Hello, World! 你好世界',
          'hex-to-text': '48 65 6C 6C 6F 2C 20 57 6F 72 6C 64 21',
          'hex-to-dec': 'FF 0A 1F 7B',
          'dec-to-hex': '255 10 31 123'
        }
        inputTextarea.value = samples[mode]
        convertBtn.click()
      }
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [convertBtn, sampleBtn])
    const outputSection = createSection('输出结果', outputTextarea, [copyBtn])

    container.appendChild(tabs)
    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
