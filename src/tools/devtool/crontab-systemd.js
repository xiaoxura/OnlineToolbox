import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'
import { describeCron } from './cron-builder.js'

export { describeCron }

const FIELD_LABELS = ['分', '时', '日', '月', '周']
const FIELD_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7]
]
const SYSTEMD_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_NUMBERS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

const CRON_ALIASES = new Map([
  ['@yearly', '0 0 1 1 *'],
  ['@annually', '0 0 1 1 *'],
  ['@monthly', '0 0 1 * *'],
  ['@weekly', '0 0 * * 0'],
  ['@daily', '0 0 * * *'],
  ['@midnight', '0 0 * * *'],
  ['@hourly', '0 * * * *']
])

const SYSTEMD_ALIASES = new Map([
  ['minutely', '* * * * *'],
  ['hourly', '0 * * * *'],
  ['daily', '0 0 * * *'],
  ['weekly', '0 0 * * 0'],
  ['monthly', '0 0 1 * *'],
  ['yearly', '0 0 1 1 *'],
  ['annually', '0 0 1 1 *'],
  ['quarterly', '0 0 1 1,4,7,10 *'],
  ['semiannually', '0 0 1 1,7 *']
])

function isWildcard(field) {
  return String(field).trim() === '*'
}

function expandCronField(field, min, max, label) {
  const values = new Set()
  const source = String(field ?? '').trim()
  if (!source) throw new Error(`${label}字段不能为空`)

  for (const rawPart of source.split(',')) {
    const part = rawPart.trim()
    if (!part) throw new Error(`无法解析${label}字段：${source}`)
    const slashParts = part.split('/')
    if (slashParts.length > 2) throw new Error(`无法解析${label}字段：${part}`)

    let step = 1
    if (slashParts.length === 2) {
      if (!/^\d+$/.test(slashParts[1]) || Number(slashParts[1]) < 1) {
        throw new Error(`${label}字段的步长无效：${part}`)
      }
      step = Number(slashParts[1])
    }

    const base = slashParts[0]
    let low
    let high
    if (base === '*') {
      low = min
      high = max
    } else if (/^\d+$/.test(base)) {
      low = Number(base)
      high = slashParts.length === 2 ? max : low
    } else if (/^\d+-\d+$/.test(base)) {
      const range = base.split('-').map(Number)
      low = range[0]
      high = range[1]
    } else {
      throw new Error(`无法解析${label}字段：${part}`)
    }

    if (low < min || high > max) {
      throw new Error(`${label}字段超出取值范围 ${min}-${max}：${part}`)
    }
    if (low > high) throw new Error(`${label}字段的区间起点不能大于终点：${part}`)
    for (let value = low; value <= high; value += step) values.add(value)
  }

  return [...values].sort((a, b) => a - b)
}

function parseCronExpression(expression) {
  let source = String(expression ?? '').trim()
  if (!source) throw new Error('请输入 Cron 表达式')

  const alias = CRON_ALIASES.get(source.toLowerCase())
  if (alias) source = alias

  if (source.startsWith('@')) {
    if (source.toLowerCase() === '@reboot') return { reboot: true, expression: source }
    throw new Error(`不支持的时间别名：${source}`)
  }

  const fields = source.split(/\s+/)
  if (fields.length !== 5) {
    throw new Error('Cron 表达式需要 5 个字段（分 时 日 月 周）')
  }

  const values = fields.map((field, index) => {
    const [min, max] = FIELD_RANGES[index]
    return expandCronField(field, min, max, FIELD_LABELS[index])
  })

  return {
    reboot: false,
    expression: fields.join(' '),
    fields,
    minuteField: fields[0],
    hourField: fields[1],
    dayField: fields[2],
    monthField: fields[3],
    weekdayField: fields[4],
    minuteValues: values[0],
    hourValues: values[1],
    dayValues: values[2],
    monthValues: values[3],
    weekdayValues: [...new Set(values[4].map(value => value % 7))].sort((a, b) => a - b)
  }
}

function compressValues(values, width = 2) {
  const parts = []
  let index = 0
  while (index < values.length) {
    let end = index
    while (end + 1 < values.length && values[end + 1] === values[end] + 1) end += 1
    const count = end - index + 1
    if (count >= 3) {
      parts.push(`${String(values[index]).padStart(width, '0')}..${String(values[end]).padStart(width, '0')}`)
    } else {
      for (let cursor = index; cursor <= end; cursor += 1) {
        parts.push(String(values[cursor]).padStart(width, '0'))
      }
    }
    index = end + 1
  }
  return parts.join(',')
}

function dateComponent(field, values, min, max) {
  if (isWildcard(field)) return '*'
  if (values.length === max - min + 1) return '*'
  return compressValues(values, 2)
}

function systemdWeekdayPrefix(parsed) {
  if (isWildcard(parsed.weekdayField)) return ''
  if (parsed.weekdayValues.length === 7) return ''

  const ordered = parsed.weekdayValues.map(value => (value === 0 ? 7 : value)).sort((a, b) => a - b)

  const parts = []
  let index = 0
  while (index < ordered.length) {
    let end = index
    while (end + 1 < ordered.length && ordered[end + 1] === ordered[end] + 1) end += 1
    const count = end - index + 1
    if (count >= 3) {
      parts.push(`${SYSTEMD_WEEKDAYS[ordered[index] - 1]}..${SYSTEMD_WEEKDAYS[ordered[end] - 1]}`)
    } else {
      for (let cursor = index; cursor <= end; cursor += 1) {
        parts.push(SYSTEMD_WEEKDAYS[ordered[cursor] - 1])
      }
    }
    index = end + 1
  }
  return parts.join(',')
}

function systemdTime(parsed) {
  const { minuteField, hourField, minuteValues, hourValues } = parsed
  const minuteStep = /^\*\/(\d+)$/.exec(minuteField)
  const hourStep = /^\*\/(\d+)$/.exec(hourField)

  if (isWildcard(minuteField) && isWildcard(hourField)) return '*:*:00'

  if (minuteStep && isWildcard(hourField)) return `*:0/${minuteStep[1]}`

  if (hourStep && minuteValues.length === 1 && minuteValues[0] === 0) {
    return hourStep[1] === '1' ? '*:00:00' : `0/${hourStep[1]}:00:00`
  }

  const hourPart = isWildcard(hourField) ? '*' : compressValues(hourValues, 2)

  if (isWildcard(minuteField)) return `${hourPart}:*:00`

  if (minuteStep) return `${hourPart}:00/${minuteStep[1]}`

  return `${hourPart}:${compressValues(minuteValues, 2)}:00`
}

function calendarLines(parsed) {
  const time = systemdTime(parsed)
  const month = dateComponent(parsed.monthField, parsed.monthValues, 1, 12)
  const day = dateComponent(parsed.dayField, parsed.dayValues, 1, 31)
  const weekday = systemdWeekdayPrefix(parsed)

  if (weekday && !isWildcard(parsed.dayField)) {
    return [`${weekday} *-${month}-* ${time}`, `*-${month}-${day} ${time}`]
  }

  return [`${weekday ? `${weekday} ` : ''}*-${month}-${day} ${time}`]
}

function buildServiceName() {
  return 'cron-task'
}

function buildSystemdUnit({ expression, calendars, notes, command, user, description, approximation }) {
  const name = buildServiceName()
  const unitDescription = description || 'Cron 定时任务'
  const lines = [
    `# Cron 表达式：${expression}`,
    `# 含义：${approximation || '见下方 OnCalendar'}`,
    '',
    `# /etc/systemd/system/${name}.service`,
    '[Unit]',
    `Description=${unitDescription}`,
    '',
    '[Service]',
    'Type=oneshot'
  ]

  if (user) lines.push(`User=${user}`)
  lines.push(`ExecStart=${command || '/usr/local/bin/your-command'}`)

  lines.push('', `# /etc/systemd/system/${name}.timer`, '[Unit]', `Description=${unitDescription} 定时器`, '', '[Timer]')

  for (const note of notes) lines.push(`# ${note}`)

  if (calendars.length) {
    for (const calendar of calendars) lines.push(`OnCalendar=${calendar}`)
    lines.push('Persistent=true')
  } else {
    lines.push('OnBootSec=1min')
  }

  lines.push('', '[Install]', 'WantedBy=timers.target')
  return `${lines.join('\n')}\n`
}

function dayMonthStepNote(parsed) {
  if (parsed.fields[2].includes('/') || parsed.fields[3].includes('/')) {
    return '“日/月”字段的步长已展开为具体取值；systemd 没有与 cron 完全等价的跨月“每 N 天”写法。'
  }
  return ''
}

export function cronToSystemd(expression, options = {}) {
  const parsed = parseCronExpression(expression)
  const command = String(options.command ?? '').trim()
  const user = String(options.user ?? '').trim()
  const description = String(options.description ?? '').trim()

  if (parsed.reboot) {
    return buildSystemdUnit({
      expression: '@reboot',
      calendars: [],
      notes: ['@reboot 无法精确映射为 OnCalendar；这里使用 OnBootSec=1min 近似，按需调整等待时间。'],
      command,
      user,
      description,
      approximation: '开机后约 1 分钟执行（近似）'
    })
  }

  const notes = []
  const bothDayAndWeekday = !isWildcard(parsed.dayField) && !isWildcard(parsed.weekdayField)
  if (bothDayAndWeekday) {
    notes.push('cron 中“日”和“周”同时受限时按“或”匹配，已拆分为多条 OnCalendar。')
  }
  const stepNote = dayMonthStepNote(parsed)
  if (stepNote) notes.push(stepNote)

  return buildSystemdUnit({
    expression: parsed.expression,
    calendars: calendarLines(parsed),
    notes,
    command,
    user,
    description,
    approximation: describeCron(parsed.expression)
  })
}

function systemdWeekdayToCron(token) {
  if (!token) return '*'
  const values = new Set()

  for (const rawPiece of token.split(',')) {
    const piece = rawPiece.trim()
    if (!piece) throw new Error(`无法解析星期字段：${token}`)
    const range = /^([A-Za-z]{3})(?:\.\.|-)([A-Za-z]{3})$/.exec(piece)
    if (range) {
      const from = WEEKDAY_NUMBERS[range[1].toLowerCase()]
      const to = WEEKDAY_NUMBERS[range[2].toLowerCase()]
      if (from === undefined || to === undefined) throw new Error(`无法解析星期：${piece}`)
      const fromOrder = from === 0 ? 7 : from
      const toOrder = to === 0 ? 7 : to
      if (fromOrder > toOrder) throw new Error(`星期区间起点不能大于终点：${piece}`)
      for (let order = fromOrder; order <= toOrder; order += 1) values.add(order === 7 ? 0 : order)
      continue
    }
    const day = WEEKDAY_NUMBERS[piece.toLowerCase()]
    if (day === undefined) throw new Error(`无法解析星期：${piece}`)
    values.add(day)
  }

  if (values.size === 7) return '*'
  const sorted = [...values].sort((a, b) => a - b)
  const parts = []
  let index = 0
  while (index < sorted.length) {
    let end = index
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1
    if (end - index + 1 >= 3) parts.push(`${sorted[index]}-${sorted[end]}`)
    else for (let cursor = index; cursor <= end; cursor += 1) parts.push(String(sorted[cursor]))
    index = end + 1
  }
  return parts.join(',')
}

function systemdDateComponentToCron(part, min, max, label) {
  const source = String(part ?? '').trim()
  if (!source || source === '*') return '*'

  const pieces = []
  for (const rawPiece of source.split(',')) {
    const piece = rawPiece.trim()
    const slashParts = piece.split('/')
    if (slashParts.length > 2) throw new Error(`无法解析${label}字段：${piece}`)
    const base = slashParts[0]
    const step = slashParts[1]
    if (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1)) {
      throw new Error(`${label}字段的步长无效：${piece}`)
    }

    if (base === '*') {
      pieces.push(step ? `*/${step}` : '*')
      continue
    }

    const range = /^(\d+)\.\.(\d+)$/.exec(base)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (from < min || to > max || from > to) throw new Error(`${label}字段超出范围：${piece}`)
      pieces.push(`${from}-${to}${step ? `/${step}` : ''}`)
      continue
    }

    if (/^\d+$/.test(base)) {
      const value = Number(base)
      if (value < min || value > max) throw new Error(`${label}字段超出范围：${piece}`)
      pieces.push(`${value}${step ? `-${max}/${step}` : ''}`)
      continue
    }

    throw new Error(`无法解析${label}字段：${piece}`)
  }

  return pieces.join(',')
}

function systemdDateToCron(token) {
  if (!token) return { day: '*', month: '*' }
  const parts = token.split('-')
  if (parts.length !== 3) throw new Error(`无法解析日期部分：${token}`)
  const [year, month, day] = parts
  if (year !== '*') throw new Error(`暂不支持限定年份的 OnCalendar：${token}`)
  return {
    month: systemdDateComponentToCron(month, 1, 12, '月'),
    day: systemdDateComponentToCron(day, 1, 31, '日')
  }
}

function systemdTimeComponentToCron(part, min, max, label) {
  const source = String(part ?? '').trim()
  if (!source || source === '*') return '*'

  const pieces = []
  for (const rawPiece of source.split(',')) {
    const piece = rawPiece.trim()
    const slashParts = piece.split('/')
    if (slashParts.length > 2) throw new Error(`无法解析${label}字段：${piece}`)
    const base = slashParts[0]
    const step = slashParts[1]
    if (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1)) {
      throw new Error(`${label}字段的步长无效：${piece}`)
    }

    if (base === '*') {
      pieces.push(step ? `*/${step}` : '*')
      continue
    }

    const range = /^(\d+)\.\.(\d+)$/.exec(base)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (from < min || to > max || from > to) throw new Error(`${label}字段超出范围：${piece}`)
      pieces.push(`${from}-${to}${step ? `/${step}` : ''}`)
      continue
    }

    if (/^\d+$/.test(base)) {
      const value = Number(base)
      if (value < min || value > max) throw new Error(`${label}字段超出范围：${piece}`)
      if (step) pieces.push(value === min ? `*/${step}` : `${value}-${max}/${step}`)
      else pieces.push(String(value))
      continue
    }

    throw new Error(`无法解析${label}字段：${piece}`)
  }

  return pieces.join(',')
}

function systemdTimeToCron(token) {
  const parts = token.split(':')
  if (parts.length < 2 || parts.length > 3) throw new Error(`无法解析时间部分：${token}`)
  const [hourPart, minutePart, secondPart = '00'] = parts

  if (secondPart !== '00' && secondPart !== '0') {
    throw new Error('5 段 Cron 最小粒度是分钟，无法表示 systemd 的秒字段')
  }

  return {
    hour: systemdTimeComponentToCron(hourPart, 0, 23, '时'),
    minute: systemdTimeComponentToCron(minutePart, 0, 59, '分')
  }
}

function systemdSpecToCron(spec) {
  const source = spec.trim().replace(/\s+/g, ' ')
  if (!source) throw new Error('OnCalendar 表达式为空')

  const alias = SYSTEMD_ALIASES.get(source.toLowerCase())
  if (alias) return alias

  const tokens = source.split(' ')
  let weekdayToken = ''
  let dateToken = ''
  let timeToken = ''

  for (const token of tokens) {
    if (/^[A-Za-z]{3}(?:\.\.|-|,|$)/.test(token)) {
      if (weekdayToken) throw new Error(`重复的星期片段：${token}`)
      weekdayToken = token
      continue
    }
    if (token.includes(':')) {
      if (timeToken) throw new Error(`重复的时间片段：${token}`)
      timeToken = token
      continue
    }
    if (token.includes('-')) {
      if (dateToken) throw new Error(`重复的日期片段：${token}`)
      dateToken = token
      continue
    }
    throw new Error(`无法解析的 OnCalendar 片段：${token}`)
  }

  if (!timeToken) throw new Error(`OnCalendar 缺少时间部分：${source}`)

  const date = systemdDateToCron(dateToken)
  const time = systemdTimeToCron(timeToken)
  const weekday = systemdWeekdayToCron(weekdayToken)

  return `${time.minute} ${time.hour} ${date.day} ${date.month} ${weekday}`
}

function extractCalendarSpecs(input) {
  const source = String(input ?? '').trim()
  if (!source) throw new Error('请输入 systemd OnCalendar 表达式')

  const matches = [...source.matchAll(/^\s*OnCalendar\s*=\s*(.+?)\s*$/gim)]
  if (matches.length) {
    return matches.map(match => match[1].replace(/\s+#.*$/, '').trim()).filter(Boolean)
  }

  if (/\[[^\]]+\]|^\s*[A-Za-z][A-Za-z0-9_-]*\s*=/m.test(source)) {
    throw new Error('未找到 OnCalendar= 行')
  }

  const specs = source
    .split('\n')
    .map(line => line.replace(/\s+#.*$/, '').trim())
    .filter(line => line && !line.startsWith('#'))
  if (!specs.length) throw new Error('请输入 systemd OnCalendar 表达式')
  return specs
}

export function systemdToCron(crontabLine) {
  const specs = extractCalendarSpecs(crontabLine)
  return specs.map(spec => systemdSpecToCron(spec)).join('\n')
}

const SAMPLE_CRON = '0 9 * * 1-5'
const SAMPLE_SYSTEMD = 'Mon..Fri *-*-* 09:00:00'

export default {
  render(container) {
    const directionGroup = createSegmentedGroup(
      [
        { value: 'cron', label: 'Cron → systemd' },
        { value: 'systemd', label: 'systemd → Cron' }
      ],
      value => {
        const cronMode = value === 'cron'
        input.placeholder = cronMode ? '* * * * *' : 'Mon..Fri *-*-* 09:00:00'
        serviceFields.hidden = !cronMode
        serviceHint.hidden = !cronMode
        output.value = ''
        errorEl.textContent = ''
        status.textContent = ''
      },
      { label: '转换方向' }
    )

    const input = createElement('textarea', {
      className: 'textarea large',
      rows: 6,
      placeholder: '* * * * *',
      'aria-label': 'Cron 表达式或 systemd OnCalendar'
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      rows: 20,
      readOnly: true,
      placeholder: '转换结果将显示在这里…',
      'aria-label': '转换结果'
    })
    const errorEl = createElement('div', { className: 'error-text' })
    const status = createElement('div', {
      className: 'form-hint',
      role: 'status',
      'aria-live': 'polite'
    })

    const commandInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: '/usr/local/bin/backup.sh',
      placeholder: '/usr/local/bin/backup.sh',
      'aria-label': '服务执行命令'
    })
    const userInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: 'www-data',
      placeholder: 'www-data',
      'aria-label': '运行用户'
    })
    const descriptionInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: '工作日备份',
      placeholder: '工作日备份',
      'aria-label': '任务描述'
    })

    const serviceFields = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '命令' }),
        commandInput
      ]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '用户' }), userInput]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '描述' }),
        descriptionInput
      ])
    ])

    const serviceHint = createElement('div', {
      className: 'form-hint',
      textContent: '命令、用户和描述仅用于 Cron → systemd 时生成 service 单元。'
    })

    function currentDirection() {
      return directionGroup.getValue()
    }

    function run() {
      errorEl.textContent = ''
      status.textContent = ''
      output.value = ''
      const raw = input.value.trim()

      if (!raw) {
        errorEl.textContent = currentDirection() === 'cron' ? '请输入 Cron 表达式' : '请输入 systemd OnCalendar 表达式'
        return
      }

      try {
        if (currentDirection() === 'cron') {
          output.value = cronToSystemd(raw, {
            command: commandInput.value,
            user: userInput.value,
            description: descriptionInput.value
          })
          status.textContent = '已生成 systemd service 与 timer'
        } else {
          output.value = systemdToCron(raw)
          status.textContent = '已转换为 Cron 表达式'
        }
      } catch (cause) {
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const actionButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '转换',
      onClick: run
    })

    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        if (currentDirection() === 'cron') {
          input.value = SAMPLE_CRON
          commandInput.value = '/usr/local/bin/backup.sh'
          userInput.value = 'www-data'
          descriptionInput.value = '工作日备份'
        } else {
          input.value = SAMPLE_SYSTEMD
        }
        run()
      }
    })

    const copyButton = createCopyButton(() => output.value)

    container.append(
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '转换方向' }),
        directionGroup
      ]),
      createSection('输入', input),
      serviceFields,
      serviceHint,
      createElement('div', { className: 'btn-group form-action-row' }, [actionButton, sampleButton]),
      status,
      errorEl,
      createSection('输出结果', output, [copyButton])
    )
  }
}
