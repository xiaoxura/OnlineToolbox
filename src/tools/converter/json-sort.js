import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// Sorting keys makes two structurally equal documents diff cleanly and gives
// stable output for hashing or snapshot tests. Array order is meaningful data,
// so it is only reordered when the user explicitly asks for it.

function compareText(left, right, caseSensitive) {
  const a = caseSensitive ? left : left.toLowerCase()
  const b = caseSensitive ? right : right.toLowerCase()
  if (a < b) return -1
  if (a > b) return 1
  // Case-insensitive ties fall back to the raw spelling so the order is stable.
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareKeys(left, right, settings) {
  const result = compareText(left, right, settings.caseSensitive)
  return settings.order === 'desc' ? -result : result
}

function compareValues(left, right, settings) {
  let result
  if (typeof left === 'number' && typeof right === 'number') result = left - right
  else if (typeof left === 'string' && typeof right === 'string') result = compareText(left, right, settings.caseSensitive)
  else {
    const a = JSON.stringify(left) ?? 'null'
    const b = JSON.stringify(right) ?? 'null'
    result = a < b ? -1 : a > b ? 1 : 0
  }
  return settings.order === 'desc' ? -result : result
}

export function sortJsonKeys(value, options = {}) {
  const settings = {
    recursive: options.recursive !== false,
    sortArrays: Boolean(options.sortArrays),
    order: options.order === 'desc' ? 'desc' : 'asc',
    caseSensitive: options.caseSensitive !== false
  }

  const walk = node => {
    if (Array.isArray(node)) {
      const items = node.map(item => (settings.recursive ? walk(item) : item))
      if (!settings.sortArrays) return items
      return [...items].sort((left, right) => compareValues(left, right, settings))
    }
    if (node === null || typeof node !== 'object') return node
    // Object.fromEntries defines own properties, so a "__proto__" key stays a
    // key instead of reaching the prototype setter.
    return Object.fromEntries(
      Object.keys(node)
        .sort((left, right) => compareKeys(left, right, settings))
        .map(key => [key, settings.recursive ? walk(node[key]) : node[key]])
    )
  }

  return walk(value)
}

const SAMPLE = {
  zebra: 1,
  apple: { beta: 2, Alpha: 3, gamma: [3, 1, 2] },
  Mango: 'fruit',
  banana: 'fruit',
  list: [{ z: 1, a: 2 }, { z: 3, a: 4 }]
}

export default {
  id: 'json-sort',
  name: 'JSON 键排序',
  description: '递归排序 JSON 对象键名，可选保留数组顺序',
  category: 'converter',
  icon: 'json',
  keywords: ['sort', '排序', '键排序', 'key order', '规范化', 'diff'],
  render(container) {
    const recursiveCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    recursiveCheckbox.checked = true
    const sortArraysCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    const caseSensitiveCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    caseSensitiveCheckbox.checked = true
    const orderSelect = createElement('select', { className: 'select' }, [
      createElement('option', { value: 'asc', textContent: '升序（A → Z）' }),
      createElement('option', { value: 'desc', textContent: '降序（Z → A）' })
    ])

    renderTextTransform(container, {
      inputTitle: '输入 JSON',
      outputTitle: '排序结果',
      inputPlaceholder: '粘贴 JSON 数据…',
      outputPlaceholder: '排序后的 JSON 将显示在此…',
      actionLabel: '排序',
      sample: () => JSON.stringify(SAMPLE, null, 2),
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', textContent: '排序方向' }),
            orderSelect
          ]),
          createElement('div', { className: 'form-group option-control-group' }, [
            createElement('label', { className: 'option-item' }, [recursiveCheckbox, createElement('span', { textContent: '递归排序嵌套对象' })])
          ]),
          createElement('div', { className: 'form-group option-control-group' }, [
            createElement('label', { className: 'option-item' }, [sortArraysCheckbox, createElement('span', { textContent: '数组也排序' })])
          ]),
          createElement('div', { className: 'form-group option-control-group' }, [
            createElement('label', { className: 'option-item' }, [caseSensitiveCheckbox, createElement('span', { textContent: '区分大小写' })])
          ])
        ])
      ],
      transform: text => JSON.stringify(sortJsonKeys(JSON.parse(text), {
        recursive: recursiveCheckbox.checked,
        sortArrays: sortArraysCheckbox.checked,
        order: orderSelect.value,
        caseSensitive: caseSensitiveCheckbox.checked
      }), null, 2)
    })
  }
}
