import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'

export default {
  id: 'json',
  name: 'JSON 格式化',
  description: 'JSON 美化、压缩和校验',
  category: 'formatter',
  icon: 'json',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 JSON 文本...',
      rows: 8
    })

    const indentSelect = createElement('select', {
      className: 'select'
    }, [
      createElement('option', { value: '2', textContent: '缩进 2 空格' }),
      createElement('option', { value: '4', textContent: '缩进 4 空格' }),
      createElement('option', { value: 'tab', textContent: 'Tab 缩进' })
    ])

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

    const infoEl = createElement('div', {
      className: 'stat-item'
    })

    function getIndent() {
      const val = indentSelect.value
      return val === 'tab' ? '\t' : parseInt(val, 10)
    }

    function showError(msg) {
      errorEl.textContent = msg
      errorEl.hidden = false
    }

    function hideError() {
      errorEl.textContent = ''
      errorEl.hidden = true
    }

    function updateInfo(text) {
      const lines = text ? text.split('\n').length : 0
      const chars = text ? text.length : 0
      infoEl.textContent = `行数: ${lines}  |  字符数: ${chars}`
    }

    const beautifyBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        hideError()
        const text = input.value.trim()
        if (!text) return
        try {
          const parsed = JSON.parse(text)
          const formatted = JSON.stringify(parsed, null, getIndent())
          output.value = formatted
          updateInfo(formatted)
        } catch (e) {
          showError('JSON 校验失败: ' + e.message)
          output.value = ''
          infoEl.textContent = ''
        }
      }
    }, ['美化'])

    const minifyBtn = createElement('button', {
      className: 'btn btn-secondary',
      onClick: () => {
        hideError()
        const text = input.value.trim()
        if (!text) return
        try {
          const parsed = JSON.parse(text)
          const minified = JSON.stringify(parsed)
          output.value = minified
          updateInfo(minified)
        } catch (e) {
          showError('JSON 校验失败: ' + e.message)
          output.value = ''
          infoEl.textContent = ''
        }
      }
    }, ['压缩'])

    const validateBtn = createElement('button', {
      className: 'btn btn-secondary',
      onClick: () => {
        hideError()
        const text = input.value.trim()
        if (!text) {
          showError('请输入 JSON 文本')
          return
        }
        try {
          JSON.parse(text)
          output.value = 'JSON 格式正确！'
          infoEl.textContent = ''
        } catch (e) {
          showError('JSON 格式错误: ' + e.message)
          output.value = ''
          infoEl.textContent = ''
        }
      }
    }, ['校验'])

    const copyBtn = createCopyButton(() => output.value)

    const indentGroup = createElement('div', {
      className: 'form-group'
    }, [
      createElement('label', { className: 'label', textContent: '缩进设置' }),
      indentSelect
    ])

    const btnGroup = createElement('div', {
      className: 'btn-group'
    }, [beautifyBtn, minifyBtn, validateBtn, copyBtn])

    const inputSection = createSection('输入 JSON', input)
    const outputSection = createSection('输出结果', output, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(indentGroup)
    container.appendChild(btnGroup)
    container.appendChild(errorEl)
    container.appendChild(infoEl)
    container.appendChild(outputSection)
  }
}
