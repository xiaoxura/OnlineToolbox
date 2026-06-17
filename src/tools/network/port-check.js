import { createElement, createSection } from '../../utils/dom.js'

const portData = [
  { port: 20, service: 'FTP-Data', desc: 'FTP 数据传输', category: 'remote' },
  { port: 21, service: 'FTP', desc: 'FTP 控制连接', category: 'remote' },
  { port: 22, service: 'SSH', desc: '安全外壳协议', category: 'remote' },
  { port: 23, service: 'Telnet', desc: '远程终端协议', category: 'remote' },
  { port: 25, service: 'SMTP', desc: '简单邮件传输协议', category: 'email' },
  { port: 53, service: 'DNS', desc: '域名系统', category: 'other' },
  { port: 80, service: 'HTTP', desc: '超文本传输协议', category: 'web' },
  { port: 110, service: 'POP3', desc: '邮局协议 v3', category: 'email' },
  { port: 143, service: 'IMAP', desc: '互联网消息访问协议', category: 'email' },
  { port: 443, service: 'HTTPS', desc: '安全超文本传输协议', category: 'web' },
  { port: 993, service: 'IMAPS', desc: 'IMAP over SSL', category: 'email' },
  { port: 995, service: 'POP3S', desc: 'POP3 over SSL', category: 'email' },
  { port: 3306, service: 'MySQL', desc: 'MySQL 数据库', category: 'database' },
  { port: 3389, service: 'RDP', desc: '远程桌面协议', category: 'remote' },
  { port: 5432, service: 'PostgreSQL', desc: 'PostgreSQL 数据库', category: 'database' },
  { port: 6379, service: 'Redis', desc: 'Redis 缓存数据库', category: 'database' },
  { port: 8080, service: 'HTTP-Alt', desc: 'HTTP 备用端口', category: 'web' },
  { port: 8443, service: 'HTTPS-Alt', desc: 'HTTPS 备用端口', category: 'web' },
  { port: 27017, service: 'MongoDB', desc: 'MongoDB 数据库', category: 'database' }
]

const categoryLabels = {
  web: 'Web 服务',
  email: '邮件服务',
  database: '数据库',
  remote: '远程连接',
  other: '其他'
}

const categoryOrder = ['web', 'email', 'database', 'remote', 'other']

export default {
  id: 'port-check',
  name: '端口说明查询',
  description: '查询常见网络端口号对应的服务和说明',
  category: 'network',
  icon: 'search',
  render(container) {
    // --- Search input ---
    const searchInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '输入端口号或服务名称进行搜索'
    })

    // --- Category filter ---
    const categorySelect = createElement('select', { className: 'select' }, [
      createElement('option', { value: 'all', textContent: '全部分类' }),
      ...categoryOrder.map(key =>
        createElement('option', { value: key, textContent: categoryLabels[key] })
      )
    ])

    const resultsEl = createElement('div', { className: 'result-box' })

    function renderResults() {
      const query = searchInput.value.trim().toLowerCase()
      const category = categorySelect.value

      let filtered = portData
      if (category !== 'all') {
        filtered = filtered.filter(p => p.category === category)
      }
      if (query) {
        filtered = filtered.filter(p =>
          p.port.toString().includes(query) ||
          p.service.toLowerCase().includes(query) ||
          p.desc.toLowerCase().includes(query)
        )
      }

      resultsEl.innerHTML = ''

      if (filtered.length === 0) {
        resultsEl.appendChild(
          createElement('div', { className: 'error-text', textContent: '未找到匹配的端口信息' })
        )
        return
      }

      // Group by category
      const grouped = {}
      filtered.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = []
        grouped[p.category].push(p)
      })

      categoryOrder.forEach(catKey => {
        if (!grouped[catKey]) return

        const groupTitle = createElement('div', { className: 'stat-label', textContent: categoryLabels[catKey] })
        resultsEl.appendChild(groupTitle)

        const statsRow = createElement('div', { className: 'stats-row' })
        grouped[catKey].forEach(p => {
          const item = createElement('div', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-value', textContent: p.port.toString() }),
            createElement('span', { className: 'stat-label', textContent: p.service }),
            createElement('span', { className: 'stat-label', textContent: p.desc })
          ])
          statsRow.appendChild(item)
        })
        resultsEl.appendChild(statsRow)
      })
    }

    searchInput.addEventListener('input', renderResults)
    categorySelect.addEventListener('change', renderResults)

    const inputRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '搜索端口/服务' }),
        searchInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '分类筛选' }),
        categorySelect
      ])
    ])

    const inputContent = createElement('div', {}, [inputRow])
    const inputSection = createSection('查询条件', inputContent)
    const resultSection = createSection('端口列表', resultsEl)

    container.appendChild(inputSection)
    container.appendChild(resultSection)

    // Initial render
    renderResults()
  }
}
