import { createElement, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

const CN_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const CN_UNITS = ['', '拾', '佰', '仟']
const CN_BIG_UNITS = ['', '万', '亿', '万亿']

export default {
  id: 'amount-cn',
  name: '中文大写金额',
  description: '将数字金额转换为中文大写',
  category: 'converter',
  icon: 'radix',

  render(container) {
    const section = createSection('中文大写金额')

    const inputGroup = createElement('div', { className: 'form-group' })
    const inputLabel = createElement('label', { className: 'label', textContent: '输入金额（支持小数）' })
    const input = createElement('input', {
      className: 'input',
      attrs: { type: 'text', placeholder: '12345678.90' }
    })
    inputGroup.appendChild(inputLabel)
    inputGroup.appendChild(input)

    const btnGroup = createElement('div', { className: 'btn-group' })
    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '转换'
    })
    btnGroup.appendChild(convertBtn)

    const resultBox = createElement('div', { className: 'result-box' })
    const errorText = createElement('div', { className: 'error-text', style: 'display:none' })

    section.appendChild(inputGroup)
    section.appendChild(btnGroup)
    section.appendChild(errorText)
    section.appendChild(resultBox)
    container.appendChild(section)

    function convertSection(num) {
      if (num === 0) return '零'

      let result = ''
      let zeroFlag = false
      let unitIdx = 0

      while (num > 0) {
        const digit = num % 10
        if (digit === 0) {
          zeroFlag = true
        } else {
          if (zeroFlag) {
            result = CN_DIGITS[0] + result
            zeroFlag = false
          }
          result = CN_DIGITS[digit] + CN_UNITS[unitIdx] + result
        }
        unitIdx++
        num = Math.floor(num / 10)
      }

      return result
    }

    function numberToChinese(numStr) {
      numStr = numStr.replace(/,/g, '')

      if (!/^-?\d+(\.\d+)?$/.test(numStr)) {
        return null
      }

      let isNegative = false
      if (numStr.startsWith('-')) {
        isNegative = true
        numStr = numStr.substring(1)
      }

      const parts = numStr.split('.')
      let intPart = parts[0]
      const decPart = parts[1] || ''

      intPart = intPart.replace(/^0+/, '') || '0'

      let result = ''
      if (intPart === '0') {
        result = '零'
      } else {
        let groupIdx = 0
        let remaining = intPart
        const groups = []

        while (remaining.length > 0) {
          const chunk = remaining.length > 4 ? remaining.slice(-4) : remaining
          remaining = remaining.length > 4 ? remaining.slice(0, -4) : ''
          groups.unshift(chunk)
        }

        groups.forEach((group, idx) => {
          const bigUnitIdx = groups.length - 1 - idx
          const num = parseInt(group, 10)
          if (num === 0) {
            if (result && !result.endsWith('零')) {
              result += '零'
            }
          } else {
            let sectionStr = convertSection(num)
            if (result && !result.endsWith('零') && sectionStr.startsWith('零')) {
              // already has zero prefix handled
            }
            if (result && !result.endsWith('零') && bigUnitIdx > 0 && num < 1000) {
              result += '零'
            }
            result += sectionStr + CN_BIG_UNITS[bigUnitIdx]
          }
        })
      }

      if (decPart.length === 0) {
        result += '元整'
      } else {
        result += '元'
        const jiao = decPart[0] ? parseInt(decPart[0], 10) : 0
        const fen = decPart[1] ? parseInt(decPart[1], 10) : 0

        if (jiao === 0 && fen === 0) {
          result += '整'
        } else {
          if (jiao === 0) {
            result += '零'
          } else {
            result += CN_DIGITS[jiao] + '角'
          }
          if (fen !== 0) {
            result += CN_DIGITS[fen] + '分'
          }
        }
      }

      if (isNegative) {
        result = '负' + result
      }

      return result
    }

    function convert() {
      errorText.style.display = 'none'
      resultBox.innerHTML = ''

      const val = input.value.trim()
      if (!val) {
        errorText.textContent = '请输入金额'
        errorText.style.display = 'block'
        return
      }

      const cnResult = numberToChinese(val)
      if (cnResult === null) {
        errorText.textContent = '无效的数字格式'
        errorText.style.display = 'block'
        return
      }

      const numDisplay = parseFloat(val.replace(/,/g, '')).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      const statsRow = createElement('div', { className: 'stats-row' })

      const numItem = createElement('div', { className: 'stat-item' })
      const numLabel = createElement('span', { className: 'stat-label', textContent: '数字金额' })
      const numValue = createElement('span', { className: 'stat-value', textContent: numDisplay + ' 元' })
      numItem.appendChild(numLabel)
      numItem.appendChild(numValue)
      statsRow.appendChild(numItem)

      const cnItem = createElement('div', { className: 'stat-item' })
      const cnLabel = createElement('span', { className: 'stat-label', textContent: '中文大写' })
      const cnValue = createElement('span', { className: 'stat-value', textContent: cnResult })
      cnItem.appendChild(cnLabel)
      cnItem.appendChild(cnValue)
      statsRow.appendChild(cnItem)

      resultBox.appendChild(statsRow)

      const copyGroup = createElement('div', { className: 'btn-group' })

      const copyCnBtn = createElement('button', {
        className: 'btn btn-secondary',
        textContent: '复制大写'
      })
      copyCnBtn.addEventListener('click', () => {
        copyToClipboard(cnResult)
        copyCnBtn.textContent = '已复制'
        setTimeout(() => { copyCnBtn.textContent = '复制大写' }, 1500)
      })

      const copyNumBtn = createElement('button', {
        className: 'btn btn-secondary',
        textContent: '复制数字'
      })
      copyNumBtn.addEventListener('click', () => {
        copyToClipboard(numDisplay)
        copyNumBtn.textContent = '已复制'
        setTimeout(() => { copyNumBtn.textContent = '复制数字' }, 1500)
      })

      copyGroup.appendChild(copyCnBtn)
      copyGroup.appendChild(copyNumBtn)
      resultBox.appendChild(copyGroup)
    }

    convertBtn.addEventListener('click', convert)
  }
}
