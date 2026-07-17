import { createElement, createCopyButton, createSection } from '../../utils/dom.js'

export default {
  id: 'json-xml',
  name: 'JSON ↔ XML 转换',
  description: 'JSON 和 XML 格式相互转换',
  category: 'converter',
  icon: 'json-xml',
  render(container) {
    // Root element name input
    const rootLabel = createElement('label', { className: 'option-label', for: 'json-xml-root', textContent: 'XML 根元素名:' })
    const rootInput = createElement('input', {
      className: 'option-input',
      id: 'json-xml-root',
      type: 'text',
      value: 'root',
      placeholder: 'root'
    })
    const indentLabel = createElement('label', { className: 'option-label', for: 'json-xml-indent', textContent: '缩进:' })
    const indentInput = createElement('input', {
      className: 'option-input',
      id: 'json-xml-indent',
      type: 'number',
      value: '2',
      min: '0',
      max: '8'
    })

    const configRow = createElement('div', { className: 'option-row' }, [
      rootLabel, rootInput, indentLabel, indentInput
    ])

    // Input areas
    const jsonTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '在此输入 JSON...',
      rows: 12
    })

    const xmlTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '转换结果将显示在此...',
      rows: 12,
      readOnly: true
    })

    // Error display
    const errorEl = createElement('div', {
      className: 'error-text'
    })

    // Convert buttons
    const jsonToXmlBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'JSON → XML',
      onClick: () => {
        errorEl.textContent = ''
        const input = jsonTextarea.value.trim()
        if (!input) { errorEl.textContent = '请输入 JSON'; return }
        try {
          const data = JSON.parse(input)
          const indent = parseInt(indentInput.value) || 2
          const rootName = rootInput.value.trim() || 'root'
          const xml = jsonToXml(data, rootName, indent)
          xmlTextarea.value = xml
        } catch (e) {
          errorEl.textContent = 'JSON 解析错误: ' + e.message
          xmlTextarea.value = ''
        }
      }
    })

    const xmlToJsonBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'XML → JSON',
      onClick: () => {
        errorEl.textContent = ''
        const input = xmlTextarea.value.trim()
        if (!input) { errorEl.textContent = '请输入 XML'; return }
        try {
          const indent = parseInt(indentInput.value) || 2
          const result = xmlToJson(input)
          jsonTextarea.value = JSON.stringify(result, null, indent)
        } catch (e) {
          errorEl.textContent = 'XML 解析错误: ' + e.message
          jsonTextarea.value = ''
        }
      }
    })

    const swapBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '⇄ 交换',
      onClick: () => {
        const temp = jsonTextarea.value
        jsonTextarea.value = xmlTextarea.value
        xmlTextarea.value = temp
      }
    })

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick: () => {
        jsonTextarea.value = JSON.stringify({
          user: {
            name: '张三',
            age: 28,
            hobbies: ['读书', '编程', '游泳'],
            address: {
              city: '北京',
              street: '中关村大街'
            }
          }
        }, null, 2)
      }
    })

    const btnRow = createElement('div', { className: 'btn-group' }, [
      jsonToXmlBtn,
      xmlToJsonBtn,
      swapBtn,
      sampleBtn
    ])

    const copyJsonBtn = createCopyButton(() => jsonTextarea.value)
    const copyXmlBtn = createCopyButton(() => xmlTextarea.value)

    const jsonSection = createSection('JSON', jsonTextarea, [copyJsonBtn])
    const xmlSection = createSection('XML', xmlTextarea, [copyXmlBtn])

    container.appendChild(configRow)
    container.appendChild(btnRow)
    container.appendChild(errorEl)
    container.appendChild(jsonSection)
    container.appendChild(xmlSection)
  }
}

// JSON → XML conversion
function jsonToXml(data, rootName, indentSize) {
  const indent = (level) => ' '.repeat(level * indentSize)
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>']

  function serialize(value, tagName, level) {
    if (value === null || value === undefined) {
      lines.push(`${indent(level)}<${tagName}/>`)
      return
    }

    if (typeof value !== 'object') {
      lines.push(`${indent(level)}<${tagName}>${escapeXml(String(value))}</${tagName}>`)
      return
    }

    if (Array.isArray(value)) {
      // Arrays: repeat the element for each item
      for (const item of value) {
        serialize(item, tagName, level)
      }
      return
    }

    // Object
    lines.push(`${indent(level)}<${tagName}>`)
    for (const [key, val] of Object.entries(value)) {
      const safeName = sanitizeTagName(key)
      serialize(val, safeName, level + 1)
    }
    lines.push(`${indent(level)}</${tagName}>`)
  }

  const safeRoot = sanitizeTagName(rootName)
  if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
    // If it's a plain object with a single key matching root, unwrap
    const keys = Object.keys(data)
    lines.push(`${indent(0)}<${safeRoot}>`)
    for (const [key, val] of Object.entries(data)) {
      const safeName = sanitizeTagName(key)
      serialize(val, safeName, 1)
    }
    lines.push(`${indent(0)}</${safeRoot}>`)
  } else if (Array.isArray(data)) {
    lines.push(`${indent(0)}<${safeRoot}>`)
    for (const item of data) {
      serialize(item, 'item', 1)
    }
    lines.push(`${indent(0)}</${safeRoot}>`)
  } else {
    lines.push(`${indent(0)}<${safeRoot}>${escapeXml(String(data))}</${safeRoot}>`)
  }

  return lines.join('\n')
}

// XML → JSON conversion
function xmlToJson(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(parseError.textContent.split('\n')[0])
  }

  function deserialize(node) {
    // If the node has no children (only text content or empty)
    const childElements = Array.from(node.children).filter(c => c.nodeType === 1)

    if (childElements.length === 0) {
      // Leaf node: return text content
      const text = node.textContent.trim()
      return parseValue(text)
    }

    // Has child elements: build object
    const obj = {}

    for (const child of childElements) {
      const name = child.tagName
      const value = deserialize(child)

      if (obj.hasOwnProperty(name)) {
        // Duplicate keys: convert to array
        if (!Array.isArray(obj[name])) {
          obj[name] = [obj[name]]
        }
        obj[name].push(value)
      } else {
        obj[name] = value
      }
    }

    return obj
  }

  const root = doc.documentElement
  const result = deserialize(root)
  // Wrap with root element name
  return { [root.tagName]: result }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitizeTagName(name) {
  // XML tag names: must start with letter or underscore, can contain letters, digits, hyphens, underscores, dots
  let safe = name.replace(/[^a-zA-Z0-9._-]/g, '_')
  if (!/^[a-zA-Z_]/.test(safe)) {
    safe = '_' + safe
  }
  return safe
}

function parseValue(text) {
  if (text === 'true') return true
  if (text === 'false') return false
  if (text === 'null') return null
  // Try number
  if (text !== '' && !isNaN(text) && !isNaN(parseFloat(text))) {
    return parseFloat(text)
  }
  return text
}
