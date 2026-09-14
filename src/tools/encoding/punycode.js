import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

export default {
  id: 'punycode',
  name: 'Punycode 编解码',
  description: 'Punycode 编解码，用于国际化域名(IDN)转换',
  category: 'encoding',
  icon: 'punycode',
  render(container) {
    let mode = 'text-to-punycode'

    // Punycode parameters (RFC 3492)
    const BASE = 36
    const TMIN = 1
    const TMAX = 26
    const SKEW = 38
    const DAMP = 700
    const INITIAL_BIAS = 72
    const INITIAL_N = 128
    const DELIMITER = '-'

    function adapt(delta, numPoints, firstTime) {
      delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1
      delta += Math.floor(delta / numPoints)
      let k = 0
      while (delta > Math.floor(((BASE - TMIN) * TMAX) / 2)) {
        delta = Math.floor(delta / (BASE - TMIN))
        k += BASE
      }
      return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW))
    }

    function digitToChar(digit) {
      return String.fromCharCode(digit < 26 ? digit + 97 : digit - 26 + 48)
    }

    function charToDigit(code) {
      if (code >= 48 && code <= 57) return code - 48 + 26
      if (code >= 97 && code <= 122) return code - 97
      return -1
    }

    function encodePunycode(input) {
      const codePoints = Array.from(input, ch => ch.codePointAt(0))
      let n = INITIAL_N
      let delta = 0
      let bias = INITIAL_BIAS
      let output = ''
      let basicCount = 0

      for (const cp of codePoints) {
        if (cp < 128) {
          output += String.fromCharCode(cp)
          basicCount++
        }
      }

      let h = basicCount
      if (basicCount > 0) output += DELIMITER

      while (h < codePoints.length) {
        let m = 0x7FFFFFFF
        for (const cp of codePoints) {
          if (cp >= n && cp < m) m = cp
        }

        delta += (m - n) * (h + 1)
        n = m

        for (const cp of codePoints) {
          if (cp < n) {
            delta++
          } else if (cp === n) {
            let q = delta
            for (let k = BASE; ; k += BASE) {
              const t = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias)
              if (q < t) break
              output += digitToChar(t + ((q - t) % (BASE - t)))
              q = Math.floor((q - t) / (BASE - t))
            }
            output += digitToChar(q)
            bias = adapt(delta, h + 1, h === basicCount)
            delta = 0
            h++
          }
        }
        delta++
        n++
      }

      return 'xn--' + output
    }

    function decodePunycode(input) {
      let s = input.trim().toLowerCase()
      if (s.startsWith('xn--')) s = s.substring(4)

      const output = []
      let n = INITIAL_N
      let bias = INITIAL_BIAS

      const basicEnd = s.lastIndexOf(DELIMITER)
      let index = 0
      if (basicEnd > 0) {
        for (let j = 0; j < basicEnd; j++) output.push(s.charCodeAt(j))
        index = basicEnd + 1
      }

      let i = 0
      while (index < s.length) {
        const oldi = i
        let w = 1
        for (let k = BASE; ; k += BASE) {
          if (index >= s.length) throw new Error('无效的 Punycode 编码')
          const digit = charToDigit(s.charCodeAt(index++))
          if (digit < 0) throw new Error('无效的 Punycode 字符')
          i += digit * w
          const t = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias)
          if (digit < t) break
          w *= BASE - t
        }

        const len = output.length + 1
        bias = adapt(i - oldi, len, oldi === 0)
        n += Math.floor(i / len)
        i = i % len

        output.splice(i, 0, n)
        i++
      }

      return String.fromCodePoint(...output)
    }

    const inputLabel = createElement('label', { className: 'label' }, ['输入'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入中文域名或 Punycode...',
      rows: 4,
      onInput: () => convertBtn.click()
    })

    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 4,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const tabs = createSegmentedGroup([
      { value: 'text-to-punycode', label: '文本→Punycode' },
      { value: 'punycode-to-text', label: 'Punycode→文本' }
    ], (key) => {
      mode = key
      inputTextarea.placeholder = key === 'text-to-punycode'
        ? '请输入中文域名，如 例子.测试'
        : '请输入 Punycode，如 xn--fsqu00a.xn--0zwm56d'
    })

    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = inputTextarea.value
        if (!text) return
        try {
          if (mode === 'text-to-punycode') {
            // Process each label in domain separately
            const labels = text.split('.')
            const encoded = labels.map(label => {
              // If label is already ASCII, keep as-is
              if (/^[\x00-\x7F]+$/.test(label)) return label
              return encodePunycode(label)
            })
            outputTextarea.value = encoded.join('.')
          } else {
            // Process each label in domain separately
            const labels = text.split('.')
            const decoded = labels.map(label => {
              // Only decode labels starting with xn--
              if (!label.toLowerCase().startsWith('xn--')) return label
              return decodePunycode(label)
            })
            outputTextarea.value = decoded.join('.')
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
          'text-to-punycode': '例子.测试',
          'punycode-to-text': 'xn--fsqu00a.xn--0zwm56d'
        }
        inputTextarea.value = samples[mode]
        convertBtn.click()
      }
    })

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [convertBtn, sampleBtn])
    const outputSection = createSection('输出结果', outputTextarea, [copyBtn])

    container.appendChild(tabs)
    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
