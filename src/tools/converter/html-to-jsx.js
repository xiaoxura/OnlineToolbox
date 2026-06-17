import { createElement, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'html-to-jsx',
  name: 'HTML 转 JSX',
  description: '将 HTML 代码转换为 React JSX 语法',
  category: 'converter',
  icon: 'html',

  render(container) {
    const section = createSection('HTML 转 JSX')

    // Input area
    const inputGroup = createElement('div', { className: 'form-group' })
    const inputLabel = createElement('label', { className: 'label', textContent: '输入 HTML' })
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 HTML 代码...',
      rows: 10
    })
    inputGroup.append(inputLabel, input)

    // Convert button
    const btnGroup = createElement('div', { className: 'btn-group' })
    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '转换'
    })
    btnGroup.append(convertBtn)

    // Output area
    const outputGroup = createElement('div', { className: 'form-group' })
    const outputLabel = createElement('label', { className: 'label', textContent: 'JSX 输出' })
    const output = createElement('textarea', {
      className: 'textarea',
      readOnly: true,
      rows: 10
    })

    const copyGroup = createElement('div', { className: 'btn-group' })
    const copyBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '复制结果'
    })
    copyGroup.append(copyBtn)

    outputGroup.append(outputLabel, output, copyGroup)

    // Error display
    const errorEl = createElement('div', { className: 'error-text' })

    section.append(inputGroup, btnGroup, outputGroup, errorEl)
    container.append(section)

    // Self-closing tags
    const selfClosingTags = [
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
      'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]

    function convertHtmlToJsx(html) {
      let result = html

      // class -> className
      result = result.replace(/\bclass\s*=/gi, 'className=')

      // for -> htmlFor
      result = result.replace(/\bfor\s*=/gi, 'htmlFor=')

      // tabindex -> tabIndex
      result = result.replace(/\btabindex\s*=/gi, 'tabIndex=')

      // onclick -> onClick, onfocus -> onFocus, etc.
      result = result.replace(/\bon([a-z]+)\s*=/gi, (match, event) => {
        return 'on' + event.charAt(0).toUpperCase() + event.slice(1) + '='
      })

      // style="..." -> style={{...}}
      result = result.replace(/style\s*=\s*"([^"]*)"/g, (match, styles) => {
        const jsObj = cssStringToJsObject(styles)
        return `style={{${jsObj}}}`
      })

      // Handle self-closing tags
      selfClosingTags.forEach(tag => {
        const regex = new RegExp(`<${tag}([^/]*?)>`, 'gi')
        result = result.replace(regex, (match, attrs) => {
          if (match.endsWith('/>')) return match
          return `<${tag}${attrs} />`
        })
      })

      // checked, disabled, readonly -> boolean
      result = result.replace(/\bchecked\s*=\s*"[^"]*"/gi, 'checked={true}')
      result = result.replace(/\bdisabled\s*=\s*"[^"]*"/gi, 'disabled={true}')
      result = result.replace(/\breadonly\s*=\s*"[^"]*"/gi, 'readOnly={true}')

      // html comment -> JSX comment
      result = result.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}')

      return result
    }

    function cssStringToJsObject(cssStr) {
      return cssStr
        .split(';')
        .filter(s => s.trim())
        .map(rule => {
          const colonIdx = rule.indexOf(':')
          if (colonIdx === -1) return ''
          const prop = rule.substring(0, colonIdx).trim()
          const val = rule.substring(colonIdx + 1).trim()
          // Convert kebab-case to camelCase
          const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          // Check if value is a number (except pure 0)
          const numVal = Number(val)
          if (val !== '' && !isNaN(numVal) && val !== '0') {
            return `${camelProp}: ${val}`
          }
          return `${camelProp}: '${val}'`
        })
        .filter(Boolean)
        .join(', ')
    }

    convertBtn.addEventListener('click', () => {
      errorEl.textContent = ''
      const html = input.value
      if (!html.trim()) {
        output.value = ''
        return
      }
      try {
        output.value = convertHtmlToJsx(html)
      } catch (e) {
        errorEl.textContent = '转换失败: ' + e.message
      }
    })

    copyBtn.addEventListener('click', () => {
      if (output.value) {
        copyToClipboard(output.value)
      }
    })
  }
}
