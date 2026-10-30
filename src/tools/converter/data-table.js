import Papa from 'papaparse'
import { createElement, createSection, createTableScroll } from '../../utils/dom.js'
import '../../styles/tools/data-table.css'

// Data table viewer: parse CSV / JSON, filter and sort without touching the
// network. Every cell is written through textContent, never innerHTML.

const FORMATS = new Set(['auto', 'csv', 'json'])
const MAX_RENDER_ROWS = 500
const LARGE_TABLE_ROWS = 5000
const ARRAY_COLUMN_PREFIX = '列'

export function parseTableData(text, format = 'auto') {
  const source = String(text ?? '')
  if (!FORMATS.has(format)) throw new Error(`不支持的格式：${format}（可选 auto / csv / json）`)
  if (!source.trim()) return []

  const resolved = format === 'auto' ? (/^\s*[[{]/.test(source) ? 'json' : 'csv') : format
  return resolved === 'json' ? parseJson(source) : parseCsv(source)
}

function parseCsv(source) {
  const parsed = Papa.parse(source, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header, index) => header.trim() || `${ARRAY_COLUMN_PREFIX}${index + 1}`
  })
  const blocking = parsed.errors.find(error => !['UndetectableDelimiter', 'TooFewFields', 'TooManyFields'].includes(error.code))
  if (blocking) throw new Error(`CSV 解析失败：${blocking.message}`)

  return parsed.data
    .filter(row => row && Object.values(row).some(value => value !== '' && value !== null && value !== undefined))
    .map(row => {
      const clean = {}
      for (const [key, value] of Object.entries(row)) {
        if (!key || key === '__parsed_extra') continue
        clean[key] = value === null || value === undefined ? '' : value
      }
      return clean
    })
}

function parseJson(source) {
  let data
  try {
    data = JSON.parse(source)
  } catch (cause) {
    throw new Error(`JSON 解析失败：${cause instanceof Error ? cause.message : String(cause)}`)
  }
  if (!Array.isArray(data)) throw new Error('JSON 数据必须是对象数组或二维数组')

  return data.map((item, index) => {
    if (Array.isArray(item)) {
      const row = {}
      item.forEach((cell, columnIndex) => {
        row[`${ARRAY_COLUMN_PREFIX}${columnIndex + 1}`] = cell
      })
      return row
    }
    if (item && typeof item === 'object') return { ...item }
    throw new Error(`JSON 第 ${index + 1} 项不是对象或数组`)
  })
}

export function collectColumns(rows) {
  const columns = []
  const seen = new Set()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue
      seen.add(key)
      columns.push(key)
    }
  }
  return columns
}

function formatCell(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function isEmptyValue(value) {
  return value === null || value === undefined || value === ''
}

function numericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed && /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return Number(trimmed)
  }
  return null
}

function compareNonEmpty(left, right) {
  const leftNumber = numericValue(left)
  const rightNumber = numericValue(right)
  if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber
  return formatCell(left).localeCompare(formatCell(right), 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })
}

export function sortRows(rows, key, direction = 'asc') {
  if (direction !== 'asc' && direction !== 'desc') throw new Error('排序方向只能是 asc 或 desc')
  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => {
    const left = a.row?.[key]
    const right = b.row?.[key]
    const leftEmpty = isEmptyValue(left)
    const rightEmpty = isEmptyValue(right)
    if (leftEmpty || rightEmpty) {
      if (leftEmpty && rightEmpty) return a.index - b.index
      return leftEmpty ? 1 : -1
    }
    const result = compareNonEmpty(left, right)
    const directed = direction === 'asc' ? result : -result
    return directed || a.index - b.index
  })
  return indexed.map(item => item.row)
}

export function filterRows(rows, query) {
  const needle = String(query ?? '')
    .trim()
    .toLocaleLowerCase()
  if (!needle) return rows.slice()
  return rows.filter(row => Object.values(row).some(value => formatCell(value).toLocaleLowerCase().includes(needle)))
}

const SAMPLE_CSV = `姓名,城市,年龄,职位
张三,北京,28,前端工程师
李四,上海,32,后端工程师
王五,深圳,25,产品经理
赵六,杭州,35,数据分析师`

function detectFileFormat(name) {
  return name.toLowerCase().endsWith('.json') ? 'json' : 'csv'
}

function readFileText(file) {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('无法读取文件'))
    reader.readAsText(file)
  })
}

function statCard(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('div', { className: 'stat-value', textContent: String(value) }),
    createElement('div', { className: 'stat-label', textContent: label })
  ])
}

export default {
  render(container) {
    let rows = []
    let columns = []
    let sortKey = ''
    let sortDirection = ''
    let timer = 0

    const formatSelect = createElement('select', { className: 'select', id: 'data-table-format', 'aria-label': '输入格式' }, [
      createElement('option', { value: 'auto', textContent: '自动识别' }),
      createElement('option', { value: 'csv', textContent: 'CSV' }),
      createElement('option', { value: 'json', textContent: 'JSON' })
    ])
    const fileInput = createElement('input', {
      className: 'input',
      id: 'data-table-file',
      type: 'file',
      accept: '.csv,.json,text/csv,application/json',
      'aria-label': '上传 CSV 或 JSON 文件'
    })
    const searchInput = createElement('input', {
      className: 'input',
      id: 'data-table-search',
      type: 'search',
      placeholder: '搜索任意列内容…',
      'aria-label': '搜索表格内容'
    })
    const input = createElement('textarea', {
      className: 'textarea',
      id: 'data-table-input',
      rows: 10,
      placeholder: '粘贴 CSV 或 JSON 数据，例如：\n姓名,城市,年龄\n张三,北京,28\n李四,上海,32',
      'aria-label': '数据输入'
    })
    const errorEl = createElement('div', { className: 'error-text' })
    const statsEl = createElement('div', { className: 'stats-row' })
    const tableMessage = createElement('p', { className: 'form-hint', id: 'data-table-message' })
    const tableHost = createElement('div')
    const hint = createElement('p', {
      className: 'form-hint',
      textContent: 'CSV 的第一行作为表头；JSON 支持对象数组或二维数组（二维数组的列名自动生成为“列1、列2…”）。'
    })

    const refresh = () => {
      const filtered = filterRows(rows, searchInput.value)
      const sorted = sortKey ? sortRows(filtered, sortKey, sortDirection || 'asc') : filtered
      const tooLarge = rows.length > LARGE_TABLE_ROWS
      const rendered = tooLarge ? sorted.slice(0, MAX_RENDER_ROWS) : sorted

      statsEl.replaceChildren(statCard('数据行数', rows.length), statCard('筛选后', filtered.length), statCard('已渲染', rendered.length))

      tableHost.replaceChildren()
      if (!rows.length) {
        tableMessage.textContent = '暂无数据，请粘贴 CSV/JSON 或上传文件。'
        return
      }
      if (!sorted.length) {
        tableMessage.textContent = `没有匹配“${searchInput.value.trim()}”的行。`
        return
      }
      tableMessage.textContent = tooLarge
        ? `数据共 ${rows.length} 行，为保持流畅仅渲染结果的前 ${MAX_RENDER_ROWS} 行；排序与搜索仍基于全部数据。`
        : `共 ${filtered.length} 行，点击表头可切换升序 / 降序。`

      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement(
            'tr',
            {},
            columns.map(column => {
              const active = column === sortKey
              const th = createElement('th', { scope: 'col' })
              th.setAttribute('aria-sort', active ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none')
              const arrow = active ? (sortDirection === 'desc' ? ' ▼' : ' ▲') : ''
              const button = createElement('button', {
                className: 'btn btn-secondary th-sort',
                type: 'button',
                textContent: column + arrow,
                'aria-label': `${column}，${active && sortDirection === 'desc' ? '当前降序，点击切换为升序' : active ? '当前升序，点击切换为降序' : '点击按此列升序排序'}`,
                onClick: () => {
                  if (sortKey !== column) {
                    sortKey = column
                    sortDirection = 'asc'
                  } else {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
                  }
                  refresh()
                }
              })
              th.appendChild(button)
              return th
            })
          )
        ]),
        createElement(
          'tbody',
          {},
          rendered.map(row =>
            createElement(
              'tr',
              {},
              columns.map(column => createElement('td', { textContent: formatCell(row[column]) }))
            )
          )
        )
      )
      tableHost.appendChild(table)
      createTableScroll(table, '数据表格，可横向滚动')
    }

    const parseInput = () => {
      errorEl.textContent = ''
      clearTimeout(timer)
      const source = input.value
      if (!source.trim()) {
        rows = []
        columns = []
        sortKey = ''
        sortDirection = ''
        refresh()
        return
      }
      try {
        rows = parseTableData(source, formatSelect.value)
        columns = collectColumns(rows)
        sortKey = ''
        sortDirection = ''
      } catch (cause) {
        rows = []
        columns = []
        sortKey = ''
        sortDirection = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
      refresh()
    }

    const scheduleParse = () => {
      clearTimeout(timer)
      timer = setTimeout(parseInput, 250)
    }

    input.addEventListener('input', scheduleParse)
    formatSelect.addEventListener('change', parseInput)
    searchInput.addEventListener('input', refresh)

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      try {
        const text = await readFileText(file)
        input.value = text
        formatSelect.value = detectFileFormat(file.name)
        parseInput()
      } catch (cause) {
        errorEl.textContent = `文件读取失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    })

    const parseBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '解析',
      onClick: parseInput
    })
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = SAMPLE_CSV
        formatSelect.value = 'csv'
        searchInput.value = ''
        parseInput()
      }
    })
    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        input.value = ''
        searchInput.value = ''
        fileInput.value = ''
        parseInput()
      }
    })

    container.append(
      createElement('div', { className: 'privacy-notice', textContent: '🔒 数据仅在当前浏览器中解析，不会上传到服务器。' }),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', for: 'data-table-format', textContent: '输入格式' }),
          formatSelect
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', for: 'data-table-file', textContent: '上传文件（.csv / .json）' }),
          fileInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', for: 'data-table-search', textContent: '搜索' }),
          searchInput
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [parseBtn, sampleBtn, clearBtn]),
      errorEl,
      hint,
      createSection('数据输入', input),
      createSection('数据表格', createElement('div', {}, [statsEl, tableMessage, tableHost]))
    )

    refresh()
  }
}
