import { createElement, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

const IMPORTANT_HEADERS = [
  'Content-Type',
  'Cache-Control',
  'Set-Cookie',
  'Authorization',
  'Content-Length',
  'Content-Encoding',
  'Transfer-Encoding',
  'Connection',
  'Location',
  'WWW-Authenticate',
  'Access-Control-Allow-Origin',
  'Strict-Transport-Security'
]

export default {
  id: 'header-parse',
  name: 'HTTP Headers 解析',
  description: '解析原始 HTTP 请求/响应头',
  category: 'network',
  icon: 'search',

  render(container) {
    const section = createSection('HTTP Headers 解析')

    const inputGroup = createElement('div', { className: 'form-group' })
    const inputLabel = createElement('label', {
      className: 'label',
      textContent: '输入原始 HTTP Headers'
    })
    const textarea = createElement('textarea', {
      className: 'textarea',
      attrs: {
        rows: '10',
        placeholder: `HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8
Cache-Control: max-age=3600
Set-Cookie: session=abc123; HttpOnly
Content-Length: 1234`
      }
    })
    inputGroup.appendChild(inputLabel)
    inputGroup.appendChild(textarea)

    const btnGroup = createElement('div', { className: 'btn-group' })
    const parseBtn = createElement('button', { className: 'btn btn-primary', textContent: '解析' })
    const clearBtn = createElement('button', { className: 'btn btn-secondary', textContent: '清空' })
    btnGroup.appendChild(parseBtn)
    btnGroup.appendChild(clearBtn)

    const resultBox = createElement('div', { className: 'result-box' })
    const errorText = createElement('div', { className: 'error-text', style: 'display:none' })

    section.appendChild(inputGroup)
    section.appendChild(btnGroup)
    section.appendChild(errorText)
    section.appendChild(resultBox)
    container.appendChild(section)

    function isImportantHeader(name) {
      return IMPORTANT_HEADERS.some(h => h.toLowerCase() === name.toLowerCase())
    }

    function parseHeaders(raw) {
      errorText.style.display = 'none'
      resultBox.innerHTML = ''

      if (!raw.trim()) {
        errorText.textContent = '请输入 HTTP Headers'
        errorText.style.display = 'block'
        return
      }

      const lines = raw.split('\n').filter(l => l.trim())
      if (lines.length === 0) {
        errorText.textContent = '未找到有效的 Header 数据'
        errorText.style.display = 'block'
        return
      }

      let statusLine = null
      const headers = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.match(/^HTTP\/|^HTTP\s/)) {
          statusLine = trimmed
        } else {
          const colonIndex = trimmed.indexOf(':')
          if (colonIndex > 0) {
            const key = trimmed.substring(0, colonIndex).trim()
            const value = trimmed.substring(colonIndex + 1).trim()
            headers.push({ key, value })
          }
        }
      }

      if (statusLine) {
        const statusSection = createElement('div', { className: 'tool-section' })
        const statusLabel = createElement('label', { className: 'label', textContent: '状态行' })
        const statusRow = createElement('div', { className: 'stat-item' })
        const statusValue = createElement('span', { className: 'stat-value', textContent: statusLine })
        const copyBtn = createElement('button', {
          className: 'btn btn-secondary',
          textContent: '复制'
        })
        copyBtn.addEventListener('click', () => {
          copyToClipboard(statusLine)
          copyBtn.textContent = '已复制'
          setTimeout(() => { copyBtn.textContent = '复制' }, 1500)
        })
        statusRow.appendChild(statusValue)
        statusRow.appendChild(copyBtn)
        statusSection.appendChild(statusLabel)
        statusSection.appendChild(statusRow)
        resultBox.appendChild(statusSection)
      }

      if (headers.length > 0) {
        const statsRow = createElement('div', { className: 'stats-row' })
        const countItem = createElement('div', { className: 'stat-item' })
        const countLabel = createElement('span', { className: 'stat-label', textContent: '总 Header 数' })
        const countValue = createElement('span', { className: 'stat-value', textContent: String(headers.length) })
        countItem.appendChild(countLabel)
        countItem.appendChild(countValue)
        statsRow.appendChild(countItem)

        const importantCount = headers.filter(h => isImportantHeader(h.key)).length
        const impItem = createElement('div', { className: 'stat-item' })
        const impLabel = createElement('span', { className: 'stat-label', textContent: '重要 Header 数' })
        const impValue = createElement('span', { className: 'stat-value', textContent: String(importantCount) })
        impItem.appendChild(impLabel)
        impItem.appendChild(impValue)
        statsRow.appendChild(impItem)
        resultBox.appendChild(statsRow)

        const tableSection = createElement('div', { className: 'tool-section' })
        const tableLabel = createElement('label', { className: 'label', textContent: 'Header 列表' })
        tableSection.appendChild(tableLabel)

        const table = createElement('table', { className: 'result-box' })
        const thead = createElement('thead')
        thead.innerHTML = '<tr><th>Header 名称</th><th>值</th><th>操作</th></tr>'
        table.appendChild(thead)
        const tbody = createElement('tbody')

        headers.forEach(({ key, value }) => {
          const tr = createElement('tr')
          if (isImportantHeader(key)) {
            tr.classList.add('stat-item')
          }
          const tdKey = createElement('td', { textContent: key })
          const tdValue = createElement('td', { textContent: value })
          const tdAction = createElement('td')
          const copyBtn = createElement('button', {
            className: 'btn btn-secondary',
            textContent: '复制'
          })
          copyBtn.addEventListener('click', () => {
            copyToClipboard(`${key}: ${value}`)
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
        tableSection.appendChild(table)
        resultBox.appendChild(tableSection)
      } else {
        errorText.textContent = '未解析到任何 Header'
        errorText.style.display = 'block'
      }
    }

    parseBtn.addEventListener('click', () => parseHeaders(textarea.value))
    clearBtn.addEventListener('click', () => {
      textarea.value = ''
      resultBox.innerHTML = ''
      errorText.style.display = 'none'
    })
  }
}
