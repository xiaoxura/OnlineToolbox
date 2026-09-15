import { createElement, createSection, createTableScroll } from '../../utils/dom.js'

// Descriptive statistics. computeStatistics() is a pure function over a number
// array so every indicator can be unit-tested without a DOM.

// Accepts commas, semicolons, Chinese punctuation, pipes and whitespace.
const SEPARATOR = /[\s,;，、；|]+/

export function parseNumbers(text) {
  const tokens = String(text ?? '').split(SEPARATOR).filter(Boolean)
  const numbers = []
  let skipped = 0
  for (const token of tokens) {
    const value = Number(token)
    if (Number.isFinite(value)) numbers.push(value)
    else skipped++
  }
  return { numbers, skipped }
}

// Linear interpolation between order statistics (R-7 / numpy / Excel
// QUARTILE.INC), so Q1/Q2/Q3 stay consistent with the median.
export function quantile(sortedValues, p) {
  const count = sortedValues.length
  if (!count) return NaN
  if (count === 1) return sortedValues[0]
  const position = (count - 1) * p
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sortedValues[lower]
  const weight = position - lower
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

export function computeModes(sortedValues) {
  const counts = new Map()
  for (const value of sortedValues) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best = 0
  for (const count of counts.values()) best = Math.max(best, count)
  if (best <= 1) return []
  return [...counts.entries()]
    .filter(([, count]) => count === best)
    .map(([value]) => value)
    .sort((a, b) => a - b)
}

export function iqrOutliers(sortedValues, q1, q3) {
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr
  return {
    iqr,
    lowerFence,
    upperFence,
    outliers: sortedValues.filter(value => value < lowerFence || value > upperFence)
  }
}

export function computeStatistics(numbers) {
  const values = (Array.isArray(numbers) ? numbers : []).map(Number).filter(Number.isFinite)
  const count = values.length
  if (!count) throw new Error('没有可统计的数值，请至少输入一个数字')

  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((total, value) => total + value, 0)
  const mean = sum / count
  const min = sorted[0]
  const max = sorted[count - 1]
  const q1 = quantile(sorted, 0.25)
  const q2 = quantile(sorted, 0.5)
  const q3 = quantile(sorted, 0.75)
  const { iqr, lowerFence, upperFence, outliers } = iqrOutliers(sorted, q1, q3)

  const squaredDeviations = values.reduce((total, value) => total + (value - mean) ** 2, 0)
  const variancePopulation = squaredDeviations / count
  const variance = count > 1 ? squaredDeviations / (count - 1) : NaN
  const stdDev = Math.sqrt(variance)
  const stdDevPopulation = Math.sqrt(variancePopulation)

  const thirdMoment = values.reduce((total, value) => total + (value - mean) ** 3, 0) / count
  const skewness = count > 2 && stdDev > 0
    ? (Math.sqrt(count * (count - 1)) / (count - 2)) * (thirdMoment / stdDev ** 3)
    : NaN

  const hasNonPositive = values.some(value => value <= 0)
  const geometricMean = hasNonPositive ? NaN : Math.exp(values.reduce((total, value) => total + Math.log(value), 0) / count)
  const harmonicMean = hasNonPositive ? NaN : count / values.reduce((total, value) => total + 1 / value, 0)

  return {
    count,
    sum,
    min,
    max,
    range: max - min,
    mean,
    median: q2,
    mode: computeModes(sorted),
    variance,
    variancePopulation,
    stdDev,
    stdDevPopulation,
    q1,
    q2,
    q3,
    iqr,
    lowerFence,
    upperFence,
    outliers,
    skewness,
    geometricMean,
    harmonicMean,
    sorted
  }
}

export function formatStatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value === Infinity) return '∞'
  if (value === -Infinity) return '-∞'
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toPrecision(12)))
}

const SAMPLE_TEXT = '12, 15, 14, 10, 9, 15, 18, 22, 15, 3\n120\nN/A'

function statCard(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('div', { className: 'stat-value', textContent: String(value) }),
    createElement('div', { className: 'stat-label', textContent: label })
  ])
}

function buildGroups(stats) {
  const modes = stats.mode.length ? stats.mode.map(formatStatNumber).join('、') : '无（没有重复值）'
  return [
    ['集中趋势', [
      ['算术平均值', formatStatNumber(stats.mean)],
      ['中位数 (Q2)', formatStatNumber(stats.median)],
      ['众数', modes],
      ['几何平均数', formatStatNumber(stats.geometricMean)],
      ['调和平均数', formatStatNumber(stats.harmonicMean)]
    ]],
    ['离散程度', [
      ['样本方差（除以 n−1）', formatStatNumber(stats.variance)],
      ['总体方差（除以 n）', formatStatNumber(stats.variancePopulation)],
      ['样本标准差', formatStatNumber(stats.stdDev)],
      ['总体标准差', formatStatNumber(stats.stdDevPopulation)],
      ['极差（最大值 − 最小值）', formatStatNumber(stats.range)],
      ['偏度（样本）', formatStatNumber(stats.skewness)]
    ]],
    ['分布', [
      ['最小值', formatStatNumber(stats.min)],
      ['最大值', formatStatNumber(stats.max)],
      ['下四分位数 Q1', formatStatNumber(stats.q1)],
      ['上四分位数 Q3', formatStatNumber(stats.q3)],
      ['四分位距 IQR', formatStatNumber(stats.iqr)],
      ['离群值（1.5×IQR）', stats.outliers.length ? stats.outliers.map(formatStatNumber).join('、') : '无']
    ]]
  ]
}

export default {
  id: 'statistics',
  name: '统计计算器',
  description: '计算均值、中位数、众数、方差、标准差、分位数与离群值',
  category: 'math',
  icon: 'calculator',
  keywords: ['统计', '均值', '方差', '标准差', '中位数', '众数', '分位数', '离群值', 'statistics'],
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      placeholder: '输入数字，用逗号、空格或换行分隔：\n12, 15, 14, 10, 9, 15'
    })
    const error = createElement('div', { className: 'error-text' })
    const statsEl = createElement('div', { className: 'stats-row' })
    const tableHost = createElement('div')
    const hint = createElement('div', { className: 'form-hint' })

    function renderStats(stats, skipped) {
      statsEl.replaceChildren(
        statCard('数量', stats.count),
        statCard('总和', formatStatNumber(stats.sum)),
        statCard('最小值', formatStatNumber(stats.min)),
        statCard('最大值', formatStatNumber(stats.max)),
        statCard('极差', formatStatNumber(stats.range)),
        statCard('已跳过非数字项', skipped)
      )

      const groups = buildGroups(stats)
      const table = createElement('table', { className: 'result-table' })
      const body = createElement('tbody')
      for (const [title, rows] of groups) {
        body.appendChild(createElement('tr', {}, [
          createElement('th', { scope: 'colgroup', colSpan: '2', textContent: title })
        ]))
        for (const [name, value] of rows) {
          body.appendChild(createElement('tr', {}, [
            createElement('th', { scope: 'row', textContent: name }),
            createElement('td', { className: 'code-text', textContent: value })
          ]))
        }
      }
      table.append(
        createElement('thead', {}, [
          createElement('tr', {}, [
            createElement('th', { textContent: '指标' }),
            createElement('th', { textContent: '值' })
          ])
        ]),
        body
      )
      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, '统计指标表，可横向滚动')
      tableHost.replaceChildren(host)

      const notes = [
        '分位数采用线性插值法（与 numpy、Excel QUARTILE.INC 一致）。',
        `离群值按 1.5×IQR 规则判定：低于 Q1 − 1.5×IQR（${formatStatNumber(stats.lowerFence)}）或高于 Q3 + 1.5×IQR（${formatStatNumber(stats.upperFence)}）的数值。`
      ]
      if (stats.outliers.length) notes.push(`共发现 ${stats.outliers.length} 个离群值：${stats.outliers.map(formatStatNumber).join('、')}。`)
      else notes.push('未发现离群值。')
      if (stats.count < 2) notes.push('样本方差需要至少 2 个数值，当前无法计算。')
      if (stats.count > 1 && Number.isNaN(stats.geometricMean)) notes.push('几何平均数与调和平均数要求所有数值为正数，当前包含 0 或负数。')
      if (skipped) notes.push(`已忽略 ${skipped} 个无法解析为数字的内容。`)
      hint.textContent = notes.join(' ')
    }

    function run() {
      error.textContent = ''
      statsEl.replaceChildren()
      tableHost.replaceChildren()
      hint.textContent = ''
      if (!input.value.trim()) return

      const { numbers, skipped } = parseNumbers(input.value)
      if (!numbers.length) {
        error.textContent = '未找到有效数字，请用逗号、空格或换行分隔数值。'
        return
      }
      try {
        renderStats(computeStatistics(numbers), skipped)
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    input.addEventListener('input', run)

    container.append(
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '计算统计量',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            input.value = SAMPLE_TEXT
            run()
          }
        })
      ]),
      error,
      createElement('div', { className: 'form-hint', textContent: '支持逗号、分号、空格、制表符与换行分隔；无法解析的内容会被自动忽略并计数。' }),
      createSection('数据输入', input),
      createSection('统计结果', createElement('div', { className: 'tool-stack' }, [statsEl, hint, tableHost]))
    )
  }
}
