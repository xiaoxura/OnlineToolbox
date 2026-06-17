import { createElement, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'cookie-viewer',
  name: 'Cookie 查看器',
  description: '查看当前页面的 Cookie 信息',
  category: 'network',
  icon: 'search',

  render(container) {
    const section = createSection('Cookie 查看器')

    const noteGroup = createElement('div', { className: 'form-group' })
    const noteLabel = createElement('label', {
      className: 'label',
      textContent: '注意：仅能查看非 HttpOnly 的 Cookie'
    })
    noteGroup.appendChild(noteLabel)
    section.appendChild(noteGroup)

    const btnGroup = createElement('div', { className: 'btn-group' })
    const refreshBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '刷新 Cookie'
    })
    const copyAllBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '复制全部'
    })
    btnGroup.appendChild(refreshBtn)
    btnGroup.appendChild(copyAllBtn)
    section.appendChild(btnGroup)

    const resultBox = createElement('div', { className: 'result-box' })
    section.appendChild(resultBox)
    container.appendChild(section)

    function parseCookies() {
      resultBox.innerHTML = ''
      const cookieStr = document.cookie

      if (!cookieStr || !cookieStr.trim()) {
        const emptyMsg = createElement('div', {
          className: 'stat-item',
          textContent: '当前页面无 Cookie'
        })
        resultBox.appendChild(emptyMsg)
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
      resultBox.appendChild(statsRow)

      const tableSection = createElement('div', { className: 'tool-section' })
      const tableLabel = createElement('label', { className: 'label', textContent: 'Cookie 列表' })
      tableSection.appendChild(tableLabel)

      const table = createElement('table', { className: 'result-box' })
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

        const copyBtn = createElement('button', {
          className: 'btn btn-secondary',
          textContent: '复制'
        })
        copyBtn.addEventListener('click', () => {
          copyToClipboard(`${name}=${value}`)
          copyBtn.textContent = '已复制'
          setTimeout(() => { copyBtn.textContent = '复制' }, 1500)
        })
        tdAction.appendChild(copyBtn)
        tr.appendChild(tdName)
        tr.appendChild(tdValue)
        tr.appendChild(tdAction)
        tbody.appendChild(tr)
      })

      table.appendChild(tbody)
      tableSection.appendChild(table)
      resultBox.appendChild(tableSection)
    }

    refreshBtn.addEventListener('click', parseCookies)
    copyAllBtn.addEventListener('click', () => {
      copyToClipboard(document.cookie || '（无 Cookie）')
      copyAllBtn.textContent = '已复制'
      setTimeout(() => { copyAllBtn.textContent = '复制全部' }, 1500)
    })

    parseCookies()
  }
}
