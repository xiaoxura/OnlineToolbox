import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'radix',
  name: '进制转换',
  description: '2/8/10/16 进制数相互转换',
  category: 'converter',
  icon: 'radix',
  render(container) {
    const radixLabels = {
      2: '二进制',
      8: '八进制',
      10: '十进制',
      16: '十六进制'
    }

    const radixSelect = createElement('select', { className: 'select' }, [
      createElement('option', { value: '2', textContent: '二进制 (2)' }),
      createElement('option', { value: '8', textContent: '八进制 (8)' }),
      createElement('option', { value: '10', textContent: '十进制 (10)', selected: '' }),
      createElement('option', { value: '16', textContent: '十六进制 (16)' })
    ])

    const input = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '输入要转换的数值'
    })

    const errorEl = createElement('div', {
      className: 'error-text'
    })

    const resultsEl = createElement('div', { className: 'radix-results' })

    function convert() {
      const val = input.value.trim()
      resultsEl.innerHTML = ''
      errorEl.textContent = ''

      if (!val) return

      const srcRadix = parseInt(radixSelect.value, 10)

      // Validate input
      const validChars = '0123456789abcdefABCDEF'
      const allowed = validChars.slice(0, srcRadix)
      const cleanVal = val.replace(/^-/, '').toLowerCase()

      for (const ch of cleanVal) {
        if (!allowed.includes(ch)) {
          errorEl.textContent = `输入包含无效字符 "${ch}"，${radixLabels[srcRadix]} 只允许使用 ${allowed}`
          return
        }
      }

      const isNegative = val.startsWith('-')
      const num = parseInt(cleanVal, srcRadix)
      if (isNaN(num)) {
        errorEl.textContent = '无法解析输入值'
        return
      }

      const targetRadices = [2, 8, 10, 16]
      for (const radix of targetRadices) {
        const converted = isNegative ? (-num).toString(radix).toUpperCase() : num.toString(radix).toUpperCase()
        const displayVal = isNegative ? '-' + converted : converted

        const row = createElement('div', { className: 'radix-row' })
        const label = createElement('span', {
          className: 'radix-label',
          textContent: radixLabels[radix] + ':'
        })
        const value = createElement('span', {
          className: 'radix-value',
          textContent: displayVal
        })
        const copyBtn = createCopyButton(displayVal)

        row.appendChild(label)
        row.appendChild(value)
        row.appendChild(copyBtn)
        resultsEl.appendChild(row)
      }
    }

    input.addEventListener('input', convert)
    radixSelect.addEventListener('change', convert)

    const inputRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '输入数值' }),
        input
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '进制' }),
        radixSelect
      ])
    ])
    const inputContent = createElement('div', {}, [inputRow, errorEl])
    const inputSection = createSection('输入', inputContent)
    const resultSection = createSection('转换结果', resultsEl)

    container.appendChild(inputSection)
    container.appendChild(resultSection)
  }
}
