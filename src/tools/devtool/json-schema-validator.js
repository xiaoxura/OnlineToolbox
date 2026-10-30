import '../../styles/tools/json-schema-validator.css'
import { createElement, createSection, createTableScroll } from '../../utils/dom.js'

// JSON Schema validation on top of Ajv. Both Ajv and ajv-formats are loaded
// with a dynamic import the first time the user clicks 「校验」, so the tool
// page itself stays light.
//
// Draft-07 is the default; a schema declaring 2020-12 is compiled with
// ajv/dist/2020 instead. Errors are translated into short Chinese messages
// while the original keyword and instance path are kept for debugging.

const MODULE_CACHE = new Map()

function loadAjvModules(use2020) {
  const key = use2020 ? '2020' : 'draft7'
  if (!MODULE_CACHE.has(key)) {
    const ajvImport = use2020 ? import('ajv/dist/2020') : import('ajv')
    MODULE_CACHE.set(
      key,
      Promise.all([ajvImport, import('ajv-formats')]).then(([ajvModule, formatsModule]) => ({
        Ajv: ajvModule.default ?? ajvModule,
        addFormats: formatsModule.default ?? formatsModule
      }))
    )
  }
  return MODULE_CACHE.get(key)
}

const ERROR_MESSAGES = {
  required: params => `缺少必填属性：${params.missingProperty}`,
  type: params => `类型应为 ${params.type}`,
  format: params => `格式不符合 ${params.format}`,
  enum: params => `值必须是以下之一：${(params.allowedValues || []).join('、')}`,
  const: params => `值必须等于 ${JSON.stringify(params.allowedValue)}`,
  minimum: params => `值不能小于 ${params.limit}`,
  maximum: params => `值不能大于 ${params.limit}`,
  exclusiveMinimum: params => `值必须大于 ${params.limit}`,
  exclusiveMaximum: params => `值必须小于 ${params.limit}`,
  minLength: params => `长度不能少于 ${params.limit} 个字符`,
  maxLength: params => `长度不能多于 ${params.limit} 个字符`,
  pattern: params => `不符合正则表达式 ${params.pattern}`,
  minItems: params => `数组元素不能少于 ${params.limit} 个`,
  maxItems: params => `数组元素不能多于 ${params.limit} 个`,
  uniqueItems: () => '数组元素必须唯一',
  contains: () => '数组中没有符合要求的元素',
  minProperties: params => `属性数量不能少于 ${params.limit} 个`,
  maxProperties: params => `属性数量不能多于 ${params.limit} 个`,
  additionalProperties: params => `不允许额外属性：${params.additionalProperty}`,
  propertyNames: () => '存在不符合约束的属性名',
  multipleOf: params => `必须是 ${params.multipleOf} 的整数倍`,
  anyOf: () => '不符合 anyOf 中的任何一个 Schema',
  oneOf: () => '必须且只能符合 oneOf 中的一个 Schema',
  allOf: () => '必须符合 allOf 中的所有 Schema',
  not: () => '不能符合 not 指定的 Schema',
  if: () => '不符合 if / then / else 条件',
  dependencies: params => `属性 ${params.property} 存在依赖约束`,
  dependentRequired: params => `属性 ${params.property} 存在依赖约束`,
  patternProperties: () => '存在不符合模式属性约束的字段'
}

function describeError(error) {
  const translate = ERROR_MESSAGES[error.keyword]
  let message = translate?.(error.params || {})
  if (!message) message = error.message || '不符合 Schema 约束'
  return {
    instancePath: error.instancePath || '',
    message,
    keyword: error.keyword || 'unknown'
  }
}

function parseJson(text, label) {
  try {
    return { value: JSON.parse(text), error: '' }
  } catch (cause) {
    return {
      value: undefined,
      error: `${label}不是合法的 JSON：${cause instanceof Error ? cause.message : String(cause)}`
    }
  }
}

function parseFailure(message) {
  return { instancePath: '', message, keyword: 'parse' }
}

export async function validateJsonSchema(schemaText, dataText) {
  if (!String(schemaText ?? '').trim()) {
    return { valid: false, errors: [], schemaError: '请输入 JSON Schema' }
  }
  if (!String(dataText ?? '').trim()) {
    return { valid: false, errors: [parseFailure('请输入待校验的 JSON 数据')], schemaError: '' }
  }

  const schemaResult = parseJson(schemaText, 'Schema ')
  if (schemaResult.error) {
    return { valid: false, errors: [], schemaError: schemaResult.error }
  }
  const dataResult = parseJson(dataText, '数据')
  if (dataResult.error) {
    return { valid: false, errors: [parseFailure(dataResult.error)], schemaError: '' }
  }

  const schema = schemaResult.value
  if (schema === null || (typeof schema !== 'object' && typeof schema !== 'boolean')) {
    return { valid: false, errors: [], schemaError: 'Schema 必须是 JSON 对象或布尔值' }
  }

  const use2020 = typeof schema === 'object' && typeof schema.$schema === 'string' && schema.$schema.includes('2020-12')

  let modules
  try {
    modules = await loadAjvModules(use2020)
  } catch (cause) {
    return {
      valid: false,
      errors: [],
      schemaError: `加载 JSON Schema 校验器失败：${cause instanceof Error ? cause.message : String(cause)}`
    }
  }

  let validate
  try {
    const ajv = new modules.Ajv({ allErrors: true, strict: false, logger: false })
    modules.addFormats(ajv)
    validate = ajv.compile(schema)
  } catch (cause) {
    return {
      valid: false,
      errors: [],
      schemaError: `Schema 本身无效：${cause instanceof Error ? cause.message : String(cause)}`
    }
  }

  let valid = false
  try {
    valid = Boolean(validate(dataResult.value))
  } catch (cause) {
    return {
      valid: false,
      errors: [parseFailure(`校验过程中出错：${cause instanceof Error ? cause.message : String(cause)}`)],
      schemaError: ''
    }
  }

  return {
    valid,
    errors: valid ? [] : (validate.errors || []).map(describeError),
    schemaError: ''
  }
}

const EXAMPLE_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "age", "email"],
  "properties": {
    "name": { "type": "string", "minLength": 2 },
    "age": { "type": "integer", "minimum": 0 },
    "email": { "type": "string", "format": "email" },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "uniqueItems": true
    }
  },
  "additionalProperties": false
}`

const EXAMPLE_DATA = `{
  "name": "张三",
  "age": 28,
  "email": "zhangsan@example.com",
  "tags": ["developer", "designer"]
}`

export default {
  render(container) {
    const schemaInput = createElement('textarea', {
      className: 'textarea',
      rows: 12,
      spellcheck: 'false',
      'aria-label': 'JSON Schema 内容',
      placeholder: '粘贴 JSON Schema，例如 {"type":"object","required":["name"]}'
    })
    schemaInput.value = EXAMPLE_SCHEMA

    const dataInput = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      spellcheck: 'false',
      'aria-label': '待校验的 JSON 数据',
      placeholder: '粘贴需要校验的 JSON 数据'
    })
    dataInput.value = EXAMPLE_DATA

    const status = createElement('div', {
      className: 'schema-validator-status',
      role: 'status',
      'aria-live': 'polite'
    })
    const errorEl = createElement('div', { className: 'error-text' })

    const errorBody = createElement('tbody')
    const errorTable = createElement('table', { className: 'result-table' }, [
      createElement('thead', {}, [
        createElement('tr', {}, [
          createElement('th', { textContent: '路径' }),
          createElement('th', { textContent: '关键字' }),
          createElement('th', { textContent: '消息' })
        ])
      ]),
      errorBody
    ])
    const errorSection = createSection('校验错误', createTableScroll(errorTable, 'JSON Schema 校验错误列表'))
    errorSection.hidden = true

    const validateButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '校验',
      onClick: () => {
        runValidate()
      }
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        schemaInput.value = EXAMPLE_SCHEMA
        dataInput.value = EXAMPLE_DATA
        resetResult()
      }
    })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        schemaInput.value = ''
        dataInput.value = ''
        resetResult()
        schemaInput.focus()
      }
    })

    function resetResult() {
      errorEl.textContent = ''
      status.textContent = ''
      status.className = 'schema-validator-status'
      errorBody.replaceChildren()
      errorSection.hidden = true
    }

    function showError(message) {
      status.textContent = ''
      status.className = 'schema-validator-status'
      errorEl.textContent = message
      errorBody.replaceChildren()
      errorSection.hidden = true
    }

    async function runValidate() {
      resetResult()
      validateButton.disabled = true
      status.className = 'loading-text'
      status.textContent = '正在校验…'
      try {
        const result = await validateJsonSchema(schemaInput.value, dataInput.value)
        if (result.schemaError) {
          showError(result.schemaError)
          return
        }
        const parseError = result.errors.find(error => error.keyword === 'parse')
        if (parseError) {
          showError(parseError.message)
          return
        }
        if (result.valid) {
          status.className = 'schema-validator-status valid'
          status.textContent = '✓ 校验通过：数据符合 Schema'
          return
        }
        status.className = 'schema-validator-status invalid'
        status.textContent = `✗ 校验未通过：共 ${result.errors.length} 处错误`
        for (const error of result.errors) {
          errorBody.appendChild(
            createElement('tr', {}, [
              createElement('td', {
                className: 'code-text',
                textContent: error.instancePath || '（根）'
              }),
              createElement('td', { className: 'code-text', textContent: error.keyword }),
              createElement('td', { textContent: error.message })
            ])
          )
        }
        errorSection.hidden = false
      } catch (cause) {
        showError(`校验失败：${cause instanceof Error ? cause.message : String(cause)}`)
      } finally {
        validateButton.disabled = false
      }
    }

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 Schema 与数据只在本机浏览器中校验，不会上传到服务器。'
      }),
      createSection('JSON Schema', schemaInput),
      createSection('待校验数据', dataInput),
      createElement('div', { className: 'btn-group' }, [validateButton, sampleButton, clearButton]),
      status,
      errorEl,
      errorSection
    )
  }
}
