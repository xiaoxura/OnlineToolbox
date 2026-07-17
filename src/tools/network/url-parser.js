import { createCopyButton, createElement, createSection, createTableScroll } from '../../utils/dom.js'

export default {
  id: 'url-parser',
  name: 'URL 解析器',
  description: '解析 URL 的各个组成部分',
  category: 'network',
  icon: 'url-encode',

  render(container) {
    const inputGroup = createElement('div', { className: 'form-group' })
    const inputLabel = createElement('label', { className: 'label', textContent: '输入 URL' })
    const input = createElement('input', {
      className: 'input',
      attrs: { type: 'text', placeholder: 'https://example.com:8080/path?query=value#hash' }
    })
    inputGroup.appendChild(inputLabel)
    inputGroup.appendChild(input)

    const btnGroup = createElement('div', { className: 'btn-group' })
    const parseBtn = createElement('button', { className: 'btn btn-primary', textContent: '解析' })
    const currentUrlBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '使用当前页面URL'
    })
    btnGroup.appendChild(parseBtn)
    btnGroup.appendChild(currentUrlBtn)

    const resultContainer = createElement('div', { className: 'tool-stack' })
    const errorText = createElement('div', { className: 'error-text', style: 'display:none' })

    container.append(inputGroup, btnGroup, errorText, resultContainer)

    function createCopyableRow(label, value) {
      const row = createElement('div', { className: 'stat-item' })
      const labelEl = createElement('span', { className: 'stat-label', textContent: label })
      const valueEl = createElement('span', { className: 'stat-value', textContent: value || '-' })
      const copyBtn = createCopyButton(() => value || '')
      row.appendChild(labelEl)
      row.appendChild(valueEl)
      row.appendChild(copyBtn)
      return row
    }

    function parseUrl(urlStr) {
      errorText.style.display = 'none'
      resultContainer.innerHTML = ''

      if (!urlStr.trim()) {
        errorText.textContent = '请输入 URL'
        errorText.style.display = 'block'
        return
      }

      try {
        const url = new URL(urlStr)

        const statsRow = createElement('div', { className: 'stats-row url-parts-grid' })
        statsRow.appendChild(createCopyableRow('协议 (protocol)', url.protocol))
        statsRow.appendChild(createCopyableRow('主机名 (hostname)', url.hostname))
        statsRow.appendChild(createCopyableRow('端口 (port)', url.port || '默认'))
        statsRow.appendChild(createCopyableRow('路径 (pathname)', url.pathname))
        statsRow.appendChild(createCopyableRow('查询 (search)', url.search))
        statsRow.appendChild(createCopyableRow('哈希 (hash)', url.hash))
        statsRow.appendChild(createCopyableRow('源 (origin)', url.origin))
        resultContainer.appendChild(createSection('URL 组成', statsRow))

        const pathSegments = url.pathname.split('/').filter(Boolean)
        if (pathSegments.length > 0) {
          const segRow = createElement('div', { className: 'stats-row url-parts-grid' })
          pathSegments.forEach((seg, i) => {
            segRow.appendChild(createCopyableRow(`[${i}]`, seg))
          })
          resultContainer.appendChild(createSection(`路径分段 (${pathSegments.length})`, segRow))
        }

        const params = new URLSearchParams(url.search)
        if (params.toString()) {
          const paramCount = [...params].length

          const table = createElement('table', { className: 'result-table' })
          const thead = createElement('thead')
          thead.innerHTML = '<tr><th>参数名</th><th>参数值</th><th>操作</th></tr>'
          table.appendChild(thead)
          const tbody = createElement('tbody')
          params.forEach((value, key) => {
            const tr = createElement('tr')
            const tdKey = createElement('td', { textContent: key })
            const tdValue = createElement('td', { textContent: value })
            const tdAction = createElement('td')
            const copyBtn = createCopyButton(() => `${key}=${value}`)
            tdAction.appendChild(copyBtn)
            tr.appendChild(tdKey)
            tr.appendChild(tdValue)
            tr.appendChild(tdAction)
            tbody.appendChild(tr)
          })
          table.appendChild(tbody)
          resultContainer.appendChild(createSection(
            `查询参数 (${paramCount})`,
            createTableScroll(table, 'URL 查询参数表')
          ))
        }
      } catch {
        errorText.textContent = '无效的 URL 格式，请检查输入'
        errorText.style.display = 'block'
      }
    }

    parseBtn.addEventListener('click', () => parseUrl(input.value))
    currentUrlBtn.addEventListener('click', () => {
      input.value = window.location.href
      parseUrl(input.value)
    })
  }
}
