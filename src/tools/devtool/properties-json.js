import { createElement, createSegmentedGroup } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// Java `java.util.Properties` reader/writer. The rules implemented here are the
// ones `Properties.load` / `Properties.store` follow:
//   * `=` / `:` / whitespace separate key from value
//   * a natural line ending in an odd number of backslashes continues
//   * `\t \n \r \f \\ \uXXXX`, plus `\: \= \# \! \ ` which matter inside keys
//   * `#` and `!` start a comment line
// A literal `#`/`!`/`=`/`:` therefore has to be escaped in keys — the writer
// below does that (Java itself forgets to, which makes its output unreadable).

const HEX_DIGITS = '0123456789ABCDEF'

function toUnicodeEscape(code) {
  return `\\u${HEX_DIGITS[(code >> 12) & 0xf]}${HEX_DIGITS[(code >> 8) & 0xf]}${HEX_DIGITS[(code >> 4) & 0xf]}${HEX_DIGITS[code & 0xf]}`
}

function escapeProperty(text, { escapeSpace, escapeSpecials }) {
  let out = ''
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (character === '\\') { out += '\\\\'; continue }
    if (character === '\t') { out += '\\t'; continue }
    if (character === '\n') { out += '\\n'; continue }
    if (character === '\r') { out += '\\r'; continue }
    if (character === '\f') { out += '\\f'; continue }
    if (character === ' ') {
      out += index === 0 || escapeSpace ? '\\ ' : ' '
      continue
    }
    if (escapeSpecials && (character === '=' || character === ':' || character === '#' || character === '!')) {
      out += '\\' + character
      continue
    }
    const code = text.charCodeAt(index)
    if (code < 0x20 || code > 0x7e) {
      // Outside printable ASCII (including every CJK character) Java escapes
      // to `\uXXXX`; surrogate halves are escaped separately, like Java does.
      out += toUnicodeEscape(code)
      continue
    }
    out += character
  }
  return out
}

function unescapeProperty(text) {
  let out = ''
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (character !== '\\') { out += character; continue }
    index += 1
    if (index >= text.length) break
    const escape = text[index]
    if (escape === 't') out += '\t'
    else if (escape === 'n') out += '\n'
    else if (escape === 'r') out += '\r'
    else if (escape === 'f') out += '\f'
    else if (escape === 'u') {
      const hex = text.slice(index + 1, index + 5)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error('存在非法的 \\uXXXX 转义序列')
      out += String.fromCharCode(parseInt(hex, 16))
      index += 4
    } else {
      out += escape
    }
  }
  return out
}

function hasOddTrailingBackslashes(line) {
  let count = 0
  for (let index = line.length - 1; index >= 0 && line[index] === '\\'; index--) count++
  return count % 2 === 1
}

/** Join continuation lines and drop comments/blank lines, keeping pairs only. */
function readLogicalLines(text) {
  const natural = text.replace(/^﻿/, '').split(/\r\n|\r|\n/)
  const logical = []
  let index = 0
  while (index < natural.length) {
    const first = natural[index++]
    const head = first.replace(/^[ \t\f]+/, '')
    if (head.startsWith('#') || head.startsWith('!')) continue

    let line = first
    while (hasOddTrailingBackslashes(line) && index < natural.length) {
      // The backslash and the line break vanish; the continuation line loses
      // its own leading whitespace.
      line = line.slice(0, -1) + natural[index++].replace(/^[ \t\f]+/, '')
    }
    if (hasOddTrailingBackslashes(line)) line = line.slice(0, -1)
    if (!line.trim()) continue
    logical.push(line)
  }
  return logical
}

function splitKeyValue(line) {
  const limit = line.length
  let keyLength = 0
  let valueStart = limit
  let hasSeparator = false
  let precededByBackslash = false

  while (keyLength < limit) {
    const character = line[keyLength]
    if ((character === '=' || character === ':') && !precededByBackslash) {
      valueStart = keyLength + 1
      hasSeparator = true
      break
    }
    if ((character === ' ' || character === '\t' || character === '\f') && !precededByBackslash) {
      valueStart = keyLength + 1
      break
    }
    precededByBackslash = character === '\\' ? !precededByBackslash : false
    keyLength++
  }

  while (valueStart < limit) {
    const character = line[valueStart]
    if (character !== ' ' && character !== '\t' && character !== '\f') {
      if (!hasSeparator && (character === '=' || character === ':')) hasSeparator = true
      else break
    }
    valueStart++
  }

  return {
    key: unescapeProperty(line.slice(0, keyLength)),
    value: unescapeProperty(line.slice(valueStart))
  }
}

/** Parse properties text into `{ key, value }` pairs (last duplicate wins). */
export function parseProperties(text) {
  if (typeof text !== 'string') throw new TypeError('properties 输入必须是字符串')
  const pairs = []
  for (const line of readLogicalLines(text)) pairs.push(splitKeyValue(line))
  return pairs
}

function assignNested(root, key, value) {
  const segments = key.split('.')
  let node = root
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index]
    const path = segments.slice(0, index + 1).join('.')
    if (Object.hasOwn(node, segment)) {
      const existing = node[segment]
      if (existing === null || typeof existing !== 'object') {
        throw new Error(`键 "${key}" 与标量键 "${path}" 冲突，无法展开嵌套`)
      }
      node = existing
    } else {
      node = node[segment] = Object.create(null)
    }
  }
  const leaf = segments[segments.length - 1]
  if (Object.hasOwn(node, leaf) && typeof node[leaf] === 'object' && node[leaf] !== null) {
    throw new Error(`键 "${key}" 与已有的子键冲突，无法展开嵌套`)
  }
  node[leaf] = value
}

/** Convert properties text into a formatted JSON object string. */
export function propertiesToJson(text, options = {}) {
  const { nested = false } = options
  const pairs = parseProperties(text)
  if (!nested) {
    return JSON.stringify(Object.fromEntries(pairs.map(pair => [pair.key, pair.value])), null, 2)
  }
  const root = Object.create(null)
  for (const { key, value } of pairs) assignNested(root, key, value)
  return JSON.stringify(root, null, 2)
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function formatPropertyValue(value, path) {
  if (value === null || value === undefined) throw new Error(`键 "${path}" 的 ${String(value)} 无法表示为 properties 值`)
  if (typeof value === 'object') throw new Error(`键 "${path}" 是数组或对象，无法表示为 properties 值`)
  return String(value)
}

function writePairs(value, prefix, { nested, lines }) {
  for (const [key, item] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (isPlainObject(item)) {
      if (!nested) throw new Error(`键 "${fullKey}" 是嵌套对象，请开启「展开嵌套」`)
      writePairs(item, fullKey, { nested, lines })
      continue
    }
    const text = formatPropertyValue(item, fullKey)
    lines.push(
      escapeProperty(fullKey, { escapeSpace: true, escapeSpecials: true }) +
      '=' +
      escapeProperty(text, { escapeSpace: false, escapeSpecials: false })
    )
  }
}

/** Convert a JSON object (or JSON text) into properties text. */
export function jsonToProperties(input, options = {}) {
  const { nested = false } = options
  let data = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch (cause) {
      throw new Error('JSON 解析失败: ' + cause.message)
    }
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('JSON 输入必须是对象')
  }
  const lines = []
  writePairs(data, '', { nested, lines })
  return lines.join('\n')
}

const SAMPLE_PROPERTIES = [
  '# 应用配置',
  '! 感叹号同样是注释',
  'app.name=工具箱',
  'app.version=1.0.0',
  '',
  'app.database.host=localhost',
  'app.database.port=5432',
  'app.database.url=https\\://example.com/db',
  'app.database.token=第一行\\n第二行',
  'app.database.desc=多行\\',
  '  description'
].join('\n')

const SAMPLE_JSON = JSON.stringify({
  'app.name': '工具箱',
  'app.version': '1.0.0',
  'app.database.host': 'localhost',
  'app.database.port': '5432',
  'app.database.url': 'https://example.com/db'
}, null, 2)

const SAMPLE_NESTED_JSON = JSON.stringify({
  app: {
    name: '工具箱',
    version: '1.0.0',
    database: { host: 'localhost', port: '5432' }
  }
}, null, 2)

export default {
  id: 'properties-json',
  name: '.properties ↔ JSON',
  description: 'Java properties 文件与 JSON 双向转换，支持转义与 Unicode',
  category: 'devtool',
  icon: 'json',
  keywords: ['properties', 'java', '配置', 'unicode 转义'],
  render(container) {
    let mode = 'properties-to-json'
    let state
    const rerun = () => state?.run()

    const modeGroup = createSegmentedGroup([
      { label: '.properties → JSON', value: 'properties-to-json' },
      { label: 'JSON → .properties', value: 'json-to-properties' }
    ], value => {
      mode = value
      rerun()
    }, { label: '转换方向' })

    const nestedCheckbox = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'properties-json-nested',
      onChange: rerun
    })
    const nestedOption = createElement('label', { className: 'option-item' }, [
      nestedCheckbox,
      createElement('span', { textContent: '展开嵌套' })
    ])

    state = renderTextTransform(container, {
      inputTitle: '输入',
      outputTitle: '结果',
      inputPlaceholder: '粘贴 .properties 内容或 JSON 对象…',
      outputPlaceholder: '转换结果将显示在此…',
      actionLabel: '转换',
      rows: 14,
      sample: () => {
        if (mode === 'properties-to-json') return SAMPLE_PROPERTIES
        return nestedCheckbox.checked ? SAMPLE_NESTED_JSON : SAMPLE_JSON
      },
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: '转换方向' }),
            modeGroup
          ]),
          createElement('div', { className: 'form-group option-control-group' }, [nestedOption])
        ]),
        createElement('p', {
          className: 'form-hint',
          textContent: '「展开嵌套」把 app.database.host 这样的点号键展开为嵌套 JSON；反方向则把嵌套对象拍平成点号键。非 Latin-1 字符按 Java 规则写为 \\uXXXX 转义。'
        })
      ],
      transform(text) {
        if (!text.trim()) return ''
        const nested = nestedCheckbox.checked
        return mode === 'properties-to-json'
          ? propertiesToJson(text, { nested })
          : jsonToProperties(text, { nested })
      }
    })
  }
}
