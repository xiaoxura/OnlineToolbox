import { createElement, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'url-parser',
  name: 'URL 解析器',
  description: '解析 URL 的各个组成部分',
  category: 'network',
  icon: 'url-encode',

  render(container) {
    const section = createSection('URL 解析器')

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

    const resultBox = createElement('div', { className: 'result-box' })
    const errorText = createElement('div', { className: 'error-text', style: 'display:none' })

    section.appendChild(inputGroup)
    section.appendChild(btnGroup)
    section.appendChild(errorText)
    section.appendChild(resultBox)
    container.appendChild(section)

    function createCopyableRow(label, value) {
      const row = createElement('div', { className: 'stat-item' })
      const labelEl = createElement('span', { className: 'stat-label', textContent: label })
      const valueEl = createElement('span', { className: 'stat-value', textContent: value || '-' })
      const copyBtn = createElement('button', {
        className: 'btn btn-secondary',
        textContent: '复制'
      })
      copyBtn.addEventListener('click', () => {
        copyToClipboard(value || '')
        copyBtn.textContent = '已复制'
        setTimeout(() => { copyBtn.textContent = '复制' }, 1500)
      })
      row.appendChild(labelEl)
      row.appendChild(valueEl)
      row.appendChild(copyBtn)
      return row
    }

    function parseUrl(urlStr) {
      errorText.style.display = 'none'
      resultBox.innerHTML = ''

      if (!urlStr.trim()) {
        errorText.textContent = '请输入 URL'
        errorText.style.display = 'block'
        return
      }

      try {
        const url = new URL(urlStr)

        const statsRow = createElement('div', { className: 'stats-row' })
        statsRow.appendChild(createCopyableRow('协议 (protocol)', url.protocol))
        statsRow.appendChild(createCopyableRow('主机名 (hostname)', url.hostname))
        statsRow.appendChild(createCopyableRow('端口 (port)', url.port || '默认'))
        statsRow.appendChild(createCopyableRow('路径 (pathname)', url.pathname))
        statsRow.appendChild(createCopyableRow('查询 (search)', url.search))
        statsRow.appendChild(createCopyableRow('哈希 (hash)', url.hash))
        statsRow.appendChild(createCopyableRow('源 (origin)', url.origin))
        resultBox.appendChild(statsRow)

        const pathSegments = url.pathname.split('/').filter(Boolean)
        if (pathSegments.length > 0) {
          const pathSection = createElement('div', { className: 'tool-section' })
          const pathTitle = createElement('label', {
            className: 'label',
            textContent: `路径分段 (${pathSegments.length})`
          })
          pathSection.appendChild(pathTitle)
          const segRow = createElement('div', { className: 'stats-row' })
          pathSegments.forEach((seg, i) => {
            segRow.appendChild(createCopyableRow(`[${i}]`, seg))
          })
          pathSection.appendChild(segRow)
          resultBox.appendChild(pathSection)
        }

        const params = new URLSearchParams(url.search)
        if (params.toString()) {
          const paramSection = createElement('div', { className: 'tool-section' })
          const paramCount = [...params].length
          const paramTitle = createElement('label', {
            className: 'label',
            textContent: `查询参数 (${paramCount})`
          })
          paramSection.appendChild(paramTitle)

          const table = createElement('table', { className: 'result-box' })
          const thead = createElement('thead')
          thead.innerHTML = '<tr><th>参数名</th><th>参数值</th><th>操作</th></tr>'
          table.appendChild(thead)
          const tbody = createElement('tbody')
          params.forEach((value, key) => {
            const tr = createElement('tr')
            const tdKey = createElement('td', { textContent: key })
            const tdValue = createElement('td', { textContent: value })
            const tdAction = createElement('td')
            const copyBtn = createElement('button', {
              className: 'btn btn-secondary',
              textContent: '复制'
            })
            copyBtn.addEventListener('click', () => {
              copyToClipboard(`${key}=${value}`)
              copyBtn.textContent = '已复制'
              setTimeout(() => { copyBtn.textContent = '复制' }, 1500)
            })
            tdAction.appendChild(copyBtn)
            tr.appendChild(tdKey)
            tr.appendChild(tdValue)
            tr.appendChild(tdAction)
            tbody.appendChild(tr)
          })
          table.appendChild(tbody)
          paramSection.appendChild(table)
          resultBox.appendChild(paramSection)
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
