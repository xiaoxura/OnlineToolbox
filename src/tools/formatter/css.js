import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'css',
  name: 'CSS 格式化',
  description: 'CSS 代码美化和压缩',
  category: 'formatter',
  icon: 'css',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 CSS 代码...',
      rows: 8
    })

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 10,
      readOnly: true
    })

    let currentMode = 'beautify'

    function beautifyCSS(css) {
      // Remove comments
      let result = css.replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize whitespace
      result = result.replace(/\s+/g, ' ').trim()

      let formatted = ''
      let indent = 0
      const indentStr = '  '
      let i = 0

      while (i < result.length) {
        const ch = result[i]

        if (ch === '{') {
          formatted = formatted.trimEnd()
          formatted += ' {\n'
          indent++
          formatted += indentStr.repeat(indent)
          i++
          // Skip whitespace after {
          while (i < result.length && result[i] === ' ') i++
        } else if (ch === '}') {
          formatted = formatted.trimEnd()
          formatted += '\n'
          indent = Math.max(0, indent - 1)
          formatted += indentStr.repeat(indent) + '}\n'
          i++
          // Skip whitespace after }
          while (i < result.length && result[i] === ' ') i++
          // Add blank line between rule blocks
          if (i < result.length && result[i] !== '}') {
            formatted += '\n'
          }
        } else if (ch === ';') {
          formatted += ';\n'
          formatted += indentStr.repeat(indent)
          i++
          // Skip whitespace after ;
          while (i < result.length && result[i] === ' ') i++
        } else if (ch === ':') {
          formatted += ': '
          i++
          // Skip whitespace after :
          while (i < result.length && result[i] === ' ') i++
        } else {
          formatted += ch
          i++
        }
      }

      // Clean up: remove trailing whitespace on lines, collapse multiple blank lines
      return formatted
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }

    function minifyCSS(css) {
      // Remove comments
      let result = css.replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove newlines and excess whitespace
      result = result.replace(/\s+/g, ' ')
      // Remove spaces around special characters
      result = result.replace(/\s*{\s*/g, '{')
      result = result.replace(/\s*}\s*/g, '}')
      result = result.replace(/\s*;\s*/g, ';')
      result = result.replace(/\s*:\s*/g, ':')
      result = result.replace(/\s*,\s*/g, ',')
      // Remove last semicolon before }
      result = result.replace(/;}/g, '}')
      return result.trim()
    }

    function process() {
      const text = input.value
      if (!text.trim()) {
        output.value = ''
        return
      }
      if (currentMode === 'beautify') {
        output.value = beautifyCSS(text)
      } else {
        output.value = minifyCSS(text)
      }
    }

    const tabs = createTabGroup([
      { label: '美化', value: 'beautify' },
      { label: '压缩', value: 'minify' }
    ], (value) => {
      currentMode = value
      process()
    })

    const processBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: process
    }, ['格式化'])

    const copyBtn = createCopyButton(() => output.value)

    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据'
    })

    const btnGroup = createElement('div', {
      className: 'btn-group'
    }, [tabs, processBtn, exampleBtn, copyBtn])

    const inputSection = createSection('输入 CSS', input)
    const outputSection = createSection('输出结果', output, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)

    exampleBtn.addEventListener('click', () => {
      input.value = `.header{background-color:#4CAF50;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 4px rgba(0,0,0,0.1)}.nav-item{color:#fff;font-size:14px;margin:0 10px;cursor:pointer;transition:opacity 0.3s}.nav-item:hover{opacity:0.8}.logo{font-weight:bold;font-size:20px}`
    })
  }
}
