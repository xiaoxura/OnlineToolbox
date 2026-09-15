import { createElement, createSegmentedGroup, createTabGroup } from '../../utils/dom.js'

// Percentage arithmetic. Every function validates its inputs and throws a
// Chinese message on bad or undefined results so the UI can surface the reason
// instead of rendering NaN.

function ensureNumber(value, label) {
  if (value === '' || value === null || value === undefined) {
    throw new Error(`请输入${label}`)
  }
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`${label}必须是有效数字`)
  return number
}

function ensureNonZero(value, label) {
  const number = ensureNumber(value, label)
  if (number === 0) throw new Error(`${label}不能为 0，除数不能为零`)
  return number
}

export function formatNumber(value, decimals = 4) {
  if (!Number.isFinite(value)) return '—'
  const rounded = Number(value.toFixed(decimals))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

// X 的 Y% 是多少
export function percentOf(value, percent) {
  return ensureNumber(value, '数值 X') * ensureNumber(percent, '百分比 Y') / 100
}

// A 是 B 的百分之几
export function whatPercent(a, b) {
  return ensureNumber(a, '数值 A') / ensureNonZero(b, '数值 B') * 100
}

// 从 A 到 B 的变化幅度（正数为增长，负数为下降）
export function percentChange(from, to) {
  const base = ensureNonZero(from, '起始值 A')
  return (ensureNumber(to, '结束值 B') - base) / base * 100
}

// 在 X 的基础上增加 Y%
export function addPercent(value, percent) {
  return ensureNumber(value, '数值 X') * (1 + ensureNumber(percent, '百分比 Y') / 100)
}

// 在 X 的基础上减少 Y%
export function subtractPercent(value, percent) {
  return ensureNumber(value, '数值 X') * (1 - ensureNumber(percent, '百分比 Y') / 100)
}

// 原价 price 减去 percent% 之后的实付价格
export function discount(price, percent) {
  return ensureNumber(price, '原价') * (1 - ensureNumber(percent, '折扣百分比') / 100)
}

// A 在 A + B 总量中的占比
export function ratioToPercent(a, b) {
  const left = ensureNumber(a, '数值 A')
  const right = ensureNumber(b, '数值 B')
  const total = left + right
  if (total === 0) throw new Error('A 与 B 之和为 0，无法计算占比')
  return left / total * 100
}

// 从 A% 到 B% 的百分点变化（百分点 = 两个百分数的直接差值）
export function percentagePoints(a, b) {
  return ensureNumber(b, '百分比 B') - ensureNumber(a, '百分比 A')
}

// --- UI --------------------------------------------------------------------

// Builds one "question" panel: labeled number inputs, a live inline result and
// the formula that produced it.
function createQuestion({ fields, header, formula, compute }) {
  const inputs = new Map()
  const errorEl = createElement('div', { className: 'error-text' })
  const resultRow = createElement('div', { className: 'inline-result' })
  const detailEl = createElement('div', { className: 'form-hint' })

  let panel = null

  function readValues() {
    const values = {}
    for (const [key, input] of inputs) values[key] = input.value
    return values
  }

  function run() {
    const values = readValues()
    if ([...inputs.values()].some(input => input.value === '')) {
      errorEl.textContent = ''
      resultRow.replaceChildren(createElement('span', { className: 'result-value', textContent: '请输入全部数值' }))
      detailEl.textContent = `公式：${formula}`
      return
    }
    try {
      const outcome = compute(values)
      errorEl.textContent = ''
      resultRow.replaceChildren(createElement('span', {
        className: 'result-value',
        textContent: outcome.value
      }))
      detailEl.textContent = outcome.detail ? `${outcome.detail}　|　公式：${formula}` : `公式：${formula}`
    } catch (cause) {
      resultRow.replaceChildren()
      detailEl.textContent = ''
      errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
    }
  }

  function fill(target) {
    panel = target
    target.classList.add('tool-stack')

    const groups = fields.map(field => {
      const input = createElement('input', {
        className: 'input',
        type: 'number',
        step: 'any',
        value: field.default ?? '',
        placeholder: field.placeholder || '',
        'aria-label': field.label
      })
      inputs.set(field.key, input)
      input.addEventListener('input', run)
      return createElement('div', { className: 'form-group' }, [
        createElement('div', { className: 'label', textContent: field.label }),
        input
      ])
    })

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        for (const field of fields) inputs.get(field.key).value = String(field.sample)
        run()
      }
    })

    const headerNodes = header ? header() : []
    target.append(
      ...headerNodes,
      createElement('div', { className: 'form-row' }, groups),
      resultRow,
      detailEl,
      errorEl,
      createElement('div', { className: 'btn-group' }, [sampleBtn])
    )
    run()
  }

  return { fill, run, get panel() { return panel } }
}

function buildQuestionTabs() {
  let changeMode

  const addSubtract = createQuestion({
    header: () => [
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '运算方式' }),
          changeMode
        ])
      ])
    ],
    fields: [
      { key: 'value', label: '原始数值 X', placeholder: '例如：200', sample: 200 },
      { key: 'percent', label: '百分比 Y（%）', placeholder: '例如：10', sample: 10 }
    ],
    formula: '加：X × (1 + Y ÷ 100)　减：X × (1 − Y ÷ 100)',
    compute: values => {
      const adding = changeMode.getValue() === 'add'
      const result = adding
        ? addPercent(values.value, values.percent)
        : subtractPercent(values.value, values.percent)
      const delta = Math.abs(Number(values.value) * Number(values.percent) / 100)
      return {
        value: formatNumber(result),
        detail: `${adding ? '增加' : '减少'}了 ${formatNumber(delta)}`
      }
    }
  })

  changeMode = createSegmentedGroup([
    { value: 'add', label: '加上百分之几' },
    { value: 'subtract', label: '减去百分之几' }
  ], () => addSubtract.run(), { label: '运算方式' })

  return [
    {
      label: 'X 的 Y% 是多少',
      question: createQuestion({
        fields: [
          { key: 'value', label: '数值 X', placeholder: '例如：200', sample: 200 },
          { key: 'percent', label: '百分比 Y（%）', placeholder: '例如：15', sample: 15 }
        ],
        formula: 'X × Y ÷ 100',
        compute: values => ({ value: formatNumber(percentOf(values.value, values.percent)) })
      })
    },
    {
      label: 'A 是 B 的百分之几',
      question: createQuestion({
        fields: [
          { key: 'a', label: '数值 A', placeholder: '例如：30', sample: 30 },
          { key: 'b', label: '数值 B', placeholder: '例如：200', sample: 200 }
        ],
        formula: 'A ÷ B × 100%',
        compute: values => ({ value: `${formatNumber(whatPercent(values.a, values.b))}%` })
      })
    },
    {
      label: '从 A 到 B 的变化幅度',
      question: createQuestion({
        fields: [
          { key: 'from', label: '起始值 A', placeholder: '例如：100', sample: 100 },
          { key: 'to', label: '结束值 B', placeholder: '例如：125', sample: 125 }
        ],
        formula: '(B − A) ÷ A × 100%',
        compute: values => {
          const change = percentChange(values.from, values.to)
          return {
            value: `${formatNumber(change)}%`,
            detail: `${change >= 0 ? '增长' : '下降'} ${formatNumber(Math.abs(change))}%（差值 ${formatNumber(Number(values.to) - Number(values.from))}）`
          }
        }
      })
    },
    { label: '加上/减去百分之几', question: addSubtract },
    {
      label: '折扣后价格',
      question: createQuestion({
        fields: [
          { key: 'price', label: '原价', placeholder: '例如：299', sample: 299 },
          { key: 'percent', label: '折扣百分比（%）', placeholder: '例如：20', sample: 20 }
        ],
        formula: '原价 × (1 − 折扣% ÷ 100)',
        compute: values => {
          const final = discount(values.price, values.percent)
          const percent = Number(values.percent)
          const saved = Number(values.price) - final
          return {
            value: formatNumber(final),
            detail: percent <= 100
              ? `节省 ${formatNumber(saved)}，相当于 ${formatNumber(10 - percent / 10)} 折`
              : `节省 ${formatNumber(saved)}（折扣超过 100%，实付为负数）`
          }
        }
      })
    },
    {
      label: 'A 的占比',
      question: createQuestion({
        fields: [
          { key: 'a', label: '部分量 A', placeholder: '例如：30', sample: 30 },
          { key: 'b', label: '其余量 B', placeholder: '例如：70', sample: 70 }
        ],
        formula: 'A ÷ (A + B) × 100%',
        compute: values => ({
          value: `${formatNumber(ratioToPercent(values.a, values.b))}%`,
          detail: `总量 ${formatNumber(Number(values.a) + Number(values.b))}`
        })
      })
    },
    {
      label: '百分比 vs 百分点',
      question: createQuestion({
        fields: [
          { key: 'a', label: '起始百分比 A（%）', placeholder: '例如：20', sample: 20 },
          { key: 'b', label: '结束百分比 B（%）', placeholder: '例如：25', sample: 25 }
        ],
        formula: 'B − A（百分点）',
        compute: values => {
          const points = percentagePoints(values.a, values.b)
          const relative = Number(values.a) === 0 ? null : points / Number(values.a) * 100
          return {
            value: `${formatNumber(points)} 个百分点`,
            detail: relative === null
              ? '起点为 0%，无法计算相对变化幅度'
              : `相对变化 ${formatNumber(relative)}%`
          }
        }
      })
    }
  ]
}

export default {
  id: 'percentage',
  name: '百分比计算器',
  description: '计算百分比、增减幅度、占比与折扣',
  category: 'math',
  icon: 'calculator',
  keywords: ['百分比', '百分数', '折扣', '占比', '百分点', 'percent'],
  render(container) {
    const tabs = createTabGroup(
      buildQuestionTabs().map(tab => ({ label: tab.label, content: tab.question.fill })),
      () => {},
      { label: '百分比问题类型' }
    )
    container.appendChild(tabs.element)
  }
}
