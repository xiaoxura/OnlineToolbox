import { createCopyButton, createElement, createSection, createTableScroll } from '../../utils/dom.js'

const REGEX_COMPONENTS = [
  { pattern: /\(\?:/, desc: '非捕获分组' },
  { pattern: /\(\?=/, desc: '正向前瞻' },
  { pattern: /\(\?!/, desc: '负向前瞻' },
  { pattern: /\(\?<=/, desc: '正向后顾' },
  { pattern: /\(\?<!/, desc: '负向后顾' },
  { pattern: /\((?!\?)/, desc: '捕获分组' },
  { pattern: /\[/, desc: '字符类开始' },
  { pattern: /\]/, desc: '字符类结束' },
  { pattern: /\{/, desc: '量词边界' },
  { pattern: /\}/, desc: '量词边界' },
  { pattern: /\*/, desc: '零次或多次' },
  { pattern: /\+/, desc: '一次或多次' },
  { pattern: /\?(?![=!<])/, desc: '零次或一次' },
  { pattern: /\^/, desc: '行/字符串开始' },
  { pattern: /\$/, desc: '行/字符串结束' },
  { pattern: /\./, desc: '任意字符（除换行）' },
  { pattern: /\|/, desc: '或（交替）' },
  { pattern: /\\d/, desc: '数字 [0-9]' },
  { pattern: /\\D/, desc: '非数字' },
  { pattern: /\\w/, desc: '单词字符 [a-zA-Z0-9_]' },
  { pattern: /\\W/, desc: '非单词字符' },
  { pattern: /\\s/, desc: '空白字符' },
  { pattern: /\\S/, desc: '非空白字符' },
  { pattern: /\\b/, desc: '单词边界' },
  { pattern: /\\B/, desc: '非单词边界' },
  { pattern: /\\n/, desc: '换行符' },
  { pattern: /\\t/, desc: '制表符' }
]

export default {
  id: 'regex-visual',
  name: '正则表达式可视化',
  description: '测试和解释正则表达式',
  category: 'converter',
  icon: 'regex',

  render(container) {
    const inputGroup = createElement('div', { className: 'form-group' })
    const patternLabel = createElement('label', { className: 'label', textContent: '正则表达式' })
    const patternRow = createElement('div', { className: 'form-row' })
    const patternInput = createElement('input', {
      className: 'input',
      attrs: { type: 'text', placeholder: '例: (\\w+)@(\\w+\\.\\w+)' }
    })
    const flagsInput = createElement('input', {
      className: 'input',
      attrs: { type: 'text', placeholder: 'flags (g,i,m,s)', style: 'max-width:120px' }
    })
    flagsInput.value = 'g'
    patternRow.appendChild(patternInput)
    patternRow.appendChild(flagsInput)
    inputGroup.appendChild(patternLabel)
    inputGroup.appendChild(patternRow)

    const testGroup = createElement('div', { className: 'form-group' })
    const testLabel = createElement('label', { className: 'label', textContent: '测试字符串' })
    const testInput = createElement('textarea', {
      className: 'textarea',
      attrs: { rows: '3', placeholder: '输入要测试的文本' }
    })
    testGroup.appendChild(testLabel)
    testGroup.appendChild(testInput)

    const btnGroup = createElement('div', { className: 'btn-group' })
    const testBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '测试匹配'
    })
    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据'
    })
    btnGroup.appendChild(testBtn)
    btnGroup.appendChild(exampleBtn)

    const resultContainer = createElement('div', { className: 'tool-stack' })
    const errorText = createElement('div', { className: 'error-text', style: 'display:none' })
    const copyRegexBtn = createCopyButton(() => `/${patternInput.value.trim()}/${flagsInput.value.trim()}`)
    copyRegexBtn.title = '复制正则表达式'
    copyRegexBtn.setAttribute('aria-label', '复制正则表达式')

    container.append(inputGroup, testGroup, btnGroup, errorText, resultContainer)

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    function explainRegex(pattern) {
      const explanations = []

      REGEX_COMPONENTS.forEach(comp => {
        const matches = pattern.match(new RegExp(comp.pattern.source, 'g'))
        if (matches) {
          matches.forEach(m => {
            explanations.push({ token: m, desc: comp.desc })
          })
        }
      })

      const literalChars = pattern
        .replace(/\\[dDwWsbntrbfB]|[\[\](){}*+?^$|.]/g, '')
        .replace(/\\./g, '')
        .split('')
        .filter(c => c.trim())

      literalChars.forEach(c => {
        explanations.push({ token: c, desc: `字面量字符 "${c}"` })
      })

      return explanations
    }

    function runTest() {
      errorText.style.display = 'none'
      resultContainer.innerHTML = ''

      const pattern = patternInput.value.trim()
      const flags = flagsInput.value.trim()
      const testStr = testInput.value

      if (!pattern) {
        errorText.textContent = '请输入正则表达式'
        errorText.style.display = 'block'
        return
      }

      let regex
      try {
        regex = new RegExp(pattern, flags)
      } catch (e) {
        errorText.textContent = `无效的正则表达式: ${e.message}`
        errorText.style.display = 'block'
        return
      }

      // Find all matches
      const matches = []
      if (flags.includes('g')) {
        let match
        const re = new RegExp(pattern, flags)
        while ((match = re.exec(testStr)) !== null) {
          matches.push({ full: match[0], index: match.index, groups: match.slice(1) })
          if (!match[0]) break
        }
      } else {
        const match = regex.exec(testStr)
        if (match) {
          matches.push({ full: match[0], index: match.index, groups: match.slice(1) })
        }
      }

      // Highlighted result
      let highlightContent
      if (matches.length > 0 && testStr) {
        const highlightBox = createElement('div', { className: 'result-box' })
        let html = ''
        let lastIndex = 0
        const sortedMatches = [...matches].sort((a, b) => a.index - b.index)

        sortedMatches.forEach(m => {
          html += escapeHtml(testStr.slice(lastIndex, m.index))
          html += `<mark class="regex-match">${escapeHtml(m.full)}</mark>`
          lastIndex = m.index + m.full.length
        })
        html += escapeHtml(testStr.slice(lastIndex))
        highlightBox.innerHTML = html
        highlightContent = highlightBox
      } else {
        highlightContent = createElement('div', {
          className: 'stat-item',
          textContent: '无匹配'
        })
      }
      resultContainer.appendChild(createSection(
        `匹配结果 (共 ${matches.length} 个匹配)`,
        highlightContent,
        [copyRegexBtn]
      ))

      // Match groups table
      if (matches.length > 0) {
        const table = createElement('table', { className: 'result-table' })
        const thead = createElement('thead')
        thead.innerHTML = '<tr><th>#</th><th>匹配内容</th><th>位置</th><th>捕获组</th></tr>'
        table.appendChild(thead)
        const tbody = createElement('tbody')

        matches.forEach((m, i) => {
          const tr = createElement('tr')
          const tdIdx = createElement('td', { textContent: String(i + 1) })
          const tdMatch = createElement('td', { textContent: m.full || '(空)' })
          const tdPos = createElement('td', { textContent: String(m.index) })
          const tdGroups = createElement('td', {
            textContent: m.groups.length > 0 ? m.groups.join(', ') : '-'
          })
          tr.appendChild(tdIdx)
          tr.appendChild(tdMatch)
          tr.appendChild(tdPos)
          tr.appendChild(tdGroups)
          tbody.appendChild(tr)
        })

        table.appendChild(tbody)
        resultContainer.appendChild(createSection(
          '匹配详情',
          createTableScroll(table, '正则表达式匹配详情')
        ))
      }

      // Regex explanation
      let explainContent
      const explanations = explainRegex(pattern)
      if (explanations.length > 0) {
        const explainTable = createElement('table', { className: 'result-table' })
        const eth = createElement('thead')
        eth.innerHTML = '<tr><th>符号</th><th>含义</th></tr>'
        explainTable.appendChild(eth)
        const etb = createElement('tbody')

        const seen = new Set()
        explanations.forEach(exp => {
          const key = exp.token + '|' + exp.desc
          if (seen.has(key)) return
          seen.add(key)
          const tr = createElement('tr')
          const tdToken = createElement('td')
          const code = createElement('span', {
            className: 'stat-value',
            textContent: exp.token
          })
          tdToken.appendChild(code)
          const tdDesc = createElement('td', { textContent: exp.desc })
          tr.appendChild(tdToken)
          tr.appendChild(tdDesc)
          etb.appendChild(tr)
        })

        explainTable.appendChild(etb)
        explainContent = createTableScroll(explainTable, '正则表达式分解')
      } else {
        explainContent = createElement('div', {
          className: 'stat-item',
          textContent: '无法分解此正则表达式'
        })
      }
      resultContainer.appendChild(createSection('正则表达式分解', explainContent))
    }

    testBtn.addEventListener('click', runTest)

    // Real-time matching on input
    patternInput.addEventListener('input', runTest)
    testInput.addEventListener('input', runTest)
    flagsInput.addEventListener('input', runTest)

    exampleBtn.addEventListener('click', () => {
      patternInput.value = '(\\w+)@(\\w+\\.\\w+)'
      flagsInput.value = 'g'
      testInput.value = '联系方式：\n张三的邮箱是 zhangsan@gmail.com\n李四的邮箱是 lisi@company.cn\n无效格式：user@, @domain.com'
      runTest()
    })
  }
}
