import "../../styles/tools/xpath.css"
import DOMPurify from 'dompurify'
import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

// XPath tester: parse an HTML/XML document, evaluate an expression against it
// and report the matched nodes (plus an HTML preview with the hits marked).

const MODE_MIME = { html: 'text/html', xml: 'application/xml' }

function cleanMessage(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > 300 ? `${text.slice(0, 300)}…` : text
}

// XPathResult type ids differ per engine only in theory; read them off the
// document's own window and fall back to the spec numbers.
function resultTypes(doc) {
  const types = doc.defaultView?.XPathResult
  return {
    ordered: types?.ORDERED_NODE_SNAPSHOT_TYPE ?? 7,
    any: types?.ANY_TYPE ?? 0,
    number: types?.NUMBER_TYPE ?? 1,
    string: types?.STRING_TYPE ?? 2,
    boolean: types?.BOOLEAN_TYPE ?? 3,
    snapshots: [types?.UNORDERED_NODE_SNAPSHOT_TYPE ?? 6, types?.ORDERED_NODE_SNAPSHOT_TYPE ?? 7],
    iterators: [types?.UNORDERED_NODE_ITERATOR_TYPE ?? 4, types?.ORDERED_NODE_ITERATOR_TYPE ?? 5],
    singles: [types?.ANY_UNORDERED_NODE_TYPE ?? 8, types?.FIRST_ORDERED_NODE_TYPE ?? 9]
  }
}

function collectNodes(result, types) {
  const type = result?.resultType
  if (types.snapshots.includes(type)) {
    const nodes = []
    for (let index = 0; index < result.snapshotLength; index++) nodes.push(result.snapshotItem(index))
    return nodes
  }
  if (types.iterators.includes(type)) {
    const nodes = []
    let node = result.iterateNext()
    while (node) {
      nodes.push(node)
      node = result.iterateNext()
    }
    return nodes
  }
  if (types.singles.includes(type)) {
    return result.singleNodeValue ? [result.singleNodeValue] : []
  }
  return null
}

function scalarLabel(type, types) {
  if (type === types.number) return '数值'
  if (type === types.string) return '字符串'
  if (type === types.boolean) return '布尔值'
  return '标量'
}

function scalarText(result, types) {
  const type = result.resultType
  if (type === types.number) return String(result.numberValue)
  if (type === types.boolean) return String(result.booleanValue)
  return String(result.stringValue ?? '')
}

// Parse the document and surface a DOMParser error (XML keeps a parsererror root).
export function parseDocument(source, mode = 'html') {
  const text = String(source ?? '').trim()
  if (!text) throw new Error('请输入 HTML 或 XML 内容')
  const mime = MODE_MIME[mode] || MODE_MIME.html
  const doc = new DOMParser().parseFromString(text, mime)
  const parserError = doc.querySelector('parsererror')
  if (parserError) throw new Error(`文档解析失败：${cleanMessage(parserError.textContent)}`)
  return doc
}

function truncate(value, limit = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

// CSS-like path of a node, e.g. "html > body > ul > li[2]".
export function nodePath(node) {
  if (!node) return ''
  if (node.nodeType === 2) {
    return node.ownerElement ? `${nodePath(node.ownerElement)}/@${node.nodeName}` : `@${node.nodeName}`
  }
  if (node.nodeType === 3 || node.nodeType === 4) return `${nodePath(node.parentNode)}/text()`
  if (node.nodeType === 9) return '/'
  if (node.nodeType !== 1) return node.nodeName ? `/${node.nodeName.toLowerCase()}` : ''

  const segments = []
  let current = node
  while (current && current.nodeType === 1) {
    const parent = current.parentNode
    const tag = current.nodeName.toLowerCase()
    if (!parent || parent.nodeType !== 1) {
      segments.unshift(tag)
      break
    }
    const siblings = [...parent.children].filter(child => child.nodeName === current.nodeName)
    segments.unshift(siblings.length > 1 ? `${tag}[${siblings.indexOf(current) + 1}]` : tag)
    current = parent
  }
  return segments.join(' > ')
}

function describeNode(node) {
  const nodeType = node?.nodeType
  if (nodeType === 1) {
    return { type: 'element', name: node.nodeName.toLowerCase(), value: truncate(node.textContent), path: nodePath(node) }
  }
  if (nodeType === 2) {
    return { type: 'attribute', name: node.nodeName, value: truncate(node.nodeValue), path: nodePath(node) }
  }
  if (nodeType === 3 || nodeType === 4) {
    return { type: 'text', name: '#text', value: truncate(node.nodeValue), path: nodePath(node) }
  }
  if (nodeType === 8) {
    return { type: 'comment', name: '#comment', value: truncate(node.nodeValue), path: nodePath(node) }
  }
  if (nodeType === 9) {
    return { type: 'document', name: '#document', value: '', path: '/' }
  }
  return { type: 'other', name: node?.nodeName || '#node', value: truncate(node?.nodeValue ?? ''), path: '' }
}

// evaluateXPath('…html…', '//li', 'html') → { count, items: [{ type, name, value, path }] }
export function evaluateXPath(source, expression, mode = 'html') {
  const doc = parseDocument(source, mode)
  const query = String(expression ?? '').trim()
  if (!query) throw new Error('请输入 XPath 表达式')
  const types = resultTypes(doc)

  let nodes = null
  let scalar = null
  try {
    nodes = collectNodes(doc.evaluate(query, doc, null, types.ordered, null), types)
  } catch {
    // count()/string()/boolean() are not node-sets; retry with ANY_TYPE so the
    // scalar value can still be reported.
    let fallback
    try {
      fallback = doc.evaluate(query, doc, null, types.any, null)
    } catch (cause) {
      throw new Error(`XPath 表达式无效：${cleanMessage(cause?.message ?? cause)}`)
    }
    nodes = collectNodes(fallback, types)
    if (!nodes) scalar = fallback
  }

  if (scalar) {
    return {
      count: 1,
      scalar: true,
      items: [{
        type: 'scalar',
        name: scalarLabel(scalar.resultType, types),
        value: truncate(scalarText(scalar, types), 200),
        path: ''
      }]
    }
  }

  const items = nodes.map(describeNode)
  return { count: items.length, scalar: false, items }
}

// 在 HTML 预览中给命中的节点加高亮类（内容先经 DOMPurify 过滤）
export function highlightMatches(container, source, expression, mode = 'html') {
  container.replaceChildren()
  if (mode !== 'html') return 0
  const clean = DOMPurify.sanitize(String(source ?? ''), {
    FORBID_TAGS: ['style', 'link', 'base', 'meta', 'title'],
    FORBID_ATTR: ['srcset']
  })
  if (!clean.trim()) return 0

  const doc = new DOMParser().parseFromString(clean, 'text/html')
  const types = resultTypes(doc)
  let hits = 0
  try {
    const result = doc.evaluate(expression, doc, null, types.ordered, null)
    for (let index = 0; index < result.snapshotLength; index++) {
      const node = result.snapshotItem(index)
      if (node?.nodeType === 1) {
        node.classList.add('xpath-hit')
        hits++
      } else if (node?.parentElement) {
        node.parentElement.classList.add('xpath-hit')
        hits++
      }
    }
  } catch {
    // 表达式错误已经在上方提示，预览保持原样
  }
  container.innerHTML = doc.body ? doc.body.innerHTML : ''
  return hits
}

const SAMPLES = {
  html: {
    document: [
      '<div class="toolbox">',
      '  <h1 id="title">示例文档</h1>',
      '  <ul class="list">',
      '    <li class="item" data-id="1">第一项</li>',
      '    <li class="item" data-id="2">第二项</li>',
      '    <li class="item" data-id="3">第三项</li>',
      '  </ul>',
      '  <a href="https://example.com">示例链接</a>',
      '</div>'
    ].join('\n'),
    expression: '//li[@class="item"]'
  },
  xml: {
    document: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<catalog>',
      '  <book id="bk101">',
      '    <title>XML 入门</title>',
      '    <price>39.9</price>',
      '  </book>',
      '  <book id="bk102">',
      '    <title>XPath 实战</title>',
      '    <price>59.0</price>',
      '  </book>',
      '</catalog>'
    ].join('\n'),
    expression: '//book/title'
  }
}

export default {
  id: 'xpath-tester',
  name: 'XPath 测试器',
  description: '在 HTML 或 XML 上实时测试 XPath 表达式并高亮匹配结果',
  category: 'devtool',
  icon: 'json-path',
  keywords: ['xpath', 'html', 'xml', '选择器', '爬虫'],
  render(container) {
    const documentInput = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      placeholder: '粘贴 HTML 或 XML 文档…'
    })
    const expressionInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '如 //li[@class="item"]',
      'aria-label': 'XPath 表达式'
    })

    const mode = createSegmentedGroup([
      { value: 'html', label: 'HTML' },
      { value: 'xml', label: 'XML' }
    ], () => {
      documentInput.value = ''
      errorEl.textContent = ''
      run()
    })

    const errorEl = createElement('div', { className: 'error-text' })
    const countValue = createElement('span', { className: 'stat-value' })
    const typeValue = createElement('span', { className: 'stat-value' })
    const statsRow = createElement('div', { className: 'stats-row' }, [
      createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: '匹配数量' }),
        countValue
      ]),
      createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: '结果类型' }),
        typeValue
      ])
    ])

    const table = createElement('table', { className: 'result-table' })
    table.append(
      createElement('thead', {}, [
        createElement('tr', {}, [
          createElement('th', { textContent: '序号' }),
          createElement('th', { textContent: '节点名' }),
          createElement('th', { textContent: '文本内容' }),
          createElement('th', { textContent: '路径' })
        ])
      ]),
      createElement('tbody')
    )
    const tableScroll = createTableScroll(table, 'XPath 匹配结果')
    const tbody = table.querySelector('tbody')
    const statusEl = createElement('div', { className: 'form-hint' })
    const resultsSection = createSection('匹配结果', createElement('div', { className: 'tool-stack' }, [statsRow, statusEl, tableScroll]))

    const previewEl = createElement('div', { className: 'xpath-preview' })
    const previewHint = createElement('div', { className: 'form-hint' })
    // Deliberately not a .tool-section: the preview is a visual pane, and the IO
    // split then keeps the result table directly under the input column.
    const previewBlock = createElement('div', { className: 'tool-stack' }, [
      createElement('div', { className: 'label', textContent: 'HTML 预览与高亮' }),
      previewHint,
      previewEl
    ])

    function run() {
      errorEl.textContent = ''
      tbody.replaceChildren()
      countValue.textContent = ''
      typeValue.textContent = ''
      statusEl.textContent = ''
      statsRow.hidden = true
      previewEl.replaceChildren()

      const source = documentInput.value
      const expression = expressionInput.value.trim()
      const currentMode = mode.getValue()

      previewHint.textContent = currentMode === 'html'
        ? '匹配到的节点会在下方预览中用底纹标出。'
        : 'XML 模式不提供预览高亮，请查看上方结果表。'

      if (!source.trim()) {
        statusEl.textContent = '请输入 HTML 或 XML 文档'
        return
      }
      if (!expression) {
        statusEl.textContent = '请输入 XPath 表达式'
        return
      }

      try {
        const result = evaluateXPath(source, expression, currentMode)
        countValue.textContent = String(result.count)
        typeValue.textContent = result.scalar ? '标量值' : '节点集'
        statusEl.textContent = result.count ? '' : '未匹配到任何节点'
        statsRow.hidden = false

        result.items.forEach((item, index) => {
          tbody.appendChild(createElement('tr', {}, [
            createElement('th', { scope: 'row', textContent: String(index + 1) }),
            createElement('td', { className: 'code-text', textContent: item.name }),
            createElement('td', { textContent: item.value }),
            createElement('td', { className: 'code-text', textContent: item.path })
          ]))
        })

        if (currentMode === 'html') {
          const hits = highlightMatches(previewEl, source, expression, currentMode)
          if (hits > 0) previewHint.textContent = `已在预览中高亮 ${hits} 处匹配。`
        }
      } catch (cause) {
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
        statusEl.textContent = ''
      }
    }

    const queryBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '查询',
      onClick: run
    })
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        const sample = SAMPLES[mode.getValue()] || SAMPLES.html
        documentInput.value = sample.document
        expressionInput.value = sample.expression
        run()
      }
    })

    documentInput.addEventListener('input', run)
    expressionInput.addEventListener('input', run)
    expressionInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') run()
    })

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: 'XPath 表达式' }),
          expressionInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '文档类型' }),
          mode
        ])
      ]),
      createElement('div', { className: 'btn-group' }, [queryBtn, sampleBtn]),
      errorEl,
      createSection('文档输入', documentInput),
      resultsSection,
      previewBlock
    )

    run()
  }
}
