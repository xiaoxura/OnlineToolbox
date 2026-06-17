import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'xml',
  name: 'XML 格式化',
  description: 'XML 代码美化和压缩',
  category: 'formatter',
  icon: 'xml',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 XML 代码...',
      rows: 8
    })

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 10,
      readOnly: true
    })

    const errorEl = createElement('div', {
      className: 'error-text',
      hidden: true
    })

    let currentMode = 'beautify'

    function showError(msg) {
      errorEl.textContent = msg
      errorEl.hidden = false
    }

    function hideError() {
      errorEl.textContent = ''
      errorEl.hidden = true
    }

    function serializeNode(node, depth) {
      const indent = '  '.repeat(depth)

      // Text node
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim()
        return text ? indent + text + '\n' : ''
      }

      // Comment node
      if (node.nodeType === Node.COMMENT_NODE) {
        return indent + '<!--' + node.textContent + '-->\n'
      }

      // CDATA section
      if (node.nodeType === Node.CDATA_SECTION_NODE) {
        return indent + '<![CDATA[' + node.textContent + ']]>\n'
      }

      // Processing instruction
      if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
        return indent + '<?' + node.target + ' ' + node.data + '?>\n'
      }

      // Document type
      if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
        let doctype = '<!DOCTYPE ' + node.name
        if (node.publicId) {
          doctype += ' PUBLIC "' + node.publicId + '"'
        }
        if (node.systemId) {
          doctype += ' "' + node.systemId + '"'
        }
        doctype += '>'
        return indent + doctype + '\n'
      }

      // Element node
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName
        let attrs = ''
        for (const attr of node.attributes) {
          const val = attr.value.replace(/"/g, '&quot;')
          attrs += ' ' + attr.name + '="' + val + '"'
        }

        // Self-closing tag (no children)
        if (node.childNodes.length === 0) {
          return indent + '<' + tagName + attrs + ' />\n'
        }

        // Check if only text content (short)
        if (node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE) {
          const text = node.childNodes[0].textContent.trim()
          if (text.length < 80) {
            return indent + '<' + tagName + attrs + '>' + escapeXML(text) + '</' + tagName + '>\n'
          }
        }

        // Element with children
        let result = indent + '<' + tagName + attrs + '>\n'
        for (const child of node.childNodes) {
          result += serializeNode(child, depth + 1)
        }
        result += indent + '</' + tagName + '>\n'
        return result
      }

      // Document node
      if (node.nodeType === Node.DOCUMENT_NODE) {
        let result = ''
        // Add XML declaration if present in original
        for (const child of node.childNodes) {
          result += serializeNode(child, depth)
        }
        return result
      }

      return ''
    }

    function escapeXML(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    function beautifyXML(xml) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'application/xml')

      // Check for parse errors
      const parseError = doc.querySelector('parsererror')
      if (parseError) {
        // Fallback to regex-based formatting
        return simpleBeautify(xml)
      }

      let result = ''
      for (const child of doc.childNodes) {
        result += serializeNode(child, 0)
      }

      return result.trim()
    }

    function simpleBeautify(xml) {
      let result = ''
      let indent = 0
      const indentStr = '  '

      // Split into tokens: tags, text, comments, CDATA
      const tokens = xml.replace(/>\s+</g, '>\n<').split('\n')

      for (let token of tokens) {
        token = token.trim()
        if (!token) continue

        // Comment
        if (token.startsWith('<!--')) {
          result += indentStr.repeat(indent) + token + '\n'
          continue
        }

        // CDATA
        if (token.startsWith('<![CDATA[')) {
          result += indentStr.repeat(indent) + token + '\n'
          continue
        }

        // Processing instruction or XML declaration
        if (token.startsWith('<?')) {
          result += indentStr.repeat(indent) + token + '\n'
          continue
        }

        // DOCTYPE
        if (token.startsWith('<!')) {
          result += indentStr.repeat(indent) + token + '\n'
          continue
        }

        // Closing tag
        if (token.startsWith('</')) {
          indent = Math.max(0, indent - 1)
          result += indentStr.repeat(indent) + token + '\n'
          continue
        }

        // Opening or self-closing tag
        if (token.startsWith('<')) {
          result += indentStr.repeat(indent) + token + '\n'
          const tagMatch = token.match(/^<(\w+)/)
          if (tagMatch) {
            if (!token.endsWith('/>') && !token.includes('</')) {
              indent++
            }
          }
          continue
        }

        // Text content
        result += indentStr.repeat(indent) + token + '\n'
      }

      return result.trim()
    }

    function minifyXML(xml) {
      // Remove comments
      let result = xml.replace(/<!--[\s\S]*?-->/g, '')
      // Remove whitespace between tags
      result = result.replace(/>\s+</g, '><')
      // Remove leading/trailing whitespace on lines
      result = result.replace(/^\s+|\s+$/gm, '')
      // Collapse multiple whitespace
      result = result.replace(/\s{2,}/g, ' ')
      return result.trim()
    }

    function process() {
      hideError()
      const text = input.value
      if (!text.trim()) {
        output.value = ''
        return
      }
      try {
        if (currentMode === 'beautify') {
          output.value = beautifyXML(text)
        } else {
          output.value = minifyXML(text)
        }
      } catch (e) {
        showError('XML 处理错误: ' + e.message)
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

    const btnGroup = createElement('div', {
      className: 'btn-group'
    }, [tabs, processBtn, copyBtn])

    const inputSection = createSection('输入 XML', input)
    const outputSection = createSection('输出结果', output, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(btnGroup)
    container.appendChild(errorEl)
    container.appendChild(outputSection)
  }
}
