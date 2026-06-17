import { createElement, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'css-to-js',
  name: 'CSS 转 JS 对象',
  description: '将 CSS 样式转换为 JavaScript 对象、CSS Modules 或 styled-components',
  category: 'converter',
  icon: 'css',

  render(container) {
    const section = createSection('CSS 转 JS 对象')

    // Input area
    const inputGroup = createElement('div', { className: 'form-group' })
    const inputLabel = createElement('label', { className: 'label', textContent: '输入 CSS' })
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 CSS 代码...\n例如：\nbackground-color: #fff;\nfont-size: 14px;\nmargin: 10px 20px;',
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

    // Output area with tabs
    const outputGroup = createElement('div', { className: 'form-group' })
    const outputLabel = createElement('label', { className: 'label', textContent: '转换结果' })

    const tabs = createTabGroup([
      { id: 'inline', label: '内联样式对象', active: true },
      { id: 'modules', label: 'CSS Modules' },
      { id: 'styled', label: 'styled-components' }
    ])

    const inlinePanel = createElement('div', { className: 'tool-section' })
    const inlineOutput = createElement('textarea', {
      className: 'textarea',
      readOnly: true,
      rows: 10
    })
    inlinePanel.append(inlineOutput)

    const modulesPanel = createElement('div', {
      className: 'tool-section',
      style: 'display: none'
    })
    const modulesOutput = createElement('textarea', {
      className: 'textarea',
      readOnly: true,
      rows: 10
    })
    modulesPanel.append(modulesOutput)

    const styledPanel = createElement('div', {
      className: 'tool-section',
      style: 'display: none'
    })
    const styledOutput = createElement('textarea', {
      className: 'textarea',
      readOnly: true,
      rows: 10
    })
    styledPanel.append(styledOutput)

    tabs.panel.append(inlinePanel, modulesPanel, styledPanel)

    // Copy button
    const copyGroup = createElement('div', { className: 'btn-group' })
    const copyBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '复制结果'
    })
    copyGroup.append(copyBtn)

    outputGroup.append(outputLabel, tabs.container, copyGroup)

    // Error display
    const errorEl = createElement('div', { className: 'error-text' })

    section.append(inputGroup, btnGroup, outputGroup, errorEl)
    container.append(section)

    // Parse CSS into key-value pairs
    function parseCss(cssStr) {
      let cleaned = cssStr
      // Remove comments
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove selector braces (take content inside { })
      const blockMatch = cleaned.match(/\{([^}]*)\}/)
      if (blockMatch) {
        cleaned = blockMatch[1]
      }

      const pairs = []
      cleaned.split(';').forEach(rule => {
        rule = rule.trim()
        if (!rule) return
        const colonIdx = rule.indexOf(':')
        if (colonIdx === -1) return
        const prop = rule.substring(0, colonIdx).trim()
        const val = rule.substring(colonIdx + 1).trim()
        if (prop && val) {
          pairs.push({ property: prop, value: val })
        }
      })
      return pairs
    }

    // kebab-case to camelCase
    function toCamelCase(str) {
      return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    }

    // kebab-case to PascalCase
    function toPascalCase(str) {
      const camel = toCamelCase(str)
      return camel.charAt(0).toUpperCase() + camel.slice(1)
    }

    // Generate inline style object
    function toInlineStyle(pairs) {
      if (pairs.length === 0) return ''
      const lines = pairs.map(p => {
        const camel = toCamelCase(p.property)
        return `  ${camel}: '${p.value}'`
      })
      return `const style = {\n${lines.join(',\n')}\n}`
    }

    // Generate CSS Modules
    function toCssModules(pairs) {
      if (pairs.length === 0) return ''
      const lines = pairs.map(p => `  ${p.property}: ${p.value};`)
      return `.container {\n${lines.join('\n')}\n}\n\n// 使用方式：\n// import styles from './styles.module.css'\n// <div className={styles.container}>`
    }

    // Generate styled-components
    function toStyledComponents(pairs) {
      if (pairs.length === 0) return ''
      const lines = pairs.map(p => `  ${p.property}: ${p.value};`)
      return `import styled from 'styled-components'\n\nconst Container = styled.div\`\n${lines.join('\n')}\n\`\n\n// 使用方式：\n// <Container>内容</Container>`
    }

    let currentTab = 'inline'

    // Tab switching
    tabs.container.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.container.querySelectorAll('[data-tab]').forEach(t => {
          t.classList.remove('active')
        })
        tab.classList.add('active')
        currentTab = tab.dataset.tab
        inlinePanel.style.display = currentTab === 'inline' ? '' : 'none'
        modulesPanel.style.display = currentTab === 'modules' ? '' : 'none'
        styledPanel.style.display = currentTab === 'styled' ? '' : 'none'
      })
    })

    convertBtn.addEventListener('click', () => {
      errorEl.textContent = ''
      const css = input.value
      if (!css.trim()) {
        inlineOutput.value = ''
        modulesOutput.value = ''
        styledOutput.value = ''
        return
      }
      try {
        const pairs = parseCss(css)
        if (pairs.length === 0) {
          errorEl.textContent = '未识别到有效的 CSS 属性'
          return
        }
        inlineOutput.value = toInlineStyle(pairs)
        modulesOutput.value = toCssModules(pairs)
        styledOutput.value = toStyledComponents(pairs)
      } catch (e) {
        errorEl.textContent = '转换失败: ' + e.message
      }
    })

    copyBtn.addEventListener('click', () => {
      let text = ''
      if (currentTab === 'inline') text = inlineOutput.value
      else if (currentTab === 'modules') text = modulesOutput.value
      else text = styledOutput.value

      if (text) {
        copyToClipboard(text)
      }
    })
  }
}
