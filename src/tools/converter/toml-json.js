import { parse as parseDocument, stringify as stringifyDocument } from 'smol-toml'
import { createSegmentedGroup } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

const createMap = () => Object.create(null)

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

// smol-toml currently stores TOML dates and times in Date-compatible values,
// whose precision is limited to milliseconds. Mask strings and comments before
// checking bare TOML date/time tokens so higher precision is rejected instead
// of being silently truncated by Date.
function maskTomlStringsAndComments(source) {
  const masked = [...source]
  let quote = null
  let triple = false
  let escaped = false
  const isEscaped = index => {
    let slashes = 0
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor--) slashes++
    return slashes % 2 === 1
  }
  const blank = index => { if (source[index] !== '\n' && source[index] !== '\r') masked[index] = ' ' }

  for (let index = 0; index < source.length;) {
    const character = source[index]
    if (quote) {
      const delimiter = quote.repeat(3)
      if (triple && source.startsWith(delimiter, index) && (quote === "'" || !isEscaped(index))) {
        blank(index); blank(index + 1); blank(index + 2)
        index += 3
        quote = null
        triple = false
        escaped = false
        continue
      }
      if (!triple && character === quote && (quote === "'" || !isEscaped(index))) {
        blank(index)
        index++
        quote = null
        escaped = false
        continue
      }
      blank(index)
      if (character === '\n' || character === '\r') escaped = false
      else if (quote === '"') {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
      }
      index++
      continue
    }

    if (character === '#') {
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        blank(index)
        index++
      }
      continue
    }
    if (character === '"' || character === "'") {
      triple = source.startsWith(character.repeat(3), index)
      quote = character
      escaped = false
      blank(index)
      if (triple) { blank(index + 1); blank(index + 2); index += 3 }
      else index++
      continue
    }
    index++
  }
  return masked.join('')
}

function rejectHighPrecisionDateTimes(source) {
  const masked = maskTomlStringsAndComments(source)
  const tokenPattern = /(?:^|[^A-Za-z0-9_])(?:\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2})\.(\d+)(?:[Zz]|[+-]\d{2}:\d{2})?(?=$|[^A-Za-z0-9_])/gm
  for (const match of masked.matchAll(tokenPattern)) {
    if (match[1].length > 3) {
      throw new TypeError('TOML 日期时间的小数秒超过 3 位，当前 JSON 输出仅支持毫秒精度')
    }
  }
}

// smol-toml represents every TOML date/time as a TomlDate (a Date subclass).
// Convert parser-specific values before the UI calls JSON.stringify so dates
// remain deterministic strings and a future BigInt result cannot break JSON.
function normalizeParsedValue(value) {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('TOML 中的 Infinity 和 NaN 无法转换为 JSON')
  }
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalizeParsedValue)
  if (isPlainObject(value)) {
    const result = createMap()
    for (const key of Object.keys(value)) {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: normalizeParsedValue(value[key])
      })
    }
    return result
  }
  return value
}

/** Parse TOML into JSON-compatible values. TOML date/time values become strings. */
export function parseToml(source) {
  if (typeof source !== 'string') throw new TypeError('TOML 输入必须是字符串')
  const normalizedSource = source.replace(/^\uFEFF/, '')
  rejectHighPrecisionDateTimes(normalizedSource)
  return normalizeParsedValue(parseDocument(normalizedSource))
}

function pathLabel(path) {
  return path || '根'
}

function rejectValue(path, reason) {
  throw new TypeError('JSON 路径 ' + pathLabel(path) + reason)
}

function validateJsonValue(value, path, ancestors) {
  if (value === null) rejectValue(path, ' 的 null 无法表示为 TOML')
  if (value === undefined) rejectValue(path, ' 的 undefined 无法表示为 TOML')

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) rejectValue(path, ' 包含无法转换的特殊数字')
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) rejectValue(path, ' 包含超出安全整数范围的数字')
    return
  }
  if (typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value !== 'object') rejectValue(path, ' 包含不支持的非 JSON 值')
  if (value instanceof Date || (!Array.isArray(value) && !isPlainObject(value))) {
    rejectValue(path, ' 包含不支持的非普通 JSON 值')
  }

  if (ancestors.has(value)) rejectValue(path, ' 包含循环引用')
  ancestors.add(value)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const itemPath = path + '[' + index + ']'
      if (!Object.hasOwn(value, index)) rejectValue(itemPath, ' 的 undefined 无法表示为 TOML')
      validateJsonValue(value[index], itemPath, ancestors)
    }
  } else {
    for (const key of Object.keys(value)) {
      validateJsonValue(value[key], path ? path + '.' + key : key, ancestors)
    }
  }
  ancestors.delete(value)
}

/** Serialize an ordinary JSON object to TOML. */
export function stringifyToml(value) {
  if (!isPlainObject(value)) throw new TypeError('JSON 输入必须是普通对象（TOML 顶层需要键值表）')
  validateJsonValue(value, '', new Set())
  return stringifyDocument(value)
}

const sampleToml = [
  'title = "TOML 示例"',
  '',
  '[owner]',
  'name = "Tom Preston-Werner"',
  'organization = "GitHub"',
  '',
  '[database]',
  'enabled = true',
  'ports = [8000, 8001, 8002]'
].join('\n')

const sampleJson = {
  title: 'TOML 示例',
  owner: { name: 'Tom Preston-Werner', organization: 'GitHub' },
  database: { enabled: true, ports: [8000, 8001, 8002] }
}

export default {
  id: 'toml-json',
  name: 'TOML ↔ JSON 转换',
  description: '在 TOML 配置与 JSON 对象之间双向转换，支持表和数组表',
  category: 'converter',
  icon: 'json',
  render(container) {
    let mode = 'toml-to-json'
    let rerun = () => {}
    const modeGroup = createSegmentedGroup([
      { label: 'TOML → JSON', value: 'toml-to-json' },
      { label: 'JSON → TOML', value: 'json-to-toml' }
    ], value => {
      mode = value
      rerun()
    }, { label: '转换方向' })
    const state = renderTextTransform(container, {
      inputTitle: '输入',
      outputTitle: '结果',
      inputPlaceholder: '粘贴 TOML 或 JSON 配置...',
      outputPlaceholder: '转换结果将显示在此...',
      actionLabel: '转换',
      sample: () => mode === 'toml-to-json' ? sampleToml : JSON.stringify(sampleJson, null, 2),
      options: modeGroup,
      transform(text) {
        if (!text.trim()) return ''
        if (mode === 'toml-to-json') return JSON.stringify(parseToml(text), null, 2)
        return stringifyToml(JSON.parse(text))
      }
    })
    rerun = state.run
  }
}
