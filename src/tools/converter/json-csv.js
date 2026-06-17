import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'json-csv',
  name: 'JSON 转 CSV',
  description: '将 JSON 数组转换为 CSV 格式，支持嵌套对象',
  category: 'converter',
  icon: 'json',
  render(container) {
    // Separator option
    const separatorLabel = createElement('label', { className: 'label', textContent: '分隔符:' })
    const separatorSelect = createElement('select', { className: 'input' }, [
      createElement('option', { value: ',', textContent: '逗号 (,)' }),
      createElement('option', { value: '\t', textContent: '制表符 (Tab)' }),
      createElement('option', { value: ';', textContent: '分号 (;)' })
    ])

    // Header option
    const headerLabel = createElement('label', { className: 'label', textContent: '包含表头:' })
    const headerCheckbox = createElement('input', { type: 'checkbox' })
    headerCheckbox.checked = true

    const separatorRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [separatorLabel, separatorSelect]),
      createElement('div', { className: 'form-group' }, [headerLabel, headerCheckbox])
    ])

    // Input textarea
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 JSON 数组，例如:\n[\n  { "name": "张三", "age": 28, "address.city": "北京" },\n  { "name": "李四", "age": 32, "address.city": "上海" }\n]',
      rows: 12
    })

    // Output textarea
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: 'CSV 结果将显示在此...',
      rows: 12,
      readOnly: true
    })

    // Error display
    const errorEl = createElement('div', { className: 'error-text' })

    // Convert button
    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '转换',
      onClick: () => {
        errorEl.textContent = ''
        const input = inputTextarea.value.trim()
        if (!input) {
          errorEl.textContent = '请输入 JSON 数据'
          return
        }

        try {
          const data = JSON.parse(input)
          if (!Array.isArray(data)) {
            errorEl.textContent = '请输入 JSON 数组（以 [ 开头）'
            outputTextarea.value = ''
            return
          }

          if (data.length === 0) {
            errorEl.textContent = 'JSON 数组为空'
            outputTextarea.value = ''
            return
          }

          const separator = separatorSelect.value
          const includeHeader = headerCheckbox.checked

          // Flatten nested objects with dot notation
          const flatData = data.map(item => flattenObject(item))
          const headers = [...new Set(flatData.flatMap(item => Object.keys(item)))]

          const lines = []
          if (includeHeader) {
            lines.push(headers.map(h => escapeCsvField(h, separator)).join(separator))
          }

          for (const row of flatData) {
            const values = headers.map(h => {
              const val = row[h]
              return escapeCsvField(val === undefined ? '' : String(val), separator)
            })
            lines.push(values.join(separator))
          }

          outputTextarea.value = lines.join('\n')
        } catch (e) {
          errorEl.textContent = 'JSON 解析错误: ' + e.message
          outputTextarea.value = ''
        }
      }
    })

    // Sample button
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = JSON.stringify([
          { name: '张三', age: 28, address: { city: '北京', district: '海淀区' } },
          { name: '李四', age: 32, address: { city: '上海', district: '浦东新区' } },
          { name: '王五', age: 25, address: { city: '深圳', district: '南山区' } }
        ], null, 2)
      }
    })

    const btnRow = createElement('div', { className: 'btn-group' }, [convertBtn, sampleBtn])

    const copyInputBtn = createCopyButton(() => inputTextarea.value)
    const copyOutputBtn = createCopyButton(() => outputTextarea.value)

    const inputSection = createSection('JSON 输入', inputTextarea, [copyInputBtn])
    const outputSection = createSection('CSV 输出', outputTextarea, [copyOutputBtn])

    container.appendChild(separatorRow)
    container.appendChild(btnRow)
    container.appendChild(errorEl)
    container.appendChild(inputSection)
    container.appendChild(outputSection)
  }
}

// Flatten nested object with dot notation keys
function flattenObject(obj, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey))
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value)
    } else {
      result[newKey] = value
    }
  }
  return result
}

// Escape a CSV field, quoting if necessary
function escapeCsvField(field, separator) {
  const str = String(field)
  if (str.includes(separator) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}
