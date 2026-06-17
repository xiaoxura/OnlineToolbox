import { createElement, createCopyButton, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

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

    function encodePunycode(input) {
      const chars = Array.from(input)
      let n = INITIAL_N
      let delta = 0
      let bias = INITIAL_BIAS
      let b = 0

      // Count basic code points
      for (const ch of chars) {
        const cp = ch.codePointAt(0)
        if (cp < 128) b++
      }

      if (b === 0) return ''

      let output = ''
      // Append basic code points
      for (const ch of chars) {
        const cp = ch.codePointAt(0)
        if (cp < 128) output += ch
      }

      let h = b
      if (b > 0) output += DELIMITER

      // Encode non-basic code points
      while (h < chars.length) {
        // Find minimum non-basic code point >= n
        let m = 0x7FFFFFFF
        for (const ch of chars) {
          const cp = ch.codePointAt(0)
          if (cp >= n && cp < m) m = cp
        }

        delta += (m - n) * (h + 1)
        n = m

        for (const ch of chars) {
          const cp = ch.codePointAt(0)
          if (cp < n) {
            delta++
          } else if (cp === n) {
            let q = delta
            let k = BASE
            while (true) {
              const t = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias)
              if (q < t) break
              output += String.fromCharCode(t + ((q - t) % (BASE - t)) + 97) // 'a' = 97
              q = Math.floor((q - t) / (BASE - t))
              k += BASE
            }
            output += String.fromCharCode(q + 97)
            bias = adapt(delta, h + 1, h === b)
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
      // Remove xn-- prefix if present
      if (s.startsWith('xn--')) {
        s = s.substring(4)
      }

      // Split at last delimiter
      const delimIdx = s.lastIndexOf(DELIMITER)
      let output = []
      let n = INITIAL_N
      let bias = INITIAL_BIAS

      if (delimIdx >= 0) {
        // Extract basic code points
        for (let i = 0; i < delimIdx; i++) {
          output.push(s.charCodeAt(i))
        }
        s = s.substring(delimIdx + 1)
      }

      let i = 0
      let idx = 0

      while (s.length > 0) {
        const oldi = i
        let w = 1
        let k = BASE

        while (true) {
          if (idx >= s.length) throw new Error('无效的 Punycode 编码')
          const digit = s.charCodeAt(idx) - 97 // 'a' = 97
          idx++
          if (digit < 0 || digit >= BASE) throw new Error('无效的 Punycode 字符')
          i += digit * w

          const t = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias)
          if (digit < t) break

          w *= BASE - t
          k += BASE
        }

        const len = output.length + 1
        bias = adapt(i - oldi, len, oldi === 0)
        n += Math.floor(i / len)
        i = i % len

        output.splice(i, 0, n)
        i++
      }

      // Convert code points to string
      return String.fromCodePoint(...output)
    }

    const inputLabel = createElement('label', { className: 'label' }, ['输入'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入中文域名或 Punycode...',
      rows: 4,
      onInput: () => convertBtn.click()
    })

    const outputLabel = createElement('label', { className: 'label' }, ['输出结果'])
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 4,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const tabs = createTabGroup([
      { value: 'text-to-punycode', label: '文本→Punycode' },
      { value: 'punycode-to-text', label: 'Punycode→文本' }
    ], (key) => {
      mode = key
      inputTextarea.placeholder = key === 'text-to-punycode'
        ? '请输入中文域名，如 例子.测试'
        : '请输入 Punycode，如 xn--fsq028c.xn--0zwm56d'
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
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick: () => {
        const samples = {
          'text-to-punycode': '例子.测试',
          'punycode-to-text': 'xn--fsq028c.xn--0zwm56d'
        }
        inputTextarea.value = samples[mode]
        convertBtn.click()
      }
    })

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [convertBtn, sampleBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea, copyBtn])

    container.appendChild(tabs)
    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
