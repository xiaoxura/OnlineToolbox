import { createElement, createSegmentedGroup } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// Flatten turns a nested document into "path → leaf" pairs; unflatten rebuilds
// it. Paths use a configurable delimiter (dot by default) and arrays are either
// expanded into numeric segments ("a.0") or kept whole as a leaf value.

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// A plain `result[key] = value` would run the "__proto__" setter and lose the
// entry, so every write goes through defineProperty.
function setKey(target, key, value) {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true })
}

export function flattenJson(value, { delimiter = '.', arrays = 'index' } = {}) {
  const result = {}
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      // An empty array has no indices to expand, so it stays a leaf value —
      // that is what keeps the round trip lossless.
      if (arrays === 'keep' || node.length === 0) {
        setKey(result, path, node)
        return
      }
      node.forEach((item, index) => walk(item, path === '' ? String(index) : `${path}${delimiter}${index}`))
      return
    }
    if (node !== null && typeof node === 'object') {
      const keys = Object.keys(node)
      if (!keys.length) {
        setKey(result, path, {})
        return
      }
      for (const key of keys) walk(node[key], path === '' ? key : `${path}${delimiter}${key}`)
      return
    }
    setKey(result, path, node)
  }
  walk(value, '')
  return result
}

function isIndexList(keys) {
  if (!keys.length) return false
  if (!keys.every(key => /^\d+$/.test(key))) return false
  return Math.max(...keys.map(Number)) === keys.length - 1
}

function convertIndexObjects(node) {
  if (Array.isArray(node)) return node.map(convertIndexObjects)
  if (node === null || typeof node !== 'object') return node
  const keys = Object.keys(node)
  if (isIndexList(keys)) {
    const list = []
    for (const key of keys) list[Number(key)] = convertIndexObjects(node[key])
    return list
  }
  const result = {}
  for (const key of keys) setKey(result, key, convertIndexObjects(node[key]))
  return result
}

export function unflattenJson(flat, { delimiter = '.' } = {}) {
  if (flat === null || typeof flat !== 'object' || Array.isArray(flat)) return flat
  const entries = Object.entries(flat)
  if (entries.length === 1 && entries[0][0] === '') return entries[0][1]
  const root = {}
  for (const [rawKey, value] of entries) {
    const parts = String(rawKey).split(delimiter)
    // Prototype pollution guard: a "__proto__" / "constructor" segment would
    // otherwise walk up the prototype chain and mutate Object.prototype.
    if (parts.some(part => DANGEROUS_KEYS.has(part))) continue
    let node = root
    for (let index = 0; index < parts.length - 1; index++) {
      const part = parts[index]
      const next = parts[index + 1]
      const current = node[part]
      if (current === undefined || current === null || typeof current !== 'object') {
        setKey(node, part, /^\d+$/.test(next) ? [] : {})
      }
      node = node[part]
    }
    setKey(node, parts[parts.length - 1], value)
  }
  return convertIndexObjects(root)
}

const SAMPLE_NESTED = {
  order: 'A-1001',
  customer: { id: 7, name: '张三', vip: true, address: { city: '北京', zip: '100080' } },
  items: [
    { sku: 'X1', price: 12.5, tags: ['hot', 'sale'] },
    { sku: 'X2', price: 7, tags: [] }
  ],
  remark: null
}

const SAMPLE_FLAT = {
  'order': 'A-1001',
  'customer.id': 7,
  'customer.name': '张三',
  'customer.vip': true,
  'customer.address.city': '北京',
  'customer.address.zip': '100080',
  'items.0.sku': 'X1',
  'items.0.price': 12.5,
  'items.0.tags.0': 'hot',
  'items.0.tags.1': 'sale',
  'items.1.sku': 'X2',
  'items.1.price': 7,
  'items.1.tags': [],
  'remark': null
}

export default {
  id: 'json-flatten',
  name: 'JSON 扁平化',
  description: '在嵌套 JSON 与点号路径的扁平结构之间双向转换',
  category: 'converter',
  icon: 'json',
  keywords: ['flatten', 'unflatten', '扁平化', '路径', 'dot notation', '展开'],
  render(container) {
    let state
    const mode = createSegmentedGroup([
      { value: 'flatten', label: '扁平化' },
      { value: 'unflatten', label: '还原' }
    ], () => state.run(), { label: '转换方向' })

    const delimiterInput = createElement('input', {
      className: 'input',
      value: '.',
      placeholder: '例如 .'
    })
    const arraysCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    arraysCheckbox.checked = true
    const arraysOption = createElement('label', { className: 'option-item' }, [
      arraysCheckbox,
      createElement('span', { textContent: '数组按下标展开' })
    ])

    const isFlatten = () => mode.getValue() === 'flatten'

    state = renderTextTransform(container, {
      inputTitle: '输入 JSON',
      outputTitle: '输出 JSON',
      inputPlaceholder: '粘贴 JSON 数据…',
      outputPlaceholder: '转换结果将显示在此…',
      actionLabel: '转换',
      sample: () => JSON.stringify(isFlatten() ? SAMPLE_NESTED : SAMPLE_FLAT, null, 2),
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: '转换方向' }),
            mode
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', textContent: '路径分隔符' }),
            delimiterInput
          ]),
          createElement('div', { className: 'form-group option-control-group' }, [arraysOption])
        ])
      ],
      transform: text => {
        const parsed = JSON.parse(text)
        const delimiter = delimiterInput.value || '.'
        const converted = isFlatten()
          ? flattenJson(parsed, { delimiter, arrays: arraysCheckbox.checked ? 'index' : 'keep' })
          : unflattenJson(parsed, { delimiter })
        return JSON.stringify(converted, null, 2)
      }
    })
  }
}
