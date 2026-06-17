import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'html',
  name: 'HTML 格式化',
  description: 'HTML 代码美化和压缩',
  category: 'formatter',
  icon: 'html',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 HTML 代码...',
      rows: 8
    })

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 10,
      readOnly: true
    })

    let currentMode = 'beautify'

    const selfClosingTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ])

    const inlineTags = new Set([
      'a', 'abbr', 'acronym', 'b', 'bdo', 'big', 'br', 'cite', 'code',
      'dfn', 'em', 'i', 'img', 'input', 'kbd', 'label', 'map', 'object',
      'output', 'q', 'samp', 'select', 'small', 'span', 'strong', 'sub',
      'sup', 'textarea', 'time', 'tt', 'u', 'var'
    ])

    function beautifyHTML(html) {
      // Parse using DOMParser
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      // Check for parse errors
      const parserError = doc.querySelector('parsererror')
      if (parserError) {
        // Fallback: do simple regex-based formatting
        return simpleBeautify(html)
      }

      function walk(node, depth) {
        const indent = '  '.repeat(depth)
        let result = ''

        for (const child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent.trim()
            if (text) {
              result += indent + text + '\n'
            }
          } else if (child.nodeType === Node.COMMENT_NODE) {
            result += indent + '<!--' + child.textContent + '-->\n'
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName.toLowerCase()
            const attrs = serializeAttributes(child)

            if (selfClosingTags.has(tag)) {
              result += indent + '<' + tag + attrs + ' />\n'
            } else if (child.childNodes.length === 0) {
              result += indent + '<' + tag + attrs + '></' + tag + '>\n'
            } else if (child.childNodes.length === 1 && child.childNodes[0].nodeType === Node.TEXT_NODE) {
              const text = child.childNodes[0].textContent.trim()
              if (text.length < 80) {
                result += indent + '<' + tag + attrs + '>' + text + '</' + tag + '>\n'
              } else {
                result += indent + '<' + tag + attrs + '>\n'
                result += indent + '  ' + text + '\n'
                result += indent + '</' + tag + '>\n'
              }
            } else {
              result += indent + '<' + tag + attrs + '>\n'
              result += walk(child, depth + 1)
              result += indent + '</' + tag + '>\n'
            }
          }
        }
        return result
      }

      function serializeAttributes(el) {
        let attrs = ''
        for (const attr of el.attributes) {
          const val = attr.value.replace(/"/g, '&quot;')
          attrs += ' ' + attr.name + '="' + val + '"'
        }
        return attrs
      }

      let result = walk(doc.documentElement, 0)
      // Add doctype if present
      if (html.trim().toLowerCase().startsWith('<!doctype')) {
        result = '<!DOCTYPE html>\n' + result
      }
      return result.trim()
    }

    function simpleBeautify(html) {
      let result = ''
      let indent = 0
      const indentStr = '  '

      // Tokenize: split into tags and text
      const tokens = html.replace(/>\s+</g, '>\n<').split('\n')

      for (let token of tokens) {
        token = token.trim()
        if (!token) continue

        if (token.startsWith('</')) {
          // Closing tag
          indent = Math.max(0, indent - 1)
          result += indentStr.repeat(indent) + token + '\n'
        } else if (token.startsWith('<')) {
          result += indentStr.repeat(indent) + token + '\n'
          // Check if it's a self-closing tag or has inline closing
          const tagMatch = token.match(/^<(\w+)/)
          if (tagMatch) {
            const tagName = tagMatch[1].toLowerCase()
            if (!selfClosingTags.has(tagName) && !token.endsWith('/>') && !token.includes('</')) {
              indent++
            }
          }
        } else {
          result += indentStr.repeat(indent) + token + '\n'
        }
      }

      return result.trim()
    }

    function minifyHTML(html) {
      // Remove HTML comments (but not conditional comments)
      let result = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
      // Remove whitespace between tags
      result = result.replace(/>\s+</g, '><')
      // Remove leading/trailing whitespace
      result = result.replace(/^\s+|\s+$/gm, '')
      // Collapse multiple spaces
      result = result.replace(/\s{2,}/g, ' ')
      // Remove whitespace around block-level tags
      result = result.replace(/\s*(<\/?(?:html|head|body|div|p|table|tr|td|th|ul|ol|li|h[1-6]|form|fieldset|blockquote|pre|hr|br|meta|link|title|style|script)[^>]*>)\s*/gi, '$1')
      return result.trim()
    }

    function process() {
      const text = input.value
      if (!text.trim()) {
        output.value = ''
        return
      }
      if (currentMode === 'beautify') {
        output.value = beautifyHTML(text)
      } else {
        output.value = minifyHTML(text)
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

    const inputSection = createSection('输入 HTML', input)
    const outputSection = createSection('输出结果', output, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
