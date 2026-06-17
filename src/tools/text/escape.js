import { createElement, createSection, createTabGroup, createCopyButton } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'escape',
  name: '转义工具',
  description: 'JSON/JS/HTML 特殊字符转义',
  category: 'text',
  icon: 'escape',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要转义的文本...'
    })

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '转义结果...',
      readOnly: true
    })

    const tabs = [
      { label: 'JSON转义', value: 'json' },
      { label: 'JavaScript转义', value: 'js' },
      { label: 'HTML转义', value: 'html' },
      { label: 'URL转义', value: 'url' }
    ]

    let currentMode = 'json'

    // JSON escape/unescape
    function jsonEscape(text) {
      return JSON.stringify(text).slice(1, -1)
    }

    function jsonUnescape(text) {
      try {
        return JSON.parse('"' + text + '"')
      } catch {
        try {
          return JSON.parse(text)
        } catch {
          throw new Error('无效的JSON转义文本')
        }
      }
    }

    // JavaScript escape/unescape
    function jsEscape(text) {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\0/g, '\\0')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e')
        .replace(/&/g, '\\x26')
    }

    function jsUnescape(text) {
      return text
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\0/g, '\0')
        .replace(/\\x3c/gi, '<')
        .replace(/\\x3e/gi, '>')
        .replace(/\\x26/gi, '&')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    }

    // HTML escape/unescape
    function htmlEscape(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#47;',
        '`': '&#96;'
      }
      return text.replace(/[&<>"'/`]/g, ch => map[ch])
    }

    function htmlUnescape(text) {
      const map = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#x27;': "'",
        '&#47;': '/',
        '&#96;': '`',
        '&nbsp;': ' '
      }
      return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x27;|&#47;|&#96;|&nbsp;/g, m => map[m])
    }

    // URL escape/unescape
    function urlEscape(text) {
      return encodeURIComponent(text)
    }

    function urlUnescape(text) {
      try {
        return decodeURIComponent(text)
      } catch {
        throw new Error('无效的URL编码文本')
      }
    }

    const escapeFunctions = {
      json: { escape: jsonEscape, unescape: jsonUnescape },
      js: { escape: jsEscape, unescape: jsUnescape },
      html: { escape: htmlEscape, unescape: htmlUnescape },
      url: { escape: urlEscape, unescape: urlUnescape }
    }

    function showError(msg) {
      output.value = ''
      output.placeholder = '错误: ' + msg
    }

    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick() {
        input.value = `Hello <World> & "Friends"!\n包含特殊字符: '单引号' & "双引号" <标签>\n路径: C:\\Users\\test\\file.txt\nURL: https://example.com/search?q=hello world&lang=zh\n换行符:\\t制表符\\n换行符\\r回车符`
      }
    })

    const escapeBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '转义',
      onClick() {
        try {
          output.placeholder = '转义结果...'
          output.value = escapeFunctions[currentMode].escape(input.value)
        } catch (e) {
          showError(e.message)
        }
      }
    })

    const unescapeBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '反转义',
      onClick() {
        try {
          output.placeholder = '转义结果...'
          output.value = escapeFunctions[currentMode].unescape(input.value)
        } catch (e) {
          showError(e.message)
        }
      }
    })

    const copyBtn = createCopyButton(() => output.value)

    const actionsRow = createElement('div', { className: 'btn-group' })
    actionsRow.appendChild(exampleBtn)
    actionsRow.appendChild(escapeBtn)
    actionsRow.appendChild(unescapeBtn)
    actionsRow.appendChild(copyBtn)

    const tabGroup = createTabGroup(tabs, (value) => {
      currentMode = value
      output.value = ''
      output.placeholder = '转义结果...'
    })

    const inputSection = createSection('输入文本', input)
    const resultSection = createSection('转义结果', output)

    container.appendChild(tabGroup)
    container.appendChild(inputSection)
    container.appendChild(actionsRow)
    container.appendChild(resultSection)
  }
}
