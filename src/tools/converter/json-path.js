import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'json-path',
  name: 'JSONPath 查询',
  description: '使用 JSONPath 表达式查询 JSON 数据',
  category: 'converter',
  icon: 'search',
  render(container) {
    // JSONPath expression input
    const pathLabel = createElement('label', { className: 'label', textContent: 'JSONPath 表达式:' })
    const pathInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '$.store.book[0].title',
      value: '$'
    })

    const pathGroup = createElement('div', { className: 'form-group' }, [pathLabel, pathInput])

    // Quick expression buttons
    const quickRootBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '$',
      onClick: () => { pathInput.value = '$' }
    })
    const quickWildcardBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '$.*',
      onClick: () => { pathInput.value = '$.*' }
    })
    const quickRecursiveBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '$.**.key',
      onClick: () => { pathInput.value = '$.**.key' }
    })

    const quickRow = createElement('div', { className: 'btn-group' }, [quickRootBtn, quickWildcardBtn, quickRecursiveBtn])

    // Input textarea
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 JSON 数据...',
      rows: 14
    })

    // Result display
    const resultBox = createElement('div', { className: 'result-box' })

    // Error display
    const errorEl = createElement('div', { className: 'error-text' })

    // Query button
    const queryBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '查询',
      onClick: () => {
        errorEl.textContent = ''
        resultBox.innerHTML = ''
        const input = inputTextarea.value.trim()
        const path = pathInput.value.trim()

        if (!input) {
          errorEl.textContent = '请输入 JSON 数据'
          return
        }
        if (!path) {
          errorEl.textContent = '请输入 JSONPath 表达式'
          return
        }

        try {
          const data = JSON.parse(input)
          const matches = jsonPathQuery(data, path)

          if (matches.length === 0) {
            resultBox.appendChild(createElement('div', {
              className: 'inline-result',
              textContent: '未找到匹配结果'
            }))
            return
          }

          for (const match of matches) {
            const row = createElement('div', { className: 'inline-result' }, [
              createElement('span', { className: 'label', textContent: match.path + ' : ' }),
              createElement('span', { textContent: formatValue(match.value) })
            ])
            resultBox.appendChild(row)
          }
        } catch (e) {
          errorEl.textContent = '错误: ' + e.message
        }
      }
    })

    // Sample button
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = JSON.stringify({
          store: {
            book: [
              { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
              { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
              { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', price: 8.99 }
            ],
            bicycle: { color: 'red', price: 19.95 }
          }
        }, null, 2)
        pathInput.value = '$.store.book[0].title'
      }
    })

    const btnRow = createElement('div', { className: 'btn-group' }, [queryBtn, sampleBtn])

    const copyInputBtn = createCopyButton(() => inputTextarea.value)
    const copyResultBtn = createCopyButton(() => resultBox.textContent)

    const inputSection = createSection('JSON 输入', inputTextarea, [copyInputBtn])
    const resultSection = createSection('查询结果', resultBox, [copyResultBtn])

    container.appendChild(pathGroup)
    container.appendChild(quickRow)
    container.appendChild(btnRow)
    container.appendChild(errorEl)
    container.appendChild(inputSection)
    container.appendChild(resultSection)
  }
}

// Format a value for display
function formatValue(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// Basic JSONPath query implementation
function jsonPathQuery(data, path) {
  // Normalize the path
  if (!path.startsWith('$')) {
    throw new Error('JSONPath 必须以 $ 开头')
  }

  const segments = parsePath(path.slice(1)) // remove leading $
  const results = []
  resolve(data, segments, 0, '$', results)
  return results
}

// Parse the path string into segments
// Supports: .key, [n], [*], .**.key (recursive descent)
function parsePath(pathStr) {
  const segments = []
  let i = 0
  const s = pathStr

  while (i < s.length) {
    if (s[i] === '.') {
      i++
      if (i < s.length && s[i] === '.' && i + 1 < s.length && s[i + 1] === '*') {
        // .** pattern
        i += 2 // skip **
        // Read the key after **
        let key = ''
        if (i < s.length && s[i] === '.') {
          i++
          while (i < s.length && s[i] !== '.' && s[i] !== '[') {
            key += s[i]
            i++
          }
        }
        segments.push({ type: 'recursive', key: key || null })
      } else {
        // Regular key
        let key = ''
        while (i < s.length && s[i] !== '.' && s[i] !== '[') {
          key += s[i]
          i++
        }
        if (key) {
          segments.push({ type: 'key', key })
        }
      }
    } else if (s[i] === '[') {
      i++
      if (s[i] === '*') {
        segments.push({ type: 'wildcard' })
        i++ // skip *
        if (i < s.length && s[i] === ']') i++ // skip ]
      } else {
        let index = ''
        while (i < s.length && s[i] !== ']') {
          index += s[i]
          i++
        }
        if (i < s.length && s[i] === ']') i++
        // Support quoted keys like ['key']
        const trimmed = index.trim()
        if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
          segments.push({ type: 'key', key: trimmed.slice(1, -1) })
        } else {
          segments.push({ type: 'index', index: parseInt(trimmed, 10) })
        }
      }
    } else {
      // Bare key (should not happen after $., but handle gracefully)
      let key = ''
      while (i < s.length && s[i] !== '.' && s[i] !== '[') {
        key += s[i]
        i++
      }
      if (key) {
        segments.push({ type: 'key', key })
      }
    }
  }

  return segments
}

// Resolve segments recursively, collecting matches
function resolve(value, segments, segIndex, currentPath, results) {
  if (segIndex >= segments.length) {
    results.push({ path: currentPath, value })
    return
  }

  const seg = segments[segIndex]

  if (seg.type === 'key') {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && seg.key in value) {
      resolve(value[seg.key], segments, segIndex + 1, currentPath + '.' + seg.key, results)
    }
  } else if (seg.type === 'index') {
    if (Array.isArray(value) && seg.index >= 0 && seg.index < value.length) {
      resolve(value[seg.index], segments, segIndex + 1, currentPath + '[' + seg.index + ']', results)
    }
  } else if (seg.type === 'wildcard') {
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        resolve(item, segments, segIndex + 1, currentPath + '[' + i + ']', results)
      })
    } else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        resolve(v, segments, segIndex + 1, currentPath + '.' + k, results)
      }
    }
  } else if (seg.type === 'recursive') {
    // Recursive descent: search through all nested values
    recursiveSearch(value, segments, segIndex, currentPath, results, seg.key)
  }
}

// Recursively search through all levels of the value
function recursiveSearch(value, segments, segIndex, currentPath, results, targetKey) {
  // First check if the current value matches (if targetKey is specified)
  if (targetKey && value !== null && typeof value === 'object' && !Array.isArray(value) && targetKey in value) {
    resolve(value[targetKey], segments, segIndex + 1, currentPath + '.' + targetKey, results)
  }

  // Also check the current value as a potential match for the remaining path
  if (!targetKey) {
    resolve(value, segments, segIndex + 1, currentPath, results)
  }

  // Recurse into children
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      recursiveSearch(item, segments, segIndex, currentPath + '[' + i + ']', results, targetKey)
    })
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (!targetKey || k !== targetKey) {
        recursiveSearch(v, segments, segIndex, currentPath + '.' + k, results, targetKey)
      }
    }
  }
}
