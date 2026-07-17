import { createElement, createSection, createTableScroll } from '../../utils/dom.js'

export default {
  id: 'regex',
  name: '正则表达式测试',
  description: '正则表达式在线测试和匹配',
  category: 'text',
  icon: 'regex',
  render(container) {
    const patternInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '输入正则表达式，如 \\d+ 或 [a-z]+'
    })

    const flagCheckboxes = {}
    const flagsRow = createElement('div', {
      className: 'btn-group'
    })

    ;['g', 'i', 'm', 's'].forEach(flag => {
      const label = createElement('label', { className: 'checkbox-label' })
      const cb = createElement('input', { type: 'checkbox' })
      if (flag === 'g') cb.checked = true
      flagCheckboxes[flag] = cb
      label.appendChild(cb)
      label.appendChild(document.createTextNode(` ${flag}`))
      flagsRow.appendChild(label)
    })

    const patternGroup = createElement('div', { className: 'form-group' }, [patternInput])

    const regexRow = createElement('div', {
      className: 'form-row'
    }, [patternGroup, flagsRow])

    const testInput = createElement('textarea', {
      className: 'textarea',
      placeholder: '输入要测试的文本...'
    })

    const resultInfo = createElement('div', {
      className: 'inline-result'
    })

    const highlightEl = createElement('div', {
      className: 'result-box'
    })

    const matchesTable = createElement('div', {
      className: 'section-result'
    })

    function getFlags() {
      return ['g', 'i', 'm', 's'].filter(f => flagCheckboxes[f].checked).join('')
    }

    function escapeHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    function runTest() {
      const pattern = patternInput.value
      const text = testInput.value
      resultInfo.textContent = ''
      highlightEl.innerHTML = ''
      matchesTable.innerHTML = ''

      if (!pattern) {
        resultInfo.textContent = '请输入正则表达式'
        return
      }

      if (!text) {
        resultInfo.textContent = '请输入测试文本'
        return
      }

      let regex
      try {
        regex = new RegExp(pattern, getFlags())
      } catch (e) {
        resultInfo.innerHTML = `<span class="error-text">正则表达式语法错误: ${escapeHtml(e.message)}</span>`
        return
      }

      const matches = []
      if (getFlags().includes('g')) {
        let match
        const tempRegex = new RegExp(pattern, getFlags())
        while ((match = tempRegex.exec(text)) !== null) {
          matches.push({
            value: match[0],
            index: match.index,
            groups: match.slice(1)
          })
          if (match[0].length === 0) tempRegex.lastIndex++
        }
      } else {
        const match = regex.exec(text)
        if (match) {
          matches.push({
            value: match[0],
            index: match.index,
            groups: match.slice(1)
          })
        }
      }

      resultInfo.innerHTML = `找到 <strong>${matches.length}</strong> 个匹配`

      // Highlight matches in text
      if (matches.length === 0) {
        highlightEl.textContent = text
      } else {
        let html = ''
        let lastIndex = 0
        matches.forEach(m => {
          html += escapeHtml(text.slice(lastIndex, m.index))
          html += `<mark class="regex-match">${escapeHtml(m.value)}</mark>`
          lastIndex = m.index + m.value.length
        })
        html += escapeHtml(text.slice(lastIndex))
        highlightEl.innerHTML = html
      }

      // Match groups table
      if (matches.some(m => m.groups.length > 0)) {
        const table = createElement('table', {
          className: 'result-table result-table-wide'
        })

        const thead = document.createElement('thead')
        const headerRow = document.createElement('tr')
        const thIndex = document.createElement('th')
        thIndex.textContent = '#'
        headerRow.appendChild(thIndex)

        const thMatch = document.createElement('th')
        thMatch.textContent = '完整匹配'
        headerRow.appendChild(thMatch)

        const maxGroups = Math.max(...matches.map(m => m.groups.length))
        for (let i = 1; i <= maxGroups; i++) {
          const th = document.createElement('th')
          th.textContent = `分组 ${i}`
          headerRow.appendChild(th)
        }
        thead.appendChild(headerRow)
        table.appendChild(thead)

        const tbody = document.createElement('tbody')
        matches.forEach((m, idx) => {
          const tr = document.createElement('tr')
          const tdIdx = document.createElement('td')
          tdIdx.textContent = String(idx + 1)
          tr.appendChild(tdIdx)

          const tdMatch = document.createElement('td')
          tdMatch.textContent = m.value
          tr.appendChild(tdMatch)

          for (let i = 0; i < maxGroups; i++) {
            const td = document.createElement('td')
            td.textContent = m.groups[i] !== undefined ? m.groups[i] : ''
            tr.appendChild(td)
          }
          tbody.appendChild(tr)
        })
        table.appendChild(tbody)
        matchesTable.appendChild(createTableScroll(table, '正则表达式捕获组详情'))
      }
    }

    patternInput.addEventListener('input', runTest)
    testInput.addEventListener('input', runTest)
    Object.values(flagCheckboxes).forEach(cb => cb.addEventListener('change', runTest))

    const regexSection = createSection('正则表达式', regexRow)
    const inputSection = createSection('测试文本', testInput)
    const highlightSection = createSection('匹配高亮', highlightEl)
    const matchSection = createSection('匹配详情', matchesTable)

    container.appendChild(regexSection)
    container.appendChild(inputSection)
    container.appendChild(resultInfo)
    container.appendChild(highlightSection)
    container.appendChild(matchSection)
  }
}
