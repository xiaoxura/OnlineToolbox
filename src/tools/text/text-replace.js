import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

export default {
  id: 'text-replace',
  name: '文本替换',
  description: '批量查找和替换文本',
  category: 'text',
  icon: 'text-replace',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要处理的文本...'
    })

    const searchInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '查找内容'
    })

    const replaceInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '替换为'
    })

    const useRegex = createElement('label', { className: 'checkbox-label' })
    const useRegexCb = createElement('input', { type: 'checkbox' })
    useRegex.appendChild(useRegexCb)
    useRegex.appendChild(document.createTextNode(' 使用正则表达式'))

    const globalReplace = createElement('label', { className: 'checkbox-label' })
    const globalReplaceCb = createElement('input', { type: 'checkbox', checked: true })
    globalReplace.appendChild(globalReplaceCb)
    globalReplace.appendChild(document.createTextNode(' 全局替换'))

    const ignoreCase = createElement('label', { className: 'checkbox-label' })
    const ignoreCaseCb = createElement('input', { type: 'checkbox' })
    ignoreCase.appendChild(ignoreCaseCb)
    ignoreCase.appendChild(document.createTextNode(' 忽略大小写'))

    const optionsRow = createElement('div', {
      className: 'form-row'
    })
    optionsRow.appendChild(useRegex)
    optionsRow.appendChild(globalReplace)
    optionsRow.appendChild(ignoreCase)

    const searchGroup = createElement('div', { className: 'form-group' }, [searchInput])
    const replaceGroup = createElement('div', { className: 'form-group' }, [replaceInput])

    const fieldsRow = createElement('div', {
      className: 'form-row'
    }, [searchGroup, replaceGroup])

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '替换结果...',
      readOnly: true
    })

    const countEl = createElement('div', {
      className: 'inline-result'
    })

    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick() {
        input.value = 'Hello World!\n你好世界！\nHello JavaScript!\nHello Python!\nhello world!\n文本替换测试数据\n包含Hello的多行文本'
        searchInput.value = 'Hello'
        replaceInput.value = 'Hi'
      }
    })

    const replaceBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '替换',
      onClick() {
        const text = input.value
        const search = searchInput.value
        const replacement = replaceInput.value
        countEl.textContent = ''

        if (!search) {
          countEl.textContent = '请输入查找内容'
          output.value = text
          return
        }

        let flags = ''
        if (globalReplaceCb.checked) flags += 'g'
        if (ignoreCaseCb.checked) flags += 'i'

        let regex
        let count = 0

        if (useRegexCb.checked) {
          try {
            regex = new RegExp(search, flags)
          } catch (e) {
            countEl.innerHTML = `<span class="error-text">正则表达式语法错误: ${e.message}</span>`
            return
          }
        } else {
          const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          regex = new RegExp(escaped, flags)
        }

        // Count matches first
        if (globalReplaceCb.checked) {
          const tempRegex = new RegExp(regex.source, regex.flags)
          const matches = text.match(tempRegex)
          count = matches ? matches.length : 0
        } else {
          count = regex.test(text) ? 1 : 0
          // Reset lastIndex for the actual replace
          regex.lastIndex = 0
        }

        output.value = text.replace(regex, replacement)
        countEl.innerHTML = `已替换 <strong>${count}</strong> 处`
      }
    })

    const copyBtn = createCopyButton(() => output.value)

    // Real-time preview on input
    function doReplace() {
      const text = input.value
      const search = searchInput.value
      const replacement = replaceInput.value
      countEl.textContent = ''

      if (!search) {
        output.value = text
        return
      }

      let flags = ''
      if (globalReplaceCb.checked) flags += 'g'
      if (ignoreCaseCb.checked) flags += 'i'

      let regex

      if (useRegexCb.checked) {
        try {
          regex = new RegExp(search, flags)
        } catch (e) {
          countEl.innerHTML = `<span class="error-text">正则表达式语法错误: ${e.message}</span>`
          return
        }
      } else {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        regex = new RegExp(escaped, flags)
      }

      let count = 0
      if (globalReplaceCb.checked) {
        const tempRegex = new RegExp(regex.source, regex.flags)
        const matches = text.match(tempRegex)
        count = matches ? matches.length : 0
      } else {
        count = regex.test(text) ? 1 : 0
        regex.lastIndex = 0
      }

      output.value = text.replace(regex, replacement)
      if (count > 0) {
        countEl.innerHTML = `已替换 <strong>${count}</strong> 处`
      }
    }

    input.addEventListener('input', doReplace)
    searchInput.addEventListener('input', doReplace)
    replaceInput.addEventListener('input', doReplace)
    useRegexCb.addEventListener('change', doReplace)
    globalReplaceCb.addEventListener('change', doReplace)
    ignoreCaseCb.addEventListener('change', doReplace)

    const actionsRow = createElement('div', { className: 'btn-group' })
    actionsRow.appendChild(exampleBtn)
    actionsRow.appendChild(replaceBtn)

    const inputSection = createSection('输入文本', input)
    const configSection = createSection('查找替换配置', fieldsRow)
    const resultSection = createSection('替换结果', output, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(configSection)
    container.appendChild(optionsRow)
    container.appendChild(actionsRow)
    container.appendChild(countEl)
    container.appendChild(resultSection)
  }
}
