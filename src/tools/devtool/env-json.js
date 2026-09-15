import { createElement, createSegmentedGroup } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// dotenv parsing/writing. The reader follows the widely used dotenv rules:
// `KEY=value`, an optional `export ` prefix, `#` comments, and single / double /
// backtick quoted values that may span several lines. A `#` inside a quoted
// value is literal — only an unquoted value is cut short at the first `#`.

/** Reserved JSON key that carries preserved comments in `keepComments` mode. */
export const COMMENTS_KEY = '__comments__'

// `\t` is deliberately NOT an escape: `"C:\temp"` is a Windows path far more
// often than it is a tab, and a real tab survives verbatim inside quotes.
const ESCAPES = { n: '\n', r: '\r', '\\': '\\', '"': '"', "'": "'", '`': '`' }

function readQuoted(source, start, quote) {
  // Single quotes are literal; double quotes and backticks expand the escape
  // set above. Unknown escapes are kept verbatim so Windows paths survive.
  const expand = quote !== "'"
  let index = start + 1
  let value = ''
  while (index < source.length) {
    const character = source[index]
    if (character === quote) return { value, end: index + 1 }
    if (character === '\\' && expand) {
      const next = source[index + 1]
      if (next === undefined) return { value: value + '\\', end: index + 1 }
      value += Object.hasOwn(ESCAPES, next) ? ESCAPES[next] : character + next
      index += 2
      continue
    }
    value += character
    index += 1
  }
  throw new Error('存在未闭合的引号')
}

/**
 * Split .env text into ordered entries:
 * `{ type: 'pair', key, value }`, `{ type: 'comment', text }`,
 * `{ type: 'blank' }` and `{ type: 'invalid', line }`.
 */
export function parseEnv(text) {
  if (typeof text !== 'string') throw new TypeError('.env 输入必须是字符串')
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const entries = []
  const length = source.length
  let index = 0

  while (index < length) {
    let cursor = index
    while (cursor < length && (source[cursor] === ' ' || source[cursor] === '\t')) cursor++

    if (cursor >= length) break
    if (source[cursor] === '\n') {
      entries.push({ type: 'blank' })
      index = cursor + 1
      continue
    }
    if (source[cursor] === '#') {
      let end = source.indexOf('\n', cursor)
      if (end < 0) end = length
      entries.push({ type: 'comment', text: source.slice(cursor, end).trimEnd() })
      index = end + 1
      continue
    }

    // `export KEY=value` — only when `export` is followed by whitespace.
    if (source.startsWith('export', cursor) && /[ \t]/.test(source[cursor + 6] ?? '')) {
      cursor += 7
      while (cursor < length && (source[cursor] === ' ' || source[cursor] === '\t')) cursor++
    }

    let keyEnd = cursor
    while (keyEnd < length && !'= \t\n'.includes(source[keyEnd])) keyEnd++
    if (source[keyEnd] !== '=') {
      let end = source.indexOf('\n', keyEnd)
      if (end < 0) end = length
      entries.push({ type: 'invalid', line: source.slice(index, end) })
      index = end + 1
      continue
    }

    const key = source.slice(cursor, keyEnd)
    cursor = keyEnd + 1
    while (cursor < length && (source[cursor] === ' ' || source[cursor] === '\t')) cursor++

    let value
    let lineEnd
    const quote = source[cursor]
    if (quote === '"' || quote === "'" || quote === '`') {
      const quoted = readQuoted(source, cursor, quote)
      value = quoted.value
      lineEnd = quoted.end
      while (lineEnd < length && source[lineEnd] !== '\n') lineEnd++
    } else {
      let stop = cursor
      while (stop < length && source[stop] !== '\n' && source[stop] !== '#') stop++
      value = source.slice(cursor, stop).trimEnd()
      lineEnd = stop
      if (source[lineEnd] === '#') while (lineEnd < length && source[lineEnd] !== '\n') lineEnd++
    }

    entries.push({ type: 'pair', key, value })
    index = lineEnd < length ? lineEnd + 1 : lineEnd
  }

  return entries
}

/** Convert .env text into a formatted JSON object string. */
export function envToJson(text, options = {}) {
  const { keepComments = false } = options
  const pairs = []
  const comments = []

  for (const entry of parseEnv(text)) {
    if (entry.type === 'pair') {
      if (entry.key === COMMENTS_KEY) throw new Error(`键名 ${COMMENTS_KEY} 为保留字段，无法转换`)
      pairs.push([entry.key, entry.value])
    } else if (entry.type === 'comment' && keepComments) {
      comments.push(entry.text)
    }
  }

  const entries = comments.length ? [[COMMENTS_KEY, comments], ...pairs] : pairs
  return JSON.stringify(Object.fromEntries(entries), null, 2)
}

function toUpperSnake(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

// A value only needs quoting when it would otherwise be re-read differently.
function formatEnvValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    const json = JSON.stringify(value) ?? ''
    return `"${json.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  const text = String(value)
  if (text === '') return ''
  if (!/[\s"'`#=\\]/.test(text)) return text
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
  return `"${escaped}"`
}

/** Convert a JSON object (or JSON text) into .env text. */
export function jsonToEnv(input, options = {}) {
  const { keepComments = false, uppercaseKeys = false } = options
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
  const comments = keepComments ? data[COMMENTS_KEY] : null
  if (Array.isArray(comments) && comments.length) {
    for (const comment of comments) {
      const text = String(comment).trim()
      if (!text) continue
      lines.push(text.startsWith('#') ? text : `# ${text}`)
    }
    lines.push('')
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === COMMENTS_KEY) continue
    const name = uppercaseKeys ? toUpperSnake(key) : key
    if (!name) throw new Error(`键名 "${key}" 无法转换为合法的环境变量名`)
    lines.push(`${name}=${formatEnvValue(value)}`)
  }

  return lines.join('\n')
}

const SAMPLE_ENV = [
  '# 应用配置',
  'NODE_ENV=production',
  '',
  'export API_BASE_URL="https://api.example.com/v1"',
  'API_TOKEN=abc123',
  'MOTD="第一行',
  '第二行"',
  'NOTE="井号 # 不是注释"',
  'EMPTY='
].join('\n')

const SAMPLE_JSON = JSON.stringify({
  [COMMENTS_KEY]: ['# 应用配置'],
  NODE_ENV: 'production',
  API_BASE_URL: 'https://api.example.com/v1',
  API_TOKEN: 'abc123',
  MOTD: '第一行\n第二行'
}, null, 2)

export default {
  id: 'env-json',
  name: '.env ↔ JSON',
  description: '在 dotenv 文件与 JSON 对象之间双向转换',
  category: 'devtool',
  icon: 'json',
  keywords: ['dotenv', 'env', '环境变量', '配置文件'],
  render(container) {
    let mode = 'env-to-json'
    let state
    const rerun = () => state?.run()

    const modeGroup = createSegmentedGroup([
      { label: '.env → JSON', value: 'env-to-json' },
      { label: 'JSON → .env', value: 'json-to-env' }
    ], value => {
      mode = value
      rerun()
    }, { label: '转换方向' })

    const commentsCheckbox = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'env-json-keep-comments',
      onChange: rerun
    })
    const commentsOption = createElement('label', { className: 'option-item' }, [
      commentsCheckbox,
      createElement('span', { textContent: '保留注释' })
    ])

    const uppercaseCheckbox = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'env-json-uppercase-keys',
      onChange: rerun
    })
    const uppercaseOption = createElement('label', { className: 'option-item' }, [
      uppercaseCheckbox,
      createElement('span', { textContent: '键名转大写下划线' })
    ])

    state = renderTextTransform(container, {
      inputTitle: '输入',
      outputTitle: '结果',
      inputPlaceholder: '粘贴 .env 内容或 JSON 对象…',
      outputPlaceholder: '转换结果将显示在此…',
      actionLabel: '转换',
      sample: () => (mode === 'env-to-json' ? SAMPLE_ENV : SAMPLE_JSON),
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: '转换方向' }),
            modeGroup
          ]),
          createElement('div', { className: 'form-group option-control-group' }, [
            commentsOption,
            uppercaseOption
          ])
        ]),
        createElement('p', { className: 'form-hint', textContent: '「键名转大写下划线」仅作用于 JSON → .env 方向。' })
      ],
      transform(text) {
        if (!text.trim()) return ''
        if (mode === 'env-to-json') {
          return envToJson(text, { keepComments: commentsCheckbox.checked })
        }
        return jsonToEnv(text, {
          keepComments: commentsCheckbox.checked,
          uppercaseKeys: uppercaseCheckbox.checked
        })
      }
    })
  }
}
