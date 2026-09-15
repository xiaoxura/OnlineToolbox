import { createElement, createSection } from '../../utils/dom.js'
import Papa from 'papaparse'

// --- CSV structure toolbox --------------------------------------------------
// Everything is parsed with papaparse (header:false) into a plain 2D array, so
// the structural operations below are pure list transformations and the output
// is always re-serialised with correct quoting.

const DELIMITERS = [
  { value: ',', label: '逗号 (,)' },
  { value: '\t', label: '制表符 (Tab)' },
  { value: ';', label: '分号 (;)' },
  { value: '|', label: '竖线 (|)' }
]

export function detectDelimiter(text) {
  const source = String(text ?? '')
  if (!source.trim()) return ','
  const detected = Papa.parse(source, { header: false, preview: 5 }).meta?.delimiter
  return detected && detected.length === 1 ? detected : ','
}

export function parseCsv(text, delimiter = ',') {
  const source = String(text ?? '')
  if (!source.trim()) return []
  const options = { header: false, skipEmptyLines: false }
  if (delimiter && delimiter !== 'auto') options.delimiter = String(delimiter)
  const parsed = Papa.parse(source, options)
  // A single-column document legitimately has no detectable delimiter.
  const blocking = parsed.errors.find(error => error.code !== 'UndetectableDelimiter')
  if (blocking) throw new Error(`CSV 解析失败：${blocking.message}`)
  const rows = parsed.data.map(row => (Array.isArray(row) ? row : [row]).map(cell => (cell === null || cell === undefined ? '' : String(cell))))
  // papaparse reports the newline that ends the file as an extra empty row.
  while (rows.length && rows[rows.length - 1].every(cell => cell === '')) rows.pop()
  return rows
}

function quoteField(value, delimiter) {
  const text = value === null || value === undefined ? '' : String(value)
  if (text.includes(delimiter) || text.includes('"') || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(rows, delimiter = ',') {
  return rows.map(row => row.map(cell => quoteField(cell, delimiter)).join(delimiter)).join('\n')
}

export function transpose(rows) {
  if (!rows.length) return []
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const result = []
  for (let column = 0; column < width; column++) {
    result.push(rows.map(row => (row[column] === undefined ? '' : row[column])))
  }
  return result
}

export function convertDelimiter(text, from, to) {
  return toCsv(parseCsv(text, from), to)
}

// Column selectors are 0-based numbers or a name taken from the first row.
export function resolveColumnIndex(rows, selector) {
  if (typeof selector === 'number' && Number.isFinite(selector)) return selector
  const text = String(selector ?? '').trim()
  if (!text) return -1
  if (/^\d+$/.test(text)) return Number(text)
  const header = rows[0] || []
  return header.findIndex(cell => cell.trim() === text)
}

export function selectColumns(rows, indices) {
  const resolved = (Array.isArray(indices) ? indices : [indices])
    .map(selector => resolveColumnIndex(rows, selector))
    .filter(index => index >= 0)
  return rows.map(row => resolved.map(index => (row[index] === undefined ? '' : row[index])))
}

export function swapColumns(rows, a, b) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const left = resolveColumnIndex(rows, a)
  const right = resolveColumnIndex(rows, b)
  if (left < 0 || right < 0 || left >= width || right >= width) throw new Error('要交换的列不存在，请检查列序号或列名')
  return rows.map(row => {
    const next = [...row]
    const width = Math.max(next.length, left + 1, right + 1)
    while (next.length < width) next.push('')
    const value = next[left]
    next[left] = next[right]
    next[right] = value
    return next
  })
}

export function addColumn(rows, name, value, options = {}) {
  const useHeader = options.header ?? Boolean(name && String(name).trim())
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const valueAt = (index, row) => (typeof value === 'function' ? value(index, row) : value)
  return rows.map((row, index) => {
    const next = [...row]
    while (next.length < width) next.push('')
    const cell = useHeader && index === 0 ? name : valueAt(index, row)
    next.push(cell === null || cell === undefined ? '' : String(cell))
    return next
  })
}

const OPERATIONS = [
  { value: 'transpose', label: '转置（行列互换）' },
  { value: 'delimiter', label: '分隔符转换' },
  { value: 'keep', label: '保留列' },
  { value: 'drop', label: '删除列' },
  { value: 'swap', label: '交换列' },
  { value: 'add', label: '添加列' },
  { value: 'csv-tsv', label: 'CSV 转 TSV' },
  { value: 'tsv-csv', label: 'TSV 转 CSV' }
]

const SAMPLE_CSV = `姓名,城市,邮箱
张三,北京,zhang@example.com
李四,"上海, 浦东",li@example.com
王五,深圳,wang@example.com`

// Turn the visible, 1-based "1,3" / "姓名" field into selectors.
function parseSelectors(text) {
  return String(text ?? '')
    .split(/[,，;；\s]+/)
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => (/^\d+$/.test(token) ? Number(token) - 1 : token))
}

function formGroup(labelText, control) {
  return createElement('div', { className: 'form-group' }, [
    createElement('label', { className: 'label', textContent: labelText }),
    control
  ])
}

export default {
  id: 'csv-toolbox',
  name: 'CSV 工具箱',
  description: 'CSV 转置、分隔符转换、列的增删与交换',
  category: 'converter',
  icon: 'json',
  keywords: ['csv', 'tsv', '转置', '列操作', '分隔符'],
  render(container) {
    const sourceDelimiter = createElement('select', { className: 'select', 'aria-label': '输入分隔符' }, [
      createElement('option', { value: 'auto', textContent: '自动检测' }),
      ...DELIMITERS.map(item => createElement('option', { value: item.value, textContent: item.label }))
    ])
    const operation = createElement('select', { className: 'select', 'aria-label': '操作' },
      OPERATIONS.map(item => createElement('option', { value: item.value, textContent: item.label })))

    const paramsEl = createElement('div', { className: 'form-row' })
    let readParams = () => ({})

    const input = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      placeholder: '粘贴 CSV / TSV 数据，例如:\n姓名,城市\n张三,北京'
    })
    const output = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      readOnly: true,
      placeholder: '处理结果将显示在此…'
    })
    const errorEl = createElement('div', { className: 'error-text' })

    const operationHint = createElement('p', { className: 'form-hint' })

    function buildParams() {
      paramsEl.replaceChildren()
      readParams = () => ({})
      const current = operation.value

      const hint = text => {
        operationHint.textContent = text
      }

      if (current === 'transpose') {
        hint('把行变成列、列变成行，缺失的单元格补空。')
        return
      }
      if (current === 'csv-tsv' || current === 'tsv-csv') {
        hint(current === 'csv-tsv' ? '按 CSV 解析后以制表符输出。' : '按制表符解析后以逗号输出。')
        return
      }
      if (current === 'delimiter') {
        const target = createElement('select', { className: 'select', 'aria-label': '目标分隔符' },
          DELIMITERS.map(item => createElement('option', { value: item.value, textContent: item.label })))
        target.value = '\t'
        paramsEl.append(formGroup('目标分隔符', target))
        readParams = () => ({ target: target.value })
        hint('只改变分隔符，单元格内容保持不变。')
        return
      }
      if (current === 'add') {
        const name = createElement('input', { className: 'input', type: 'text', value: '序号', 'aria-label': '新列名' })
        const mode = createElement('select', { className: 'select', 'aria-label': '新列取值方式' }, [
          createElement('option', { value: 'increment', textContent: '递增编号' }),
          createElement('option', { value: 'constant', textContent: '固定值' })
        ])
        const valueInput = createElement('input', { className: 'input', type: 'text', value: '1', 'aria-label': '起始值或固定值' })
        paramsEl.append(
          formGroup('新列名', name),
          formGroup('取值方式', mode),
          formGroup('起始值 / 固定值', valueInput)
        )
        readParams = () => ({ name: name.value, mode: mode.value, value: valueInput.value })
        hint('列名会写入第一行（作为表头）；递增编号从起始值开始，逐行加一。')
        return
      }

      // keep / drop / swap all work from one column list.
      const columns = createElement('input', {
        className: 'input',
        type: 'text',
        value: current === 'swap' ? '1,2' : '1',
        'aria-label': '列序号或列名'
      })
      const columnInput = formGroup(current === 'swap' ? '交换这两列' : current === 'keep' ? '保留这些列' : '删除这些列', columns)
      paramsEl.append(columnInput)

      if (current === 'swap') {
        readParams = () => {
          const selectors = parseSelectors(columns.value)
          if (selectors.length !== 2) throw new Error('交换列需要填写两列，例如 1,3')
          return { left: selectors[0], right: selectors[1] }
        }
        hint('填写两个列序号（从 1 开始）或列名，用逗号分隔。')
      } else {
        readParams = () => {
          const selectors = parseSelectors(columns.value)
          if (!selectors.length) throw new Error('请填写列序号或列名，例如 1,3 或 姓名')
          return { selectors }
        }
        hint('列序号从 1 开始，也可以用首行的列名，多个值用逗号分隔，例如 1,3 或 姓名,邮箱。')
      }
    }

    function convert(text) {
      const source = sourceDelimiter.value === 'auto' ? detectDelimiter(text) : sourceDelimiter.value
      const current = operation.value

      if (current === 'tsv-csv') return toCsv(parseCsv(text, '\t'), ',')
      if (current === 'csv-tsv') return toCsv(parseCsv(text, source), '\t')

      const rows = parseCsv(text, source)
      if (!rows.length) throw new Error('CSV 数据为空')
      const params = readParams()

      switch (current) {
        case 'transpose':
          return toCsv(transpose(rows), source)
        case 'delimiter':
          return convertDelimiter(text, source, params.target)
        case 'keep': {
          const resolved = params.selectors.map(selector => resolveColumnIndex(rows, selector))
          if (resolved.every(index => index < 0)) throw new Error('未找到匹配的列，请检查列序号或列名')
          return toCsv(selectColumns(rows, params.selectors), source)
        }
        case 'drop': {
          const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
          const dropped = new Set(params.selectors.map(selector => resolveColumnIndex(rows, selector)))
          const kept = []
          for (let index = 0; index < width; index++) if (!dropped.has(index)) kept.push(index)
          if (!kept.length) throw new Error('不能删除全部列')
          return toCsv(selectColumns(rows, kept), source)
        }
        case 'swap':
          return toCsv(swapColumns(rows, params.left, params.right), source)
        case 'add': {
          const useHeader = Boolean(params.name.trim())
          const parsedStart = Number(params.value)
          const start = Number.isFinite(parsedStart) ? parsedStart : 1
          // The first row is the header, so the first data row carries 起始值.
          const value = params.mode === 'increment'
            ? index => String(start + index - (useHeader ? 1 : 0))
            : params.value
          return toCsv(addColumn(rows, params.name, value, { header: useHeader }), source)
        }
        default:
          return ''
      }
    }

    function run() {
      errorEl.textContent = ''
      if (!input.value.trim()) {
        output.value = ''
        return
      }
      try {
        output.value = convert(input.value)
      } catch (cause) {
        output.value = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '处理',
      onClick: run
    })
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = SAMPLE_CSV
        run()
      }
    })

    operation.addEventListener('change', () => {
      buildParams()
      run()
    })
    sourceDelimiter.addEventListener('change', run)
    input.addEventListener('input', run)
    // Param controls are rebuilt per operation, so listen on the container.
    paramsEl.addEventListener('input', run)
    paramsEl.addEventListener('change', run)

    buildParams()

    container.append(
      createElement('div', { className: 'form-row' }, [
        formGroup('输入分隔符', sourceDelimiter),
        formGroup('操作', operation)
      ]),
      paramsEl,
      operationHint,
      createElement('div', { className: 'btn-group' }, [convertBtn, sampleBtn]),
      errorEl,
      createSection('CSV 输入', input),
      createSection('处理结果', output)
    )
  }
}
