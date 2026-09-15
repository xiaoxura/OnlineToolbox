import { createElement, createSection, createSegmentedGroup, createTabGroup } from '../../utils/dom.js'

// Visual builder for a standard 5-field cron expression (分 时 日 月 周).
// The field-expansion and description approach mirrors the sibling parser in
// ./cron.js (which handles 5/6-field expressions plus next-run times); this
// module builds expressions instead of parsing them, so it keeps its own small
// expander rather than importing from a tool it must not change.

export const FIELD_DEFS = [
  { key: 'minute', label: '分', min: 0, max: 59, hint: '0-59' },
  { key: 'hour', label: '时', min: 0, max: 23, hint: '0-23' },
  { key: 'day', label: '日', min: 1, max: 31, hint: '1-31' },
  { key: 'month', label: '月', min: 1, max: 12, hint: '1-12' },
  { key: 'weekday', label: '周', min: 0, max: 7, hint: '0-7（0 和 7 都是周日）' }
]

export const FIELD_MODES = [
  { value: 'every', label: '每…' },
  { value: 'value', label: '具体值' },
  { value: 'range', label: '区间' },
  { value: 'step', label: '步长' }
]

export const CRON_ALIASES = [
  { alias: '@hourly', label: '@hourly 每小时', expression: '0 * * * *' },
  { alias: '@daily', label: '@daily 每天零点', expression: '0 0 * * *' },
  { alias: '@weekly', label: '@weekly 每周日零点', expression: '0 0 * * 0' },
  { alias: '@monthly', label: '@monthly 每月 1 号零点', expression: '0 0 1 * *' },
  { alias: '@yearly', label: '@yearly 每年 1 月 1 号零点', expression: '0 0 1 1 *' }
]

const ALIAS_MAP = new Map(CRON_ALIASES.map(item => [item.alias, item.expression]))
ALIAS_MAP.set('@annually', '0 0 1 1 *')
ALIAS_MAP.set('@midnight', '0 0 * * *')

const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function fieldDef(key) {
  const def = FIELD_DEFS.find(item => item.key === key)
  if (!def) throw new Error(`未知的字段：${key}`)
  return def
}

// Parse one value of a field; empty input yields null, an out-of-range or
// non-integer value throws a Chinese error.
function parseFieldNumber(text, def) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  if (!/^\d+$/.test(raw)) throw new Error(`${def.label} 字段只能填写整数（当前：${raw}）`)
  const value = Number(raw)
  if (value < def.min || value > def.max) {
    throw new Error(`${def.label} 字段的取值范围是 ${def.min}-${def.max}（当前：${value}）`)
  }
  return value
}

function buildField(key, config) {
  const def = fieldDef(key)
  const state = config || {}
  const mode = state.mode || 'every'

  if (mode === 'every') return '*'

  if (mode === 'value') {
    const raw = String(state.values ?? '').trim()
    if (!raw) return '*'
    const tokens = raw.split(',').map(token => token.trim()).filter(Boolean)
    if (!tokens.length) return '*'
    // 自由输入里允许直接写区间（如 1-5），与 cron 原生语法一致
    return tokens.map(token => {
      const range = /^(\d+)-(\d+)$/.exec(token)
      if (!range) return String(parseFieldNumber(token, def))
      const from = parseFieldNumber(range[1], def)
      const to = parseFieldNumber(range[2], def)
      if (from > to) throw new Error(`${def.label} 字段的区间起点不能大于终点`)
      return `${from}-${to}`
    }).join(',')
  }

  if (mode === 'range') {
    const from = parseFieldNumber(state.from, def)
    const to = parseFieldNumber(state.to, def)
    if (from === null && to === null) return '*'
    if (from === null || to === null) throw new Error(`${def.label} 字段的区间需要同时填写起点和终点`)
    if (from > to) throw new Error(`${def.label} 字段的区间起点不能大于终点`)
    return `${from}-${to}`
  }

  if (mode === 'step') {
    const step = parseFieldNumber(state.step, def)
    if (step === null) return '*'
    if (step < 1) throw new Error(`${def.label} 字段的步长必须大于 0`)
    const from = parseFieldNumber(state.from, def)
    const to = parseFieldNumber(state.to, def)
    if (from !== null && to !== null) {
      if (from > to) throw new Error(`${def.label} 字段的区间起点不能大于终点`)
      return `${from}-${to}/${step}`
    }
    if (from !== null || to !== null) throw new Error(`${def.label} 字段的区间需要同时填写起点和终点`)
    return `*/${step}`
  }

  throw new Error(`未知的取值方式：${mode}`)
}

// state: { minute|hour|day|month|weekday: { mode, values, from, to, step } }
export function buildCronExpression(state) {
  const source = state || {}
  return FIELD_DEFS.map(def => buildField(def.key, source[def.key])).join(' ')
}

// Expand a single cron field ("*/5", "1-3", "7", "1,15") into its sorted values.
export function expandCronField(field, min, max, label = field) {
  const text = String(field ?? '').trim()
  if (!text) throw new Error(`${label} 字段不能为空`)
  const values = new Set()

  for (const part of text.split(',')) {
    const token = part.trim()
    if (!token) throw new Error(`无法解析的字段片段：${label}`)
    const slash = token.split('/')
    if (slash.length > 2) throw new Error(`无法解析的字段片段：${token}`)
    const base = slash[0]
    let step = 1
    if (slash.length === 2) {
      if (!/^\d+$/.test(slash[1]) || Number(slash[1]) < 1) throw new Error(`步长无效：${token}`)
      step = Number(slash[1])
    }

    let low
    let high
    if (base === '*') {
      low = min
      high = max
    } else if (/^\d+$/.test(base)) {
      low = Number(base)
      high = slash.length === 2 ? max : low
    } else if (/^\d+-\d+$/.test(base)) {
      const [from, to] = base.split('-').map(Number)
      low = from
      high = to
    } else {
      throw new Error(`无法解析的字段片段：${token}`)
    }

    if (low < min || high > max) throw new Error(`${token} 超出取值范围 ${min}-${max}`)
    if (low > high) throw new Error(`区间起点不能大于终点：${token}`)
    for (let value = low; value <= high; value += step) values.add(value)
  }

  return [...values].sort((a, b) => a - b)
}

function normalizeFields(expression) {
  const text = String(expression ?? '').trim().replace(/\s+/g, ' ')
  if (!text) throw new Error('请输入 Cron 表达式')
  if (text.startsWith('@')) {
    const alias = text.toLowerCase()
    const resolved = ALIAS_MAP.get(alias)
    if (!resolved) throw new Error(`不支持的时间别名：${text}`)
    return resolved.split(' ')
  }
  const parts = text.split(' ')
  if (parts.length === 6) parts.shift()
  if (parts.length !== 5) throw new Error('Cron 表达式格式错误：需要 5 个字段（分 时 日 月 周）')
  return parts
}

function pad(value) {
  return String(value).padStart(2, '0')
}

// "0,1,2,3,4" → "周日至周四" style ranges for consecutive weekdays.
function formatWeekdays(weekdays) {
  const days = [...new Set(weekdays)].sort((a, b) => a - b)
  if (days.length >= 3) {
    const consecutive = days.every((day, index) => index === 0 || day === days[index - 1] + 1)
    if (consecutive) return `${WEEK_NAMES[days[0]]}至${WEEK_NAMES[days[days.length - 1]]}`
  }
  return days.map(day => WEEK_NAMES[day]).join('、')
}

// 5 字段 cron 表达式（或 @daily 等别名）→ 中文描述
export function describeCron(expression) {
  const [minuteField, hourField, dayField, monthField, weekdayField] = normalizeFields(expression)

  const minutes = expandCronField(minuteField, 0, 59, '分')
  const hours = expandCronField(hourField, 0, 23, '时')
  const days = expandCronField(dayField, 1, 31, '日')
  const months = expandCronField(monthField, 1, 12, '月')
  const weekdays = [...new Set(expandCronField(weekdayField, 0, 7, '周').map(value => value % 7))]

  const everyMinute = minuteField === '*'
  const everyHour = hourField === '*'
  const minuteStep = /^\*\/(\d+)$/.exec(minuteField)
  const hourStep = /^\*\/(\d+)$/.exec(hourField)

  let phrase = ''
  let clocks = null
  if (everyMinute && everyHour) {
    phrase = '每分钟'
  } else if (everyHour) {
    if (minuteStep) phrase = `每 ${minuteStep[1]} 分钟`
    else if (minutes.length === 1 && minutes[0] === 0) phrase = '每小时整点'
    else phrase = `每小时的第 ${minutes.join('、')} 分钟`
  } else if (everyMinute) {
    phrase = `每天 ${hours.join('、')} 点的每一分钟`
  } else if (hourStep && minuteField === '0') {
    phrase = `每 ${hourStep[1]} 小时`
  } else if (hours.length * minutes.length <= 12) {
    clocks = []
    for (const hour of hours) {
      for (const minute of minutes) clocks.push(`${pad(hour)}:${pad(minute)}`)
    }
  } else {
    phrase = `每天 ${hours.join('、')} 点的第 ${minutes.join('、')} 分钟`
  }

  const monthText = monthField !== '*' ? `${months.join('、')} 月` : ''
  const dayText = dayField !== '*' ? `${days.join('、')} 日` : ''
  const weekdayText = weekdayField !== '*' ? formatWeekdays(weekdays) : ''

  const scopeParts = []
  if (monthText) scopeParts.push(`每年 ${monthText}`)
  if (dayText) scopeParts.push(`${monthText ? '' : '每月 '}${dayText}`)
  if (weekdayText) scopeParts.push(`每${weekdayText}`)
  const scopeText = scopeParts.length ? `${scopeParts.join(' ')} ` : ''

  if (clocks) {
    const clockText = clocks.join('、')
    return scopeText ? `${scopeText}${clockText} 执行` : `每天 ${clockText} 执行`
  }
  return scopeText ? `${scopeText.trim()}，${phrase}执行` : `${phrase}执行`
}

// 把表达式回填到各字段状态（用于“快捷模板”与示例数据）
export function expressionToState(expression) {
  const fields = normalizeFields(expression)
  const state = {}
  FIELD_DEFS.forEach((def, index) => {
    const field = fields[index]
    if (field === '*') {
      state[def.key] = { mode: 'every', values: '', from: '', to: '', step: '' }
      return
    }
    const stepOnly = /^\*\/(\d+)$/.exec(field)
    const rangeStep = /^(\d+)-(\d+)\/(\d+)$/.exec(field)
    const range = /^(\d+)-(\d+)$/.exec(field)
    if (stepOnly) {
      state[def.key] = { mode: 'step', values: '', from: '', to: '', step: stepOnly[1] }
    } else if (rangeStep) {
      state[def.key] = { mode: 'step', values: '', from: rangeStep[1], to: rangeStep[2], step: rangeStep[3] }
    } else if (range) {
      state[def.key] = { mode: 'range', values: '', from: range[1], to: range[2], step: '' }
    } else {
      state[def.key] = { mode: 'value', values: field, from: '', to: '', step: '' }
    }
  })
  return state
}

const DEFAULT_STATE = expressionToState('0 3 * * *')
const SAMPLE_STATE = expressionToState('30 9 * * 1-5')

export default {
  id: 'cron-builder',
  name: 'Cron 表达式构建器',
  description: '可视化构建 cron 表达式并生成人类可读的中文描述',
  category: 'devtool',
  icon: 'cron',
  keywords: ['cron', 'crontab', '定时任务', '表达式'],
  render(container) {
    const output = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      readOnly: true,
      placeholder: 'Cron 表达式…'
    })
    const description = createElement('div', { className: 'inline-result' }, [
      createElement('span', { className: 'result-value' })
    ])
    const errorEl = createElement('div', { className: 'error-text' })

    let aliasValue = ''
    const editors = new Map()

    const currentState = () => {
      const state = {}
      for (const [key, editor] of editors) state[key] = { ...editor.state }
      return state
    }

    function refresh() {
      errorEl.textContent = ''
      try {
        const expression = aliasValue || buildCronExpression(currentState())
        output.value = expression
        description.firstChild.textContent = describeCron(expression)
      } catch (cause) {
        output.value = ''
        description.firstChild.textContent = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    function buildEditor(def) {
      const state = { mode: 'every', values: '', from: '', to: '', step: '' }

      const valueInput = createElement('input', {
        className: 'input',
        type: 'text',
        placeholder: `如 0 或 0,30（${def.hint}）`,
        'aria-label': `${def.label} 取值`
      })
      const fromInput = createElement('input', {
        className: 'input',
        type: 'number',
        placeholder: '起点',
        'aria-label': `${def.label} 区间起点`
      })
      const toInput = createElement('input', {
        className: 'input',
        type: 'number',
        placeholder: '终点',
        'aria-label': `${def.label} 区间终点`
      })
      const stepInput = createElement('input', {
        className: 'input',
        type: 'number',
        placeholder: `如 5（${def.hint}）`,
        'aria-label': `${def.label} 步长`
      })

      const valueGroup = createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: `${def.label} 取值` }),
        valueInput
      ])
      const rangeGroup = createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: `${def.label} 区间（起点 / 终点）` }),
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [fromInput]),
          createElement('div', { className: 'form-group' }, [toInput])
        ])
      ])
      const stepGroup = createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: `${def.label} 步长` }),
        stepInput
      ])

      const modeGroup = createSegmentedGroup(FIELD_MODES, value => {
        state.mode = value
        aliasValue = ''
        aliasSelect.value = ''
        syncMode()
        refresh()
      }, { label: `${def.label} 取值方式` })

      function syncMode() {
        valueGroup.hidden = state.mode !== 'value'
        rangeGroup.hidden = !['range', 'step'].includes(state.mode)
        stepGroup.hidden = state.mode !== 'step'
        rangeGroup.querySelector('.label').textContent = state.mode === 'step'
          ? `${def.label} 区间（可选，留空表示 *）`
          : `${def.label} 区间（起点 / 终点）`
      }

      const onInput = () => {
        state.values = valueInput.value
        state.from = fromInput.value
        state.to = toInput.value
        state.step = stepInput.value
        aliasValue = ''
        aliasSelect.value = ''
        refresh()
      }
      for (const input of [valueInput, fromInput, toInput, stepInput]) {
        input.addEventListener('input', onInput)
      }

      const editor = {
        def,
        state,
        modeGroup,
        element: createElement('div', { className: 'tool-stack' }, [modeGroup, valueGroup, rangeGroup, stepGroup]),
        set(next) {
          Object.assign(state, next)
          valueInput.value = state.values
          fromInput.value = state.from
          toInput.value = state.to
          stepInput.value = state.step
          modeGroup.setValue(state.mode, { notify: false })
          syncMode()
        }
      }
      editor.set(state)
      editors.set(def.key, editor)
      return editor
    }

    const tabGroup = createTabGroup(FIELD_DEFS.map(def => ({
      value: def.key,
      label: def.label,
      content: panel => panel.append(buildEditor(def).element)
    })), () => {}, { label: 'Cron 字段' })

    const aliasSelect = createElement('select', { className: 'select', 'aria-label': '快捷模板' }, [
      createElement('option', { value: '', textContent: '自定义表达式' }),
      ...CRON_ALIASES.map(item => createElement('option', { value: item.alias, textContent: item.label }))
    ])
    aliasSelect.addEventListener('change', () => {
      const alias = aliasSelect.value
      if (!alias) {
        aliasValue = ''
      } else {
        aliasValue = alias
        const state = expressionToState(ALIAS_MAP.get(alias))
        for (const [key, editor] of editors) editor.set(state[key])
      }
      refresh()
    })

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        aliasValue = ''
        aliasSelect.value = ''
        for (const [key, editor] of editors) editor.set(SAMPLE_STATE[key])
        refresh()
      }
    })

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '快捷模板' }),
          aliasSelect
        ])
      ]),
      createElement('div', { className: 'btn-group' }, [sampleBtn]),
      errorEl,
      tabGroup.element,
      createSection('Cron 表达式', output),
      createSection('含义', description)
    )

    for (const [key, editor] of editors) editor.set(DEFAULT_STATE[key])
    refresh()
  }
}
