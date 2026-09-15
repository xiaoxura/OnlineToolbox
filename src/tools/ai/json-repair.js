import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'

// Scan from an opening bracket to its matching close, ignoring brackets that
// sit inside a string. Returns null when the structure never closes, which is
// the normal case for a truncated model response.
function findBalanced(text, start) {
  let depth = 0
  let i = start
  let inString = null
  while (i < text.length) {
    const ch = text[i]
    if (inString) {
      if (ch === '\\') { i += 2; continue }
      if (ch === inString) inString = null
      i++
      continue
    }
    if (ch === '"' || ch === "'") { inString = ch; i++; continue }
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
    i++
  }
  return null
}

// Pull the JSON payload out of a model response: prefer a fenced code block,
// otherwise the first balanced {...} or [...] in the prose.
export function extractJson(text) {
  const source = String(text)
  const fence = source.match(/```(?:json5?|javascript|js)?\s*\n?([\s\S]*?)```/i)
  if (fence) {
    const body = fence[1].trim()
    if (body) return { json: body, source: 'Markdown 代码块' }
  }
  const start = source.search(/[{[]/)
  if (start < 0) throw new Error('没有找到 JSON 的起始 { 或 [')
  const balanced = findBalanced(source, start)
  if (balanced) return { json: balanced, source: '正文中的完整结构' }
  return { json: source.slice(start).trim(), source: '正文中的未闭合结构（已尽力修复）' }
}

const LITERALS = {
  True: 'true', False: 'false', None: 'null',
  NaN: 'null', Infinity: 'null', undefined: 'null'
}

// Skip whitespace and comments when looking ahead. Without this, a trailing
// comma followed by a line comment ("null, // note\n}") looks like a comma
// followed by ordinary content, so it survives and the parse still fails.
function skipTrivia(text, index) {
  let i = index
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++
    if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (text[i] === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end < 0 ? text.length : end + 2
      continue
    }
    return i
  }
}

// Repair the common ways a model mangles JSON.
//
// Everything here walks the text character by character and only touches
// structure *outside* string literals — a regex pass would happily rewrite a
// comma that is part of the payload. String literals themselves are re-emitted
// with double-quote delimiters and re-escaped consistently.
export function repairJson(input) {
  const text = String(input)
  const fixes = new Set()
  let out = ''
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    // Line and block comments.
    if (ch === '/' && text[i + 1] === '/') {
      fixes.add('移除 // 注释')
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      fixes.add('移除 /* */ 注释')
      const end = text.indexOf('*/', i + 2)
      i = end < 0 ? text.length : end + 2
      continue
    }

    // String literals — normalize the delimiter to " and re-escape contents.
    const SMART_QUOTES = '“”‘’'
    if (ch === '"' || ch === "'" || SMART_QUOTES.includes(ch)) {
      const isSingle = ch !== '"'
      if (SMART_QUOTES.includes(ch)) fixes.add('智能引号 → 直引号')
      else if (isSingle) fixes.add('单引号 → 双引号')

      let body = ''
      let closed = false
      i++
      while (i < text.length) {
        const c = text[i]
        if (c === '\\') { body += c + (text[i + 1] ?? ''); i += 2; continue }
        const closes = isSingle ? (c === "'" || SMART_QUOTES.includes(c)) : (c === '"' || SMART_QUOTES.includes(c))
        if (closes) { i++; closed = true; break }
        body += c
        i++
      }
      if (!closed) fixes.add('补全未闭合的字符串')

      if (isSingle) {
        if (/\\'/.test(body)) fixes.add("反转义 \\'")
        if (body.includes('"')) fixes.add('转义字符串内的双引号')
      }
      const inner = body.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/"/g, '\\"')
      out += `"${inner}"`
      continue
    }

    // Full-width punctuation that models copy from prose.
    if (ch === '，') { fixes.add('全角逗号 → 半角'); out += ','; i++; continue }
    if (ch === '：') { fixes.add('全角冒号 → 半角'); out += ':'; i++; continue }

    // Trailing comma before a closing bracket.
    if (ch === ',') {
      const k = skipTrivia(text, i + 1)
      if (text[k] === '}' || text[k] === ']') {
        fixes.add('移除尾随逗号')
        i++
        continue
      }
      out += ch
      i++
      continue
    }

    // Bare words: either an unquoted key, a Python/JS literal, or noise.
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i
      while (j < text.length && /[\w$]/.test(text[j])) j++
      const word = text.slice(i, j)
      let k = j
      while (k < text.length && /\s/.test(text[k])) k++
      if (text[k] === ':' || text[k] === '：') {
        fixes.add('为键名补上引号')
        out += JSON.stringify(word)
        i = j
        continue
      }
      if (LITERALS[word] !== undefined) {
        fixes.add('Python/JS 字面量 → JSON')
        out += LITERALS[word]
        i = j
        continue
      }
      out += word
      i = j
      continue
    }

    out += ch
    i++
  }

  return { json: out, fixes: [...fixes] }
}

// Full pipeline: locate the payload, repair it, parse it. Falls back to the
// repaired text when the original parses fine so no fix is reported spuriously.
export function parseLenient(text) {
  const { json: extracted, source } = extractJson(text)
  let value = null
  try {
    value = JSON.parse(extracted)
    return { value, json: extracted, fixes: [], source }
  } catch {
    // Fall through to the repair pass.
  }
  const { json: repaired, fixes } = repairJson(extracted)
  try {
    value = JSON.parse(repaired)
  } catch (cause) {
    throw new Error(`修复后仍无法解析：${cause.message}`)
  }
  return { value, json: repaired, fixes, source }
}

const SAMPLE = `模型输出如下：

\`\`\`json
{
  'name': '示例',
  "count": 3,
  "tags": ["a", "b",],
  "enabled": True,
  "note": None, // 这是注释
}
\`\`\`

以上是结构化结果。`

export default {
  id: 'llm-json-repair',
  name: 'LLM 输出 JSON 修复',
  description: '从模型回复中提取 JSON，修复尾随逗号、单引号等常见错误',
  category: 'ai',
  icon: 'ai-json',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      placeholder: '粘贴模型的原始回复，可包含解释文字和 ```json 代码块…',
      rows: 12
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      readOnly: true,
      placeholder: '修复后的 JSON 将显示在此…',
      rows: 12
    })
    const report = createElement('div', { className: 'form-hint' })
    const error = createElement('div', { className: 'error-text' })

    const formats = [
      { value: 'pretty', label: '美化' },
      { value: 'compact', label: '压缩' }
    ]
    const formatGroup = createSegmentedGroup(formats, () => run(), { label: '输出格式' })

    function run() {
      error.textContent = ''
      report.textContent = ''
      output.value = ''
      if (!input.value.trim()) return
      try {
        const result = parseLenient(input.value)
        const compact = formatGroup.getValue() === 'compact'
        output.value = compact ? JSON.stringify(result.value) : JSON.stringify(result.value, null, 2)
        const parts = [`来源：${result.source}`]
        if (result.fixes.length) parts.push(`已修复：${result.fixes.join('、')}`)
        else parts.push('原始内容即为合法 JSON，无需修复')
        report.textContent = parts.join(' · ')
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    input.addEventListener('input', run)

    const sample = () => {
      input.value = SAMPLE
      run()
    }

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '输出格式' }),
          formatGroup
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '提取并修复',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: sample
        })
      ]),
      error,
      report,
      createSection('模型原始输出', input),
      createSection('修复后的 JSON', output)
    )
  }
}
