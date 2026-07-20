import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'
import Papa from 'papaparse'

function parseDelimited(text, delimiter) {
  const parsed = Papa.parse(text, { delimiter, skipEmptyLines: 'greedy' })
  if (parsed.errors.length) throw new Error(`分隔数据解析失败：${parsed.errors[0].message}`)
  return parsed.data
}

function escapeCell(value) {
  return String(value)
    .trim()
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replaceAll('|', '\\|')
}

export default {
  id: 'markdown-table',
  name: 'Markdown 表格生成',
  description: '将 CSV、TSV 或竖线分隔数据转换为 Markdown 表格',
  category: 'text',
  icon: 'json-csv',
  render(container) {
    const delimiter = createElement('select', { className: 'select', 'aria-label': '输入分隔符' }, [
      createElement('option', { value: ',', textContent: '逗号（CSV）' }),
      createElement('option', { value: '\t', textContent: '制表符（TSV）' }),
      createElement('option', { value: '|', textContent: '竖线（|）' })
    ])
    const alignment = createElement('select', { className: 'select', 'aria-label': '表格对齐方式' }, [
      createElement('option', { value: 'left', textContent: '左对齐' }),
      createElement('option', { value: 'center', textContent: '居中对齐' }),
      createElement('option', { value: 'right', textContent: '右对齐' })
    ])
    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '输入格式' }), delimiter]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '列对齐' }), alignment])
    ])
    const state = renderTextTransform(container, {
      inputTitle: '表格数据',
      outputTitle: 'Markdown',
      inputPlaceholder: 'name,language,stars\nVite,JavaScript,70000',
      actionLabel: '生成表格',
      sample: '项目,语言,用途\nVite,JavaScript,构建工具\nVitest,TypeScript,单元测试',
      options,
      transform(text) {
        const rows = parseDelimited(text, delimiter.value).map(row => row.map(escapeCell))
        if (!rows.length) return ''
        const columns = Math.max(...rows.map(row => row.length))
        rows.forEach(row => { while (row.length < columns) row.push('') })
        const marker = alignment.value === 'center' ? ':---:' : alignment.value === 'right' ? '---:' : ':---'
        const renderRow = row => `| ${row.join(' | ')} |`
        return [renderRow(rows[0]), renderRow(Array(columns).fill(marker)), ...rows.slice(1).map(renderRow)].join('\n')
      }
    })
    delimiter.addEventListener('change', state.run)
    alignment.addEventListener('change', state.run)
  }
}
