import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// Line-list operations: every operation is a pure (string[] → string[]) helper
// that the UI dispatches to through applyListOperation.

export const OPERATIONS = [
  { value: 'reverse', label: '反转行序', hint: '把行的顺序倒过来，最后一行变第一行。' },
  { value: 'reverse-each', label: '反转每行字符', hint: '逐行倒序字符，行的顺序保持不变。' },
  { value: 'shuffle', label: '打乱顺序', hint: '随机重排所有行；提供种子时结果可复现。' },
  { value: 'sort', label: '排序', hint: '按 Unicode 顺序排序，纯数字串按数值大小排序。' },
  { value: 'remove-empty', label: '去空行', hint: '删除只包含空白字符的行。' },
  { value: 'unique', label: '去重', hint: '保留首次出现的行，删除后续重复行。' },
  { value: 'rotate', label: '轮转', hint: '按 N 行循环移动，N 为负数时反向轮转。' },
  { value: 'group', label: '分组', hint: '每 N 行合并为一行，合并符默认为空格。' },
  { value: 'join', label: '合并', hint: '把所有行合并为一行，可自定义连接符（如 、 或 | ）。' },
  { value: 'number', label: '编号', hint: '为每行加序号，格式中 {n} 为序号，{total} 为总行数。' },
  { value: 'wrap', label: '包装', hint: '为每行统一添加前缀和 / 或后缀。' },
  { value: 'indent', label: '缩进', hint: '为每行统一添加缩进字符串。' },
  { value: 'truncate', label: '截断', hint: '把每行截断到 N 个字符，按 Unicode 码点计数，单个 emoji 不会被切成半个。' }
]

export function reverseLines(lines) {
  return [...lines].reverse()
}

export function reverseEachLine(lines) {
  return lines.map(line => [...line].reverse().join(''))
}

// Small deterministic PRNG (mulberry32) — the shuffle is reproducible in tests
// and when the user reuses the same seed, while staying unbiased enough here.
export function createSeededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x9E3779B9
  return function random() {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleLines(lines, seed) {
  const hasSeed = seed !== undefined && seed !== null && seed !== ''
  const random = hasSeed ? createSeededRandom(seed) : Math.random
  const out = [...lines]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = out[i]
    out[i] = out[j]
    out[j] = swap
  }
  return out
}

const defaultCollator = new Intl.Collator('zh-Hans-CN', { numeric: true })

export function sortLines(lines, options = {}) {
  const collator = options.numeric === false
    ? new Intl.Collator('zh-Hans-CN')
    : defaultCollator
  const sorted = [...lines].sort((a, b) => collator.compare(a, b))
  return options.descending ? sorted.reverse() : sorted
}

export function removeEmptyLines(lines) {
  return lines.filter(line => line.trim() !== '')
}

export function uniqueLines(lines, options = {}) {
  const caseSensitive = options.caseSensitive !== false
  const seen = new Set()
  const out = []
  for (const line of lines) {
    const key = caseSensitive ? line : line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
  }
  return out
}

export function rotateLines(lines, offset) {
  const length = lines.length
  if (!length) return []
  const shift = ((Math.trunc(Number(offset) || 0) % length) + length) % length
  return [...lines.slice(shift), ...lines.slice(0, shift)]
}

export function groupLines(lines, size, options = {}) {
  const step = Math.max(1, Math.trunc(Number(size) || 1))
  const separator = options.separator ?? ' '
  const out = []
  for (let index = 0; index < lines.length; index += step) {
    out.push(lines.slice(index, index + step).join(separator))
  }
  return out
}

export function joinLines(lines, separator = '') {
  return lines.join(separator)
}

function applyNumberFormat(format, index, position, total) {
  return format
    .replace(/\{n\}/g, String(index))
    .replace(/\{i\}/g, String(position))
    .replace(/\{total\}/g, String(total))
}

export function numberLines(lines, options = {}) {
  const format = options.format ?? '{n}. '
  const start = Number.isFinite(Number(options.start)) ? Number(options.start) : 1
  const total = lines.length
  return lines.map((line, position) => `${applyNumberFormat(format, position + start, position + 1, total)}${line}`)
}

export function wrapLines(lines, options = {}) {
  const prefix = options.prefix ?? ''
  const suffix = options.suffix ?? ''
  if (!prefix && !suffix) return [...lines]
  return lines.map(line => `${prefix}${line}${suffix}`)
}

export function indentLines(lines, options = {}) {
  const indent = options.indent ?? '  '
  if (!indent) return [...lines]
  return lines.map(line => `${indent}${line}`)
}

export function truncateLines(lines, length, options = {}) {
  const max = Math.max(1, Math.trunc(Number(length) || 1))
  const ellipsis = options.ellipsis ?? ''
  return lines.map(line => {
    const chars = [...line]
    return chars.length <= max ? line : chars.slice(0, max).join('') + ellipsis
  })
}

/**
 * Dispatch a list operation. Always returns an array of lines — the 合并
 * operation collapses everything into a single-element array.
 */
export function applyListOperation(lines, operation, options = {}) {
  const input = Array.isArray(lines) ? lines : []
  switch (operation) {
    case 'reverse': return reverseLines(input)
    case 'reverse-each': return reverseEachLine(input)
    case 'shuffle': return shuffleLines(input, options.seed)
    case 'sort': return sortLines(input, options)
    case 'remove-empty': return removeEmptyLines(input)
    case 'unique': return uniqueLines(input, options)
    case 'rotate': return rotateLines(input, options.count)
    case 'group': return groupLines(input, options.count, options)
    case 'join': return [joinLines(input, options.separator ?? '')]
    case 'number': return numberLines(input, options)
    case 'wrap': return wrapLines(input, options)
    case 'indent': return indentLines(input, options)
    case 'truncate': return truncateLines(input, options.count, options)
    default: return [...input]
  }
}

const SAMPLE_TEXT = ['banana', 'apple', 'cherry', '', 'apple', 'Banana', 'date', 'elderberry', 'fig'].join('\n')

function numberInput(label, value) {
  return createElement('input', {
    className: 'input',
    type: 'number',
    value: String(value),
    min: '1',
    'aria-label': label
  })
}

function textInput(label, value) {
  return createElement('input', { className: 'input', type: 'text', value, 'aria-label': label })
}

export default {
  id: 'list-tools',
  name: '列表工具',
  description: '对文本行进行反转、打乱、分组、轮转、编号与包装',
  category: 'text',
  icon: 'text-sort',
  keywords: ['列表', '行操作', 'shuffle', 'rotate', '编号', '分组', '打乱'],
  render(container) {
    const operation = createElement('select', { className: 'select', 'aria-label': '操作' })
    for (const item of OPERATIONS) {
      operation.appendChild(createElement('option', { value: item.value, textContent: item.label }))
    }

    const rotateCount = numberInput('轮转位数', 1)
    const groupSize = numberInput('每组行数', 3)
    const truncateLength = numberInput('截断字符数', 40)
    const joinSeparator = textInput('合并连接符', '、')
    const numberFormat = textInput('编号格式', '{n}. ')
    const wrapPrefix = textInput('行前缀', '- ')
    const wrapSuffix = textInput('行后缀', '')
    const indentText = textInput('缩进字符串', '  ')

    const fields = [
      { node: rotateCount, ops: ['rotate'], label: '轮转位数 N' },
      { node: groupSize, ops: ['group'], label: '每组行数 N' },
      { node: truncateLength, ops: ['truncate'], label: '截断字符数 N' },
      { node: joinSeparator, ops: ['join'], label: '合并连接符' },
      { node: numberFormat, ops: ['number'], label: '编号格式' },
      { node: wrapPrefix, ops: ['wrap'], label: '行前缀' },
      { node: wrapSuffix, ops: ['wrap'], label: '行后缀' },
      { node: indentText, ops: ['indent'], label: '缩进字符串' }
    ]

    const fieldNodes = fields.map(field => createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: field.label }),
      field.node
    ]))

    const hint = createElement('div', { className: 'form-hint' })

    function currentOperation() {
      return operation.value
    }

    function syncOptions() {
      const active = currentOperation()
      fields.forEach((field, index) => {
        fieldNodes[index].hidden = !field.ops.includes(active)
      })
      hint.textContent = OPERATIONS.find(item => item.value === active)?.hint ?? ''
    }

    const state = renderTextTransform(container, {
      inputTitle: '原始文本',
      outputTitle: '处理结果',
      inputPlaceholder: '每行一条数据，例如：\n苹果\n香蕉\n橙子',
      outputPlaceholder: '处理结果将显示在此…',
      actionLabel: '执行操作',
      sample: SAMPLE_TEXT,
      rows: 12,
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', textContent: '操作' }),
            operation
          ])
        ]),
        createElement('div', { className: 'form-row' }, fieldNodes),
        hint
      ],
      transform(text) {
        if (!text) return ''
        const options = {
          count: activeCount(),
          separator: joinSeparator.value,
          format: numberFormat.value,
          prefix: wrapPrefix.value,
          suffix: wrapSuffix.value,
          indent: indentText.value
        }
        return applyListOperation(text.split(/\r\n|\r|\n/), currentOperation(), options).join('\n')
      }
    })

    function activeCount() {
      const active = currentOperation()
      if (active === 'rotate') return rotateCount.value
      if (active === 'group') return groupSize.value
      if (active === 'truncate') return truncateLength.value
      return 0
    }

    operation.addEventListener('change', () => {
      syncOptions()
      state.run()
    })
    for (const field of fields) field.node.addEventListener('input', state.run)

    syncOptions()
  }
}
