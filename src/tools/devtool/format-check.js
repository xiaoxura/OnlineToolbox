import { createElement, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

export default {
  id: 'format-check',
  name: '格式校验工具',
  description: '校验手机号、邮箱、身份证、URL、IP地址、MAC地址、日期等格式',
  category: 'devtool',
  icon: 'regex',
  render(container) {
    const CHECKS = [
      {
        value: 'phone', label: '手机号',
        pattern: /^1[3-9]\d{9}$/,
        patternStr: '^1[3-9]\\d{9}$',
        placeholder: '请输入手机号',
        extract(val) {
          const m = val.match(/^(1[3-9])(\d{4})(\d{4})$/)
          return m ? `运营商号段: ${m[1]}` : ''
        }
      },
      {
        value: 'email', label: '邮箱',
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        patternStr: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        placeholder: '请输入邮箱地址',
        extract(val) {
          const m = val.match(/^(.+)@(.+)\.(.+)$/)
          return m ? `用户名: ${m[1]}, 域名: ${m[2]}.${m[3]}` : ''
        }
      },
      {
        value: 'idcard', label: '身份证',
        pattern: /^\d{17}[\dXx]$/,
        patternStr: '^\\d{17}[\\dXx]$',
        placeholder: '请输入18位身份证号码',
        extract(val) {
          const v = val.toUpperCase()
          if (v.length === 18) {
            const gender = parseInt(v[16]) % 2 === 1 ? '男' : '女'
            const birth = `${v.slice(6, 10)}-${v.slice(10, 12)}-${v.slice(12, 14)}`
            return `出生日期: ${birth}, 性别: ${gender}`
          }
          return ''
        }
      },
      {
        value: 'url', label: 'URL',
        pattern: /^https?:\/\/[^\s]+$/,
        patternStr: '^https?:\\/\\/[^\\s]+$',
        placeholder: '请输入 URL',
        extract(val) {
          try {
            const u = new URL(val)
            return `协议: ${u.protocol}, 主机: ${u.hostname}, 路径: ${u.pathname}`
          } catch { return '' }
        }
      },
      {
        value: 'ipv4', label: 'IPv4',
        pattern: /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
        patternStr: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$',
        placeholder: '请输入 IPv4 地址',
        extract(val) {
          const parts = val.split('.')
          const first = parseInt(parts[0])
          let type = '公共地址'
          if (first === 10 || (first === 172 && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) || (first === 192 && parseInt(parts[1]) === 168)) {
            type = '私有地址'
          }
          if (first === 127) type = '环回地址'
          return `类型: ${type}`
        }
      },
      {
        value: 'ipv6', label: 'IPv6',
        pattern: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/,
        patternStr: '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$',
        placeholder: '请输入 IPv6 地址',
        extract(val) {
          if (val === '::1') return '环回地址'
          if (val === '::') return '未指定地址'
          return 'IPv6 地址格式'
        }
      },
      {
        value: 'mac', label: 'MAC地址',
        pattern: /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/,
        patternStr: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$',
        placeholder: '请输入 MAC 地址 (如 AA:BB:CC:DD:EE:FF)',
        extract(val) {
          const parts = val.replace(/-/g, ':').split(':')
          const first = parseInt(parts[0], 16)
          const isLocal = (first & 2) !== 0
          const isMulticast = (first & 1) !== 0
          return `本地管理: ${isLocal ? '是' : '否'}, 组播: ${isMulticast ? '是' : '否'}`
        }
      },
      {
        value: 'date', label: '日期',
        pattern: /^\d{4}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])$/,
        patternStr: '^\\d{4}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\\d|3[01])$',
        placeholder: '请输入日期 (如 2024-01-15)',
        extract(val) {
          const d = new Date(val.replace(/\//g, '-'))
          if (!isNaN(d.getTime())) {
            const weekdays = ['日', '一', '二', '三', '四', '五', '六']
            return `星期${weekdays[d.getDay()]}`
          }
          return ''
        }
      }
    ]

    let currentMode = 'phone'
    let batchMode = false

    const modeCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'fc-batch',
      onChange: (e) => {
        batchMode = e.target.checked
        if (batchMode) {
          singleGroup.setAttribute('hidden', 'true')
          batchGroup.removeAttribute('hidden')
        } else {
          singleGroup.removeAttribute('hidden')
          batchGroup.setAttribute('hidden', 'true')
        }
        resultContainer.setAttribute('hidden', 'true')
      }
    })
    const modeRow = createElement('label', { className: 'option-item' }, [
      modeCheck,
      createElement('span', { textContent: '批量模式' })
    ])

    const singleInput = createElement('input', {
      className: 'input',
      type: 'text',
      id: 'fc-input',
      placeholder: '请输入手机号'
    })
    const singleGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'fc-input' }, ['输入内容']),
      singleInput
    ])

    const batchTextarea = createElement('textarea', {
      className: 'textarea',
      id: 'fc-batch-input',
      rows: '8',
      placeholder: '每行输入一个待校验的内容...'
    })
    const batchGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'fc-batch-input' }, ['批量输入 (每行一个)']),
      batchTextarea
    ])
    batchGroup.setAttribute('hidden', 'true')

    const checkBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '校验',
      onClick: doCheck
    })
    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '清空',
      onClick: () => {
        singleInput.value = ''
        batchTextarea.value = ''
        resultContainer.setAttribute('hidden', 'true')
        resultContainer.innerHTML = ''
      }
    })
    const btnGroup = createElement('div', { className: 'btn-group' }, [checkBtn, clearBtn])

    const patternDisplay = createElement('div', { className: 'stat-item' })

    const resultContainer = createElement('div', { className: 'result-box' })
    resultContainer.setAttribute('hidden', 'true')

    const tabGroup = createSegmentedGroup(CHECKS.map(c => ({ label: c.label, value: c.value })), (value) => {
      currentMode = value
      const check = CHECKS.find(c => c.value === value)
      singleInput.setAttribute('placeholder', check.placeholder)
      resultContainer.setAttribute('hidden', 'true')
      resultContainer.innerHTML = ''
      patternDisplay.innerHTML = ''
      const patternLabel = createElement('span', { className: 'stat-label', textContent: '正则表达式' })
      const patternValue = createElement('span', { className: 'stat-value', textContent: check.patternStr })
      patternDisplay.appendChild(patternLabel)
      patternDisplay.appendChild(patternValue)
    })

    function doCheck() {
      const check = CHECKS.find(c => c.value === currentMode)
      resultContainer.removeAttribute('hidden')
      resultContainer.innerHTML = ''

      if (batchMode) {
        doBatchCheck(check)
      } else {
        doSingleCheck(check)
      }
    }

    function doSingleCheck(check) {
      const value = singleInput.value.trim()
      if (!value) {
        const err = createElement('div', { className: 'error-text', textContent: '请输入待校验内容' })
        resultContainer.appendChild(err)
        return
      }

      const isValid = check.pattern.test(value)
      const statusItem = createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: '校验结果' }),
        createElement('span', {
          className: isValid ? 'stat-value' : 'error-text',
          textContent: isValid ? '格式正确' : '格式错误'
        })
      ])
      resultContainer.appendChild(statusItem)

      if (isValid && check.extract) {
        const info = check.extract(value)
        if (info) {
          const infoItem = createElement('div', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: '提取信息' }),
            createElement('span', { className: 'stat-value', textContent: info })
          ])
          resultContainer.appendChild(infoItem)
        }
      }
    }

    function doBatchCheck(check) {
      const lines = batchTextarea.value.split('\n').map(l => l.trim()).filter(l => l)
      if (lines.length === 0) {
        const err = createElement('div', { className: 'error-text', textContent: '请输入待校验内容' })
        resultContainer.appendChild(err)
        return
      }

      const table = createElement('table', { className: 'result-table' })
      const thead = createElement('thead', {}, [
        createElement('tr', {}, [
          createElement('th', { textContent: '输入' }),
          createElement('th', { textContent: '结果' }),
          createElement('th', { textContent: '信息' })
        ])
      ])
      table.appendChild(thead)

      const tbody = createElement('tbody')
      let validCount = 0

      lines.forEach(line => {
        const isValid = check.pattern.test(line)
        if (isValid) validCount++
        const info = isValid && check.extract ? check.extract(line) : ''

        const row = createElement('tr', {}, [
          createElement('td', { textContent: line }),
          createElement('td', {
            className: isValid ? '' : 'error-text',
            textContent: isValid ? '正确' : '错误'
          }),
          createElement('td', { textContent: info })
        ])
        tbody.appendChild(row)
      })

      table.appendChild(tbody)
      resultContainer.appendChild(createTableScroll(table, '批量格式校验结果'))

      const summary = createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: '统计' }),
        createElement('span', {
          className: 'stat-value',
          textContent: `${validCount}/${lines.length} 通过`
        })
      ])
      resultContainer.appendChild(summary)
    }

    container.appendChild(tabGroup)
    container.appendChild(modeRow)
    container.appendChild(patternDisplay)
    container.appendChild(singleGroup)
    container.appendChild(batchGroup)
    container.appendChild(btnGroup)
    container.appendChild(resultContainer)

    const initialCheck = CHECKS[0]
    const patternLabel = createElement('span', { className: 'stat-label', textContent: '正则表达式' })
    const patternValue = createElement('span', { className: 'stat-value', textContent: initialCheck.patternStr })
    patternDisplay.appendChild(patternLabel)
    patternDisplay.appendChild(patternValue)
  }
}
