import { createElement, createSection } from '../../utils/dom.js'

export default {
  id: 'char-count',
  name: '字符统计',
  description: '统计文本的字符数、行数、字节数等',
  category: 'text',
  icon: 'char-count',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要统计的文本...'
    })

    const statsEl = createElement('div', { className: 'stats-row' })

    function countChineseChars(str) {
      const matches = str.match(/[一-鿿㐀-䶿豈-﫿]/g)
      return matches ? matches.length : 0
    }

    function countDigits(str) {
      const matches = str.match(/\d/g)
      return matches ? matches.length : 0
    }

    function getByteLength(str) {
      let bytes = 0
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)
        if (code <= 0x7f) {
          bytes += 1
        } else if (code <= 0x7ff) {
          bytes += 2
        } else if (code <= 0xffff) {
          bytes += 3
        } else {
          bytes += 4
        }
      }
      return bytes
    }

    function updateStats() {
      const text = input.value
      const charCount = text.length
      const byteCount = getByteLength(text)
      const lineCount = text === '' ? 0 : text.split('\n').length
      const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
      const chineseCount = countChineseChars(text)
      const digitCount = countDigits(text)

      const stats = [
        { label: '字符数', value: charCount },
        { label: '字节数(UTF-8)', value: byteCount },
        { label: '行数', value: lineCount },
        { label: '单词数', value: wordCount },
        { label: '中文字符数', value: chineseCount },
        { label: '数字个数', value: digitCount }
      ]

      statsEl.innerHTML = ''
      stats.forEach(s => {
        const card = createElement('div', { className: 'stat-item' })
        const value = createElement('div', { className: 'stat-value', textContent: String(s.value) })
        const label = createElement('div', { className: 'stat-label', textContent: s.label })
        card.appendChild(value)
        card.appendChild(label)
        statsEl.appendChild(card)
      })
    }

    input.addEventListener('input', updateStats)

    const section = createSection('字符统计', input)
    const resultSection = createSection('统计结果', statsEl)

    container.appendChild(section)
    container.appendChild(resultSection)
    updateStats()
  }
}
