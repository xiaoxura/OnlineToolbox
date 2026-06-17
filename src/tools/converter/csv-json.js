import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'csv-json',
  name: 'CSV 转 JSON',
  description: '将 CSV 格式转换为 JSON 数组，支持自动检测分隔符',
  category: 'converter',
  icon: 'json',
  render(container) {
    // Separator option
    const separatorLabel = createElement('label', { className: 'label', textContent: '分隔符:' })
    const separatorSelect = createElement('select', { className: 'input' }, [
      createElement('option', { value: 'auto', textContent: '自动检测' }),
      createElement('option', { value: ',', textContent: '逗号 (,)' }),
      createElement('option', { value: '\t', textContent: '制表符 (Tab)' }),
      createElement('option', { value: ';', textContent: '分号 (;)' })
    ])

    // Header option
    const headerLabel = createElement('label', { className: 'label', textContent: '首行为表头:' })
    const headerCheckbox = createElement('input', { type: 'checkbox' })
    headerCheckbox.checked = true

    const optionRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [separatorLabel, separatorSelect]),
      createElement('div', { className: 'form-group' }, [headerLabel, headerCheckbox])
    ])

    // Input textarea
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 CSV 数据，例如:\nname,age,city\n张三,28,北京\n李四,32,上海',
      rows: 12
    })

    // Output textarea
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: 'JSON 结果将显示在此...',
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
          errorEl.textContent = '请输入 CSV 数据'
          return
        }

        try {
          const separatorValue = separatorSelect.value
          const separator = separatorValue === 'auto' ? detectSeparator(input) : separatorValue
          const useHeader = headerCheckbox.checked
          const lines = parseCsvLines(input, separator)

          if (lines.length === 0) {
            errorEl.textContent = 'CSV 数据为空'
            outputTextarea.value = ''
            return
          }

          let result
          if (useHeader) {
            const headers = lines[0]
            const dataLines = lines.slice(1)
            result = dataLines.map(line => {
              const obj = {}
              headers.forEach((header, i) => {
                const val = line[i] !== undefined ? line[i] : ''
                obj[header] = inferType(val)
              })
              return obj
            })
          } else {
            result = lines.map(line => line.map(val => inferType(val)))
          }

          outputTextarea.value = JSON.stringify(result, null, 2)
        } catch (e) {
          errorEl.textContent = 'CSV 解析错误: ' + e.message
          outputTextarea.value = ''
        }
      }
    })

    // Sample button
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = 'name,age,city,hobbies\n张三,28,北京,"读书,游泳"\n李四,32,上海,"编程,音乐"\n王五,25,深圳,摄影'
      }
    })

    const btnRow = createElement('div', { className: 'btn-group' }, [convertBtn, sampleBtn])

    const copyInputBtn = createCopyButton(() => inputTextarea.value)
    const copyOutputBtn = createCopyButton(() => outputTextarea.value)

    const inputSection = createSection('CSV 输入', inputTextarea, [copyInputBtn])
    const outputSection = createSection('JSON 输出', outputTextarea, [copyOutputBtn])

    container.appendChild(optionRow)
    container.appendChild(btnRow)
    container.appendChild(errorEl)
    container.appendChild(inputSection)
    container.appendChild(outputSection)
  }
}

// Detect the most likely separator by counting occurrences in the first few lines
function detectSeparator(text) {
  const candidates = [',', '\t', ';']
  const lines = text.split('\n').slice(0, 5)
  let best = ','
  let bestCount = 0

  for (const sep of candidates) {
    const counts = lines.map(line => {
      let count = 0
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inQuotes = !inQuotes
        } else if (!inQuotes && line[i] === sep) {
          count++
        }
      }
      return count
    })

    // The separator should appear consistently across lines
    const first = counts[0]
    if (first > 0 && counts.every(c => c === first) && first > bestCount) {
      bestCount = first
      best = sep
    }
  }

  return best
}

// Parse CSV text into a 2D array of fields, handling quoted fields
function parseCsvLines(text, separator) {
  const lines = []
  let currentLine = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          currentField += '"'
          i += 2
        } else {
          // End of quoted field
          inQuotes = false
          i++
        }
      } else {
        currentField += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === separator) {
        currentLine.push(currentField)
        currentField = ''
        i++
      } else if (ch === '\r') {
        // Skip carriage return
        i++
      } else if (ch === '\n') {
        currentLine.push(currentField)
        if (currentLine.length > 0 && !(currentLine.length === 1 && currentLine[0] === '')) {
          lines.push(currentLine)
        }
        currentLine = []
        currentField = ''
        i++
      } else {
        currentField += ch
        i++
      }
    }
  }

  // Last field and line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField)
    if (currentLine.length > 0 && !(currentLine.length === 1 && currentLine[0] === '')) {
      lines.push(currentLine)
    }
  }

  return lines
}

// Infer the type of a string value for JSON output
function inferType(value) {
  if (value === '') return ''
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null' || value === 'NULL') return null
  // Try number
  if (value !== '' && !isNaN(value) && !isNaN(parseFloat(value))) {
    return parseFloat(value)
  }
  return value
}
