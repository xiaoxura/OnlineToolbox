import { createElement, createSection, createTabGroup } from '../../utils/dom.js'

const PRESETS = [
  { label: '每分钟', value: '* * * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天零点', value: '0 0 * * *' },
  { label: '每周一零点', value: '0 0 * * 1' },
  { label: '每月1号零点', value: '0 0 1 * *' }
]

const FIELD_NAMES = ['秒', '分', '时', '日', '月', '周']
const FIELD_RANGES = [
  [0, 59], [0, 59], [0, 23], [1, 31], [1, 12], [0, 7]
]
const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六', '日']

function parseField(field, min, max) {
  const values = new Set()
  const parts = field.split(',')
  for (const part of parts) {
    const slashMatch = part.match(/^(.+)\/(\d+)$/)
    let base = slashMatch ? slashMatch[1] : part
    const step = slashMatch ? parseInt(slashMatch[2]) : 1

    if (base === '*') {
      for (let i = min; i <= max; i += step) values.add(i)
    } else {
      const rangeMatch = base.match(/^(\d+)-(\d+)$/)
      if (rangeMatch) {
        const lo = parseInt(rangeMatch[1])
        const hi = parseInt(rangeMatch[2])
        for (let i = lo; i <= hi; i += step) values.add(i)
      } else if (/^\d+$/.test(base)) {
        values.add(parseInt(base))
      }
    }
  }
  return [...values].sort((a, b) => a - b)
}

function describeField(field, idx) {
  if (field === '*') return `${FIELD_NAMES[idx]}: 任意`

  const values = parseField(field, FIELD_RANGES[idx][0], FIELD_RANGES[idx][1])

  if (idx === 5) {
    const mapped = values.map(v => `周${WEEK_NAMES[v]}`)
    return `${FIELD_NAMES[idx]}: ${mapped.join(', ')}`
  }

  if (idx === 4) {
    return `${FIELD_NAMES[idx]}: ${values.join(', ')}月`
  }

  return `${FIELD_NAMES[idx]}: ${values.join(', ')}`
}

function humanReadable(parts) {
  const [sec, min, hour, day, month, dow] = parts

  let desc = ''

  if (sec !== '*' && sec !== '0') {
    const sVals = parseField(sec, 0, 59)
    desc += `第 ${sVals.join(',')} 秒 `
  }

  if (min === '*' && hour === '*') {
    desc += '每分钟执行'
  } else if (hour === '*') {
    const mVals = parseField(min, 0, 59)
    desc += `每小时的第 ${mVals.join(',')} 分钟执行`
  } else if (min === '*') {
    const hVals = parseField(hour, 0, 23)
    desc += `每天 ${hVals.join(',')} 点的每分钟执行`
  } else {
    const mVals = parseField(min, 0, 59)
    const hVals = parseField(hour, 0, 23)
    desc += `${hVals.join(',')} 时 ${mVals.join(',')} 分执行`
  }

  if (day !== '*') {
    const dVals = parseField(day, 1, 31)
    desc += `，每月第 ${dVals.join(',')} 天`
  }

  if (month !== '*') {
    const moVals = parseField(month, 1, 12)
    desc += `，${moVals.join(',')} 月`
  }

  if (dow !== '*') {
    const wVals = parseField(dow, 0, 7)
    const wNames = wVals.map(v => `周${WEEK_NAMES[v]}`)
    desc += `，${wNames.join(', ')}`
  }

  return desc
}

function getNextExecutions(parts, count = 5) {
  const [secField, minField, hourField, dayField, monthField, dowField] = parts

  const secVals = parseField(secField, 0, 59)
  const minVals = parseField(minField, 0, 59)
  const hourVals = parseField(hourField, 0, 23)
  const dayVals = parseField(dayField, 1, 31)
  const monthVals = parseField(monthField, 1, 12)
  const dowVals = parseField(dowField, 0, 7)

  const results = []
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds() + 1)

  let cursor = new Date(start)
  let safety = 0

  while (results.length < count && safety < 500000) {
    safety++
    const s = cursor.getSeconds()
    const m = cursor.getMinutes()
    const h = cursor.getHours()
    const d = cursor.getDate()
    const mo = cursor.getMonth() + 1
    const dow = cursor.getDay()

    const matchSec = secVals.includes(s)
    const matchMin = minVals.includes(m)
    const matchHour = hourVals.includes(h)
    const matchMonth = monthVals.includes(mo)
    const matchDow = dowVals.includes(dow)

    const dayWildcard = dayField === '*'
    const dayMatch = dayWildcard ? (dowField !== '*' ? matchDow : true) : dayVals.includes(d)

    if (matchSec && matchMin && matchHour && matchMonth && dayMatch) {
      results.push(new Date(cursor))
    }

    cursor = new Date(cursor.getTime() + 1000)
  }

  return results
}

function parseCron(expr) {
  const trimmed = expr.trim().replace(/\s+/g, ' ')
  const parts = trimmed.split(' ')

  if (parts.length === 5) {
    parts.unshift('0')
  }

  if (parts.length !== 6) return null

  return parts
}

export default {
  id: 'cron',
  name: 'Cron 表达式解析',
  description: '解析 Cron 表达式，显示各字段含义和下次执行时间',
  category: 'devtool',
  icon: 'timestamp',
  render(container) {
    // --- Input section ---
    const cronInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '输入 Cron 表达式，如 0 0 * * * 或 */5 * * * * *',
      value: '0 0 * * *'
    })

    const parseBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '解析',
      onClick: doParse
    })

    const inputRow = createElement('div', { className: 'form-row form-action-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: 'Cron 表达式' }),
        cronInput
      ]),
      parseBtn
    ])

    // --- Presets ---
    const presetBtns = createElement('div', { className: 'btn-group' })
    PRESETS.forEach(p => {
      const btn = createElement('button', {
        className: 'btn btn-secondary',
        textContent: p.label,
        onClick: () => {
          cronInput.value = p.value
          doParse()
        }
      })
      presetBtns.appendChild(btn)
    })

    // --- Result areas ---
    const fieldResult = createElement('div', { className: 'result-box' })
    const descResult = createElement('div', { className: 'inline-result' })
    const nextResult = createElement('div', { className: 'result-box' })
    const errorEl = createElement('div', { className: 'error-text' })

    function doParse() {
      errorEl.textContent = ''
      fieldResult.innerHTML = ''
      descResult.textContent = ''
      nextResult.innerHTML = ''

      const expr = cronInput.value.trim()
      if (!expr) {
        errorEl.textContent = '请输入 Cron 表达式'
        return
      }

      const parts = parseCron(expr)
      if (!parts) {
        errorEl.textContent = 'Cron 表达式格式错误：需要 5 或 6 个字段'
        return
      }

      // Field breakdown
      const fieldContainer = createElement('div', {})
      parts.forEach((field, idx) => {
        const item = createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-value', textContent: field }),
          createElement('span', { className: 'stat-label', textContent: describeField(field, idx) })
        ])
        fieldContainer.appendChild(item)
      })
      fieldResult.appendChild(fieldContainer)

      // Human description
      descResult.textContent = humanReadable(parts)

      // Next executions
      try {
        const nexts = getNextExecutions(parts, 5)
        if (nexts.length === 0) {
          nextResult.textContent = '无法计算下次执行时间'
        } else {
          nexts.forEach((d, i) => {
            const row = createElement('div', { className: 'stat-item' }, [
              createElement('span', { className: 'stat-label', textContent: `#${i + 1}` }),
              createElement('span', {
                className: 'stat-value',
                textContent: d.toLocaleString('zh-CN', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                })
              })
            ])
            nextResult.appendChild(row)
          })
        }
      } catch (e) {
        nextResult.innerHTML = `<span class="error-text">计算执行时间出错: ${e.message}</span>`
      }
    }

    cronInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doParse()
    })

    // Auto-parse on mount
    doParse()

    // --- Assemble ---
    const presetSection = createSection('常用表达式', presetBtns)
    const inputSection = createSection('输入', inputRow)
    const fieldSection = createSection('字段解析', fieldResult)
    const descSection = createSection('含义', descResult)
    const nextSection = createSection('下次 5 次执行时间', nextResult)

    container.appendChild(presetSection)
    container.appendChild(inputSection)
    container.appendChild(errorEl)
    container.appendChild(fieldSection)
    container.appendChild(descSection)
    container.appendChild(nextSection)
  }
}
