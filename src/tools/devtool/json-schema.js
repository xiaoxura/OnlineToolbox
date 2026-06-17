import { createElement, createSection, createCopyButton } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

function inferSchema(value, keyName) {
  if (value === null) {
    return { type: 'null' }
  }

  if (Array.isArray(value)) {
    const schema = { type: 'array' }
    if (value.length > 0) {
      const itemSchemas = value.map(item => inferSchema(item))
      const uniqueTypes = [...new Set(itemSchemas.map(s => s.type))]
      if (uniqueTypes.length === 1) {
        schema.items = itemSchemas[0]
      } else if (itemSchemas.length > 0) {
        schema.items = itemSchemas[0]
      }
    }
    return schema
  }

  const t = typeof value
  if (t === 'string') {
    const schema = { type: 'string' }
    if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(value)) {
      schema.format = 'date-time'
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      schema.format = 'date'
    } else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      schema.format = 'email'
    } else if (/^https?:\/\//.test(value)) {
      schema.format = 'uri'
    }
    return schema
  }

  if (t === 'number') {
    return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' }
  }

  if (t === 'boolean') {
    return { type: 'boolean' }
  }

  if (t === 'object') {
    const schema = { type: 'object' }
    const keys = Object.keys(value)
    if (keys.length > 0) {
      schema.properties = {}
      schema.required = []
      for (const key of keys) {
        schema.properties[key] = inferSchema(value[key], key)
        schema.required.push(key)
      }
    }
    return schema
  }

  return {}
}

function generateSchema(jsonStr) {
  const data = JSON.parse(jsonStr)
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...inferSchema(data)
  }
  return JSON.stringify(schema, null, 2)
}

export default {
  id: 'json-schema',
  name: 'JSON Schema 生成',
  description: '根据 JSON 数据自动推断并生成 JSON Schema (draft-07)',
  category: 'devtool',
  icon: 'json',
  render(container) {
    const defaultJson = `{
  "name": "张三",
  "age": 28,
  "email": "zhangsan@example.com",
  "isActive": true,
  "address": {
    "city": "北京",
    "street": "朝阳区建国路88号"
  },
  "tags": ["developer", "designer"],
  "birthday": "1995-06-15"
}`

    const inputEl = createElement('textarea', {
      className: 'textarea',
      placeholder: '粘贴 JSON 数据...',
      rows: '12'
    })
    inputEl.value = defaultJson

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '生成 Schema',
      onClick: doGenerate
    })

    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '清空',
      onClick: () => {
        inputEl.value = ''
        outputEl.textContent = ''
        errorEl.textContent = ''
      }
    })

    const btnRow = createElement('div', { className: 'btn-group' }, [generateBtn, clearBtn])

    const errorEl = createElement('div', { className: 'error-text' })

    const outputEl = createElement('textarea', {
      className: 'textarea',
      rows: '16',
      readonly: 'readonly'
    })

    const copyBtn = createCopyButton(() => outputEl.value)

    function doGenerate() {
      errorEl.textContent = ''
      outputEl.value = ''

      const jsonStr = inputEl.value.trim()
      if (!jsonStr) {
        errorEl.textContent = '请输入 JSON 数据'
        return
      }

      try {
        const result = generateSchema(jsonStr)
        outputEl.value = result
      } catch (e) {
        errorEl.textContent = `JSON 解析失败: ${e.message}`
      }
    }

    const inputSection = createSection('输入 JSON', inputEl, [btnRow])
    const outputSection = createSection('生成的 Schema', outputEl, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(errorEl)
    container.appendChild(outputSection)
  }
}
