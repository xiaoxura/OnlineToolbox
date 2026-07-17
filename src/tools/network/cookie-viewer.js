import { createCopyButton, createElement, createSection, createTableScroll } from '../../utils/dom.js'

export default {
  id: 'cookie-viewer',
  name: 'Cookie 查看器',
  description: '查看当前页面的 Cookie 信息',
  category: 'network',
  icon: 'search',

  render(container) {
    const notice = createElement('div', {
      className: 'privacy-notice',
      textContent: '仅能查看当前页面中非 HttpOnly 的 Cookie。'
    })

    const btnGroup = createElement('div', { className: 'btn-group' })
    const refreshBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '刷新 Cookie'
    })
    const copyAllBtn = createCopyButton(() => document.cookie || '（无 Cookie）')
    copyAllBtn.title = '复制全部 Cookie'
    copyAllBtn.setAttribute('aria-label', '复制全部 Cookie')
    btnGroup.appendChild(refreshBtn)
    btnGroup.appendChild(copyAllBtn)

    const resultContainer = createElement('div', { className: 'tool-stack' })
    container.append(notice, btnGroup, resultContainer)

    function parseCookies() {
      resultContainer.innerHTML = ''
      const cookieStr = document.cookie

      if (!cookieStr || !cookieStr.trim()) {
        const emptyMsg = createElement('div', {
          className: 'stat-item',
          textContent: '当前页面无 Cookie'
        })
        resultContainer.appendChild(createSection('Cookie 列表', emptyMsg))
        return
      }

      const cookiePairs = cookieStr.split(';').map(c => c.trim()).filter(Boolean)

      const statsRow = createElement('div', { className: 'stats-row' })
      const countItem = createElement('div', { className: 'stat-item' })
      const countLabel = createElement('span', { className: 'stat-label', textContent: 'Cookie 数量' })
      const countValue = createElement('span', {
        className: 'stat-value',
        textContent: String(cookiePairs.length)
      })
      countItem.appendChild(countLabel)
      countItem.appendChild(countValue)
      statsRow.appendChild(countItem)
      resultContainer.appendChild(createSection('Cookie 摘要', statsRow))

      const table = createElement('table', { className: 'result-table' })
      const thead = createElement('thead')
      thead.innerHTML = '<tr><th>名称</th><th>值</th><th>操作</th></tr>'
      table.appendChild(thead)
      const tbody = createElement('tbody')

      cookiePairs.forEach(pair => {
        const eqIndex = pair.indexOf('=')
        const name = eqIndex > 0 ? pair.substring(0, eqIndex).trim() : pair.trim()
        const value = eqIndex > 0 ? pair.substring(eqIndex + 1).trim() : ''

        const tr = createElement('tr')
        const tdName = createElement('td', { textContent: name })
        const tdValue = createElement('td', { textContent: value })
        const tdAction = createElement('td')

        const copyBtn = createCopyButton(() => `${name}=${value}`)
        tdAction.appendChild(copyBtn)
        tr.appendChild(tdName)
        tr.appendChild(tdValue)
        tr.appendChild(tdAction)
        tbody.appendChild(tr)
      })

      table.appendChild(tbody)
      resultContainer.appendChild(createSection(
        'Cookie 列表',
        createTableScroll(table, 'Cookie 列表')
      ))
    }

    refreshBtn.addEventListener('click', parseCookies)

    parseCookies()
  }
}
