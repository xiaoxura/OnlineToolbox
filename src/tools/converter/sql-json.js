import { createElement, createSection, createSegmentedGroup, createCopyButton } from '../../utils/dom.js'

// SQL <-> JSON/CSV conversion for the common `INSERT INTO ... VALUES ...`
// shape. The parser is intentionally small but handles the syntax that shows
// up in dumps: quoted strings with '' escapes, quoted identifiers, numbers,
// NULL/TRUE/FALSE, simple function calls kept verbatim, comments and several
// statements in one script.

function tokenize(sql) {
  const tokens = []
  const length = sql.length
  let index = 0

  while (index < length) {
    const char = sql[index]

    if (/\s/.test(char)) {
      index++
      continue
    }
    if (char === '-' && sql[index + 1] === '-') {
      index += 2
      while (index < length && sql[index] !== '\n') index++
      continue
    }
    if (char === '/' && sql[index + 1] === '*') {
      const end = sql.indexOf('*/', index + 2)
      if (end < 0) throw new Error('SQL 注释未闭合（缺少 */）')
      index = end + 2
      continue
    }
    if (char === "'") {
      const start = index
      let cursor = index + 1
      let value = ''
      let closed = false
      while (cursor < length) {
        if (sql[cursor] === "'") {
          if (sql[cursor + 1] === "'") {
            value += "'"
            cursor += 2
            continue
          }
          cursor++
          closed = true
          break
        }
        value += sql[cursor]
        cursor++
      }
      if (!closed) throw new Error('SQL 字符串未闭合（缺少结尾的单引号）')
      tokens.push({ type: 'string', value, start, end: cursor })
      index = cursor
      continue
    }
    if (char === '"' || char === '`') {
      const quote = char
      const start = index
      let cursor = index + 1
      let value = ''
      let closed = false
      while (cursor < length) {
        if (sql[cursor] === quote) {
          if (sql[cursor + 1] === quote) {
            value += quote
            cursor += 2
            continue
          }
          cursor++
          closed = true
          break
        }
        value += sql[cursor]
        cursor++
      }
      if (!closed) throw new Error('SQL 标识符未闭合（缺少结尾的引号）')
      tokens.push({ type: 'ident', value, quote, start, end: cursor })
      index = cursor
      continue
    }
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(sql[index + 1] ?? ''))) {
      const match = /^(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/.exec(sql.slice(index))
      const value = match[0]
      tokens.push({ type: 'number', value, start: index, end: index + value.length })
      index += value.length
      continue
    }
    if (/[A-Za-z_$\u0080-\uFFFF]/.test(char)) {
      let end = index + 1
      while (end < length && /[A-Za-z0-9_$\u0080-\uFFFF]/.test(sql[end])) end++
      tokens.push({ type: 'word', value: sql.slice(index, end), start: index, end })
      index = end
      continue
    }
    if ('(),;.+-*/%='.includes(char)) {
      tokens.push({ type: 'symbol', value: char, start: index, end: index + 1 })
      index++
      continue
    }
    throw new Error(`SQL 第 ${index + 1} 个字符附近有无法识别的符号「${char}」`)
  }

  return tokens
}

function evaluateValue(tokens, sql) {
  if (tokens.length === 1) {
    const token = tokens[0]
    if (token.type === 'string') return token.value
    if (token.type === 'number') return Number(token.value)
    if (token.type === 'ident') return token.value
    if (token.type === 'word') {
      const upper = token.value.toUpperCase()
      if (upper === 'NULL') return null
      if (upper === 'TRUE') return true
      if (upper === 'FALSE') return false
      return sql.slice(token.start, token.end)
    }
  }
  if (
    tokens.length === 2 &&
    tokens[0].type === 'symbol' &&
    (tokens[0].value === '-' || tokens[0].value === '+') &&
    tokens[1].type === 'number'
  ) {
    const number = Number(tokens[1].value)
    return tokens[0].value === '-' ? -number : number
  }
  // Anything else (NOW(), DEFAULT, arithmetic, ...) is kept verbatim, which is
  // more useful than pretending to know its value.
  return sql.slice(tokens[0].start, tokens[tokens.length - 1].end).trim()
}

class SqlParser {
  constructor(tokens, sql) {
    this.tokens = tokens
    this.sql = sql
    this.index = 0
  }

  get done() {
    return this.index >= this.tokens.length
  }

  peek(offset = 0) {
    return this.tokens[this.index + offset]
  }

  next() {
    const token = this.tokens[this.index]
    if (!token) throw this.error('语句意外结束')
    this.index++
    return token
  }

  isSymbol(token, value) {
    return token?.type === 'symbol' && token.value === value
  }

  matchSymbol(value) {
    if (!this.isSymbol(this.peek(), value)) return false
    this.index++
    return true
  }

  matchWord(word) {
    const token = this.peek()
    if (token?.type !== 'word' || token.value.toUpperCase() !== word) return false
    this.index++
    return true
  }

  expectSymbol(value, label) {
    if (!this.matchSymbol(value)) throw this.error(`缺少「${value}」（${label}）`)
  }

  expectWord(word) {
    if (!this.matchWord(word)) throw this.error(`缺少关键字 ${word}`)
  }

  error(message) {
    const token = this.peek()
    const position = token ? `第 ${token.start + 1} 个字符附近` : '语句末尾'
    return new Error(`SQL 解析失败（${position}）：${message}`)
  }

  parseIdentifier(label) {
    const token = this.peek()
    if (!token) throw this.error(`${label}不能为空`)
    if (token.type === 'word' || token.type === 'ident') {
      this.index++
      return token.value
    }
    throw this.error(`${label}必须是标识符`)
  }

  parseQualifiedName(label) {
    const parts = [this.parseIdentifier(label)]
    while (this.matchSymbol('.')) parts.push(this.parseIdentifier(label))
    return parts.join('.')
  }

  parseExpression() {
    const startIndex = this.index
    let depth = 0
    while (!this.done) {
      const token = this.peek()
      if (token.type === 'symbol') {
        if (token.value === '(') depth++
        else if (token.value === ')') {
          if (depth === 0) break
          depth--
        } else if ((token.value === ',' || token.value === ';') && depth === 0) {
          break
        }
      }
      this.index++
    }
    if (this.index === startIndex) throw this.error('VALUES 中存在空值')
    const tokens = this.tokens.slice(startIndex, this.index)
    return evaluateValue(tokens, this.sql)
  }

  parseStatements() {
    const statements = []
    while (!this.done) {
      if (this.matchSymbol(';')) continue
      if (!this.matchWord('INSERT')) throw this.error('仅支持 INSERT 语句')
      this.matchWord('IGNORE')
      this.matchWord('INTO')

      const table = this.parseQualifiedName('表名')
      this.expectSymbol('(', '列名列表')
      const columns = []
      if (!this.isSymbol(this.peek(), ')')) {
        do {
          const column = this.parseIdentifier('列名')
          if (columns.includes(column)) throw this.error(`列名「${column}」重复`)
          columns.push(column)
        } while (this.matchSymbol(','))
      }
      this.expectSymbol(')', '列名列表')
      if (!columns.length) throw this.error('INSERT 语句缺少列名列表')
      this.expectWord('VALUES')

      const rows = []
      do {
        this.expectSymbol('(', 'VALUES 元组')
        const row = []
        if (!this.isSymbol(this.peek(), ')')) {
          do {
            row.push(this.parseExpression())
          } while (this.matchSymbol(','))
        }
        this.expectSymbol(')', 'VALUES 元组')
        if (row.length !== columns.length) {
          throw this.error(`列数（${columns.length}）与值数量（${row.length}）不一致`)
        }
        rows.push(row)
      } while (this.matchSymbol(','))

      this.matchSymbol(';')
      statements.push({ table, columns, rows })
    }
    return statements
  }
}

export function parseInsertStatements(sql) {
  const text = String(sql ?? '')
  if (!text.trim()) throw new Error('请输入 SQL 语句')
  const parser = new SqlParser(tokenize(text), text)
  const statements = parser.parseStatements()
  if (!statements.length) throw new Error('未找到 INSERT 语句')
  return statements
}

function flattenRows(statements) {
  const rows = []
  for (const statement of statements) {
    for (const row of statement.rows) {
      const object = {}
      statement.columns.forEach((column, index) => {
        object[column] = row[index]
      })
      rows.push(object)
    }
  }
  return rows
}

export function sqlToJson(sql, { pretty = true } = {}) {
  const rows = flattenRows(parseInsertStatements(sql))
  return JSON.stringify(rows, null, pretty ? 2 : undefined)
}

function quoteCsvValue(value) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function sqlToCsv(sql) {
  const statements = parseInsertStatements(sql)
  const columns = []
  for (const statement of statements) {
    for (const column of statement.columns) {
      if (!columns.includes(column)) columns.push(column)
    }
  }
  const lines = [columns.map(quoteCsvValue).join(',')]
  for (const statement of statements) {
    for (const row of statement.rows) {
      lines.push(
        columns
          .map(column => {
            const index = statement.columns.indexOf(column)
            return quoteCsvValue(index < 0 ? '' : row[index])
          })
          .join(',')
      )
    }
  }
  return lines.join('\n')
}

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

function quoteQualifiedName(name) {
  const parts = String(name)
    .split('.')
    .map(part => part.trim())
    .filter(Boolean)
  if (!parts.length) throw new Error('表名格式无效')
  return parts.map(quoteIdentifier).join('.')
}

function formatSqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('不支持 NaN 或 Infinity 数值')
    return String(value)
  }
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
  if (typeof value === 'object') {
    const json = JSON.stringify(value)
    if (json === undefined) throw new Error('不支持的值类型')
    return `'${json.replace(/'/g, "''")}'`
  }
  throw new Error(`不支持的字段值类型：${typeof value}`)
}

function normalizeJsonRows(jsonText) {
  let parsed = jsonText
  if (typeof jsonText === 'string') {
    if (!jsonText.trim()) throw new Error('请输入 JSON 数据')
    try {
      parsed = JSON.parse(jsonText)
    } catch (cause) {
      throw new Error(`JSON 解析失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return [parsed]
  if (!Array.isArray(parsed)) throw new Error('JSON 必须是对象或对象数组')
  if (!parsed.length) throw new Error('JSON 数组不能为空')
  return parsed.map((row, index) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`JSON 数组的第 ${index + 1} 个元素不是对象`)
    }
    return row
  })
}

export function jsonToInsert(jsonText, tableName) {
  const rows = normalizeJsonRows(jsonText)
  const table = quoteQualifiedName(String(tableName ?? ''))
  const columns = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key)
    }
  }
  if (!columns.length) throw new Error('JSON 对象没有可导出的字段')

  const rowSql = rows.map(row => `(${columns.map(column => formatSqlLiteral(row[column])).join(', ')})`)
  const header = `INSERT INTO ${table} (${columns.map(quoteIdentifier).join(', ')}) VALUES`
  if (rowSql.length === 1) return `${header} ${rowSql[0]};`
  return `${header}\n  ${rowSql.join(',\n  ')};`
}

const SQL_EXAMPLE = `-- 用户与日志示例
INSERT INTO users (id, name, email) VALUES
  (1, 'O''Brien', 'ob@example.com'),
  (2, '张三', NULL);
INSERT INTO logs (id, message, ok) VALUES (10, '登录成功', TRUE);`

const JSON_EXAMPLE = `[
  { "id": 1, "name": "O'Brien", "email": "ob@example.com" },
  { "id": 2, "name": "张三", "email": null }
]`

export default {
  render(container) {
    let mode = 'sql-json'

    const input = createElement('textarea', {
      className: 'textarea',
      rows: 12,
      spellcheck: 'false',
      'aria-label': 'SQL 或 JSON 输入',
      placeholder: "INSERT INTO users (id, name) VALUES (1, 'Alice');"
    })
    const output = createElement('textarea', {
      className: 'textarea',
      rows: 12,
      readOnly: true,
      spellcheck: 'false',
      'aria-label': '转换结果',
      placeholder: '转换结果将显示在此…'
    })
    const tableNameInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: 'users',
      'aria-label': '目标表名'
    })
    const tableNameGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: '目标表名' }),
      tableNameInput
    ])
    tableNameGroup.hidden = true

    const status = createElement('div', { className: 'form-hint', role: 'status', 'aria-live': 'polite' })
    const errorEl = createElement('div', { className: 'error-text' })

    const modeGroup = createSegmentedGroup(
      [
        { value: 'sql-json', label: 'SQL → JSON' },
        { value: 'sql-csv', label: 'SQL → CSV' },
        { value: 'json-sql', label: 'JSON → SQL' }
      ],
      value => switchMode(value),
      { label: '转换方向' }
    )

    const convertButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '转换',
      onClick: () => convert()
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = mode === 'json-sql' ? JSON_EXAMPLE : SQL_EXAMPLE
        if (mode === 'json-sql') tableNameInput.value = 'users'
        resetOutput()
      }
    })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        input.value = ''
        resetOutput()
        input.focus()
      }
    })
    const copyButton = createCopyButton(() => output.value)

    function resetOutput() {
      output.value = ''
      errorEl.textContent = ''
      status.textContent = ''
    }

    function switchMode(value) {
      mode = value
      tableNameGroup.hidden = mode !== 'json-sql'
      input.placeholder = mode === 'json-sql' ? '[{"id":1,"name":"Alice"}]' : "INSERT INTO users (id, name) VALUES (1, 'Alice');"
      resetOutput()
    }

    function convert() {
      resetOutput()
      try {
        if (mode === 'sql-json') {
          output.value = sqlToJson(input.value)
          status.textContent = `已转换 ${JSON.parse(output.value).length} 行数据`
        } else if (mode === 'sql-csv') {
          output.value = sqlToCsv(input.value)
          const rowCount = output.value ? output.value.split('\n').length - 1 : 0
          status.textContent = `已转换 ${rowCount} 行数据`
        } else {
          output.value = jsonToInsert(input.value, tableNameInput.value)
          status.textContent = '已生成 INSERT 语句'
        }
      } catch (cause) {
        output.value = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    switchMode(mode)
    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 SQL 与 JSON 数据只在本机浏览器中转换，不会上传到服务器。'
      }),
      createElement('div', { className: 'form-group' }, [createElement('div', { className: 'label', textContent: '转换方向' }), modeGroup]),
      tableNameGroup,
      createSection('输入', input),
      createElement('div', { className: 'btn-group' }, [convertButton, sampleButton, clearButton]),
      status,
      errorEl,
      createSection('输出结果', output, [copyButton])
    )
  }
}
