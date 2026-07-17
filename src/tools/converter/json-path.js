import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'json-path',
  name: 'JSONPath 查询',
  description: '使用 JSONPath 表达式查询 JSON 数据，支持点击 JSON 树节点获取路径',
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
      onClick: () => { pathInput.value = '$'; runQuery() }
    })
    const quickWildcardBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '$.*',
      onClick: () => { pathInput.value = '$.*'; runQuery() }
    })
    const quickRecursiveBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '$.**.key',
      onClick: () => { pathInput.value = '$.**.key'; runQuery() }
    })

    const quickRow = createElement('div', { className: 'btn-group' }, [quickRootBtn, quickWildcardBtn, quickRecursiveBtn])

    // Input textarea
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 JSON 数据...',
      rows: 10
    })

    // JSON Tree container
    const treeContainer = createElement('div', {
      className: 'json-tree-container'
    })

    // Selected path display
    const selectedPathDisplay = createElement('button', {
      className: 'inline-result json-selected-path',
      type: 'button',
      hidden: true,
      title: '点击复制路径'
    })
    selectedPathDisplay.addEventListener('click', () => {
      if (pathInput.value) {
        copyToClipboard(pathInput.value)
        selectedPathDisplay.classList.add('copied')
        setTimeout(() => selectedPathDisplay.classList.remove('copied'), 500)
      }
    })

    // Result display
    const resultBox = createElement('div', { className: 'result-box' })

    // Error display
    const errorEl = createElement('div', { className: 'error-text' })

    // Current parsed data
    let currentData = null

    function renderTreeMessage(message, isError = false) {
      treeContainer.replaceChildren(createElement('div', {
        className: `json-tree-empty${isError ? ' error' : ''}`,
        textContent: message
      }))
    }

    // Build JSON tree recursively
    function buildJsonTree(data, path, depth = 0) {
      const wrapper = createElement('div', { className: depth > 0 ? 'json-tree-branch' : '' })

      if (data === null) {
        const node = createTreeNode(path, 'null', 'json-null')
        wrapper.appendChild(node)
        return wrapper
      }

      if (typeof data !== 'object') {
        const node = createTreeNode(path, formatPrimitive(data), 'json-' + typeof data)
        wrapper.appendChild(node)
        return wrapper
      }

      if (Array.isArray(data)) {
        const isArray = true
        const openBracket = '['
        const closeBracket = ']'

        if (data.length === 0) {
          const node = createTreeNode(path, '[]', 'json-bracket')
          wrapper.appendChild(node)
          return wrapper
        }

        // Collapsed header
        const header = createElement('div', { className: 'json-tree-node', role: 'button', tabindex: '0' })
        const toggle = createElement('button', {
          className: 'json-toggle',
          type: 'button',
          'aria-label': '折叠或展开数组',
          'aria-expanded': 'true',
          textContent: '▼',
        })
        const keySpan = createElement('span', { className: 'json-bracket', textContent: openBracket })
        const preview = createElement('span', {
          className: 'json-preview',
          textContent: ` ${data.length} items...`
        })
        const closeSpan = createElement('span', { className: 'json-bracket', textContent: closeBracket })

        header.appendChild(toggle)
        header.appendChild(keySpan)
        header.appendChild(preview)
        header.appendChild(closeSpan)

        // Children container
        const children = createElement('div', { className: 'json-tree-children' })

        data.forEach((item, index) => {
          const itemPath = path + '[' + index + ']'
          const row = createElement('div', { className: 'json-tree-row' })
          const indexSpan = createElement('span', {
            className: 'json-index',
            textContent: index + ': '
          })
          const childTree = buildJsonTree(item, itemPath, depth + 1)
          row.appendChild(indexSpan)
          row.appendChild(childTree)
          children.appendChild(row)
        })

        // Close bracket
        const closeRow = createElement('div')
        closeRow.appendChild(createElement('span', { className: 'json-bracket', textContent: closeBracket }))
        children.appendChild(closeRow)

        // Toggle logic
        let collapsed = false
        toggle.addEventListener('click', (e) => {
          e.stopPropagation()
          collapsed = !collapsed
          children.style.display = collapsed ? 'none' : ''
          preview.style.display = collapsed ? 'inline' : 'none'
          toggle.style.transform = collapsed ? 'rotate(-90deg)' : ''
          toggle.setAttribute('aria-expanded', String(!collapsed))
        })

        // Click header to select path
        header.addEventListener('click', (e) => {
          if (e.target === toggle) return
          selectPath(path, data)
        })
        header.addEventListener('keydown', (e) => {
          if (e.target !== header || !['Enter', ' '].includes(e.key)) return
          e.preventDefault()
          selectPath(path, data)
        })

        wrapper.appendChild(header)
        wrapper.appendChild(children)
        return wrapper
      }

      // Object
      const keys = Object.keys(data)
      if (keys.length === 0) {
        const node = createTreeNode(path, '{}', 'json-bracket')
        wrapper.appendChild(node)
        return wrapper
      }

      const header = createElement('div', { className: 'json-tree-node', role: 'button', tabindex: '0' })
      const toggle = createElement('button', {
        className: 'json-toggle',
        type: 'button',
        'aria-label': '折叠或展开对象',
        'aria-expanded': 'true',
        textContent: '▼',
      })
      const openBrace = createElement('span', { className: 'json-bracket', textContent: '{' })
      const preview = createElement('span', {
        className: 'json-preview',
        textContent: ` ${keys.length} keys...`
      })
      const closeBrace = createElement('span', { className: 'json-bracket', textContent: '}' })

      header.appendChild(toggle)
      header.appendChild(openBrace)
      header.appendChild(preview)
      header.appendChild(closeBrace)

      const children = createElement('div', { className: 'json-tree-children' })

      keys.forEach(key => {
        const childPath = path + '.' + key
        const row = createElement('div', { className: 'json-tree-row' })
        const keySpan = createElement('button', {
          className: 'json-key',
          type: 'button',
          textContent: key + ': ',
          title: '点击选中此字段的路径'
        })
        keySpan.addEventListener('click', (e) => {
          e.stopPropagation()
          selectPath(childPath, data[key])
        })

        const childTree = buildJsonTree(data[key], childPath, depth + 1)
        row.appendChild(keySpan)
        row.appendChild(childTree)
        children.appendChild(row)
      })

      const closeRow = createElement('div')
      closeRow.appendChild(createElement('span', { className: 'json-bracket', textContent: '}' }))
      children.appendChild(closeRow)

      let collapsed = false
      toggle.addEventListener('click', (e) => {
        e.stopPropagation()
        collapsed = !collapsed
        children.style.display = collapsed ? 'none' : ''
        preview.style.display = collapsed ? 'inline' : 'none'
        toggle.style.transform = collapsed ? 'rotate(-90deg)' : ''
        toggle.setAttribute('aria-expanded', String(!collapsed))
      })

      header.addEventListener('click', (e) => {
        if (e.target === toggle) return
        selectPath(path, data)
      })
      header.addEventListener('keydown', (e) => {
        if (e.target !== header || !['Enter', ' '].includes(e.key)) return
        e.preventDefault()
        selectPath(path, data)
      })

      wrapper.appendChild(header)
      wrapper.appendChild(children)
      return wrapper
    }

    function createTreeNode(path, value, className) {
      const node = createElement('div', { className: 'json-tree-node', role: 'button', tabindex: '0' })
      const valSpan = createElement('span', { className: className, textContent: value })
      node.appendChild(valSpan)
      node.addEventListener('click', () => selectPath(path, null))
      node.addEventListener('keydown', (event) => {
        if (!['Enter', ' '].includes(event.key)) return
        event.preventDefault()
        selectPath(path, null)
      })
      return node
    }

    function formatPrimitive(value) {
      if (typeof value === 'string') return '"' + value + '"'
      return String(value)
    }

    // Select a path in the tree
    function selectPath(path, value) {
      // Update path input
      pathInput.value = path

      // Highlight selected node
      treeContainer.querySelectorAll('.json-tree-selected').forEach(el => {
        el.classList.remove('json-tree-selected')
        el.style.background = ''
        el.style.borderRadius = ''
      })

      // Find and highlight the clicked node
      // Show selected path
      selectedPathDisplay.hidden = false
      selectedPathDisplay.innerHTML = `<strong>选中路径:</strong> <code>${escapeHtml(path)}</code> <span>(点击复制)</span>`

      // Run query with the selected path
      runQuery()
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    // Query button
    const queryBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '查询',
      onClick: runQuery
    })

    // Sample button
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
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
        parseAndRenderTree()
        runQuery()
      }
    })

    // Clear button
    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '清空',
      onClick: () => {
        inputTextarea.value = ''
        pathInput.value = '$'
        renderTreeMessage('请粘贴 JSON 数据')
        resultBox.innerHTML = ''
        errorEl.textContent = ''
        selectedPathDisplay.hidden = true
        currentData = null
      }
    })

    const btnRow = createElement('div', { className: 'btn-group' }, [queryBtn, sampleBtn, clearBtn])

    const copyInputBtn = createCopyButton(() => inputTextarea.value)
    const copyResultBtn = createCopyButton(() => resultBox.textContent)

    // Parse JSON and render tree
    function parseAndRenderTree() {
      const input = inputTextarea.value.trim()
      treeContainer.innerHTML = ''
      errorEl.textContent = ''
      currentData = null

      if (!input) {
        renderTreeMessage('请粘贴 JSON 数据')
        return
      }

      try {
        currentData = JSON.parse(input)
        const tree = buildJsonTree(currentData, '$')
        treeContainer.innerHTML = ''
        treeContainer.appendChild(tree)
      } catch (e) {
        renderTreeMessage('JSON 解析错误: ' + e.message, true)
        errorEl.textContent = 'JSON 解析错误: ' + e.message
      }
    }

    // Auto-parse on input
    let parseTimer = null
    inputTextarea.addEventListener('input', () => {
      clearTimeout(parseTimer)
      parseTimer = setTimeout(parseAndRenderTree, 300)
    })

    function runQuery() {
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
        const data = currentData || JSON.parse(input)
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

    const inputSection = createSection('JSON 输入', inputTextarea, [copyInputBtn])
    const treeSection = createSection('JSON 树 (点击字段获取路径)', treeContainer)
    const resultSection = createSection('查询结果', resultBox, [copyResultBtn])

    container.appendChild(pathGroup)
    container.appendChild(quickRow)
    container.appendChild(btnRow)
    container.appendChild(errorEl)
    container.appendChild(inputSection)
    container.appendChild(treeSection)
    container.appendChild(selectedPathDisplay)
    container.appendChild(resultSection)

    // Initialize
    renderTreeMessage('请粘贴 JSON 数据，或点击「示例数据」')
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
  if (!path.startsWith('$')) {
    throw new Error('JSONPath 必须以 $ 开头')
  }

  const segments = parsePath(path.slice(1))
  const results = []
  resolve(data, segments, 0, '$', results)
  return results
}

function parsePath(pathStr) {
  const segments = []
  let i = 0
  const s = pathStr

  while (i < s.length) {
    if (s[i] === '.') {
      i++
      if (i < s.length && s[i] === '.' && i + 1 < s.length && s[i + 1] === '*') {
        i += 2
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
        i++
        if (i < s.length && s[i] === ']') i++
      } else {
        let index = ''
        while (i < s.length && s[i] !== ']') {
          index += s[i]
          i++
        }
        if (i < s.length && s[i] === ']') i++
        const trimmed = index.trim()
        if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
          segments.push({ type: 'key', key: trimmed.slice(1, -1) })
        } else {
          segments.push({ type: 'index', index: parseInt(trimmed, 10) })
        }
      }
    } else {
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
    recursiveSearch(value, segments, segIndex, currentPath, results, seg.key)
  }
}

function recursiveSearch(value, segments, segIndex, currentPath, results, targetKey) {
  if (targetKey && value !== null && typeof value === 'object' && !Array.isArray(value) && targetKey in value) {
    resolve(value[targetKey], segments, segIndex + 1, currentPath + '.' + targetKey, results)
  }

  if (!targetKey) {
    resolve(value, segments, segIndex + 1, currentPath, results)
  }

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
