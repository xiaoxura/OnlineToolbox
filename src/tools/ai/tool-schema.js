import { createElement, createSegmentedGroup, createCopyButton } from '../../utils/dom.js'

// Union two or more inferred schemas — used for array items, where every
// element contributes. A key is only required when every element carries it.
function mergeSchemas(schemas) {
  const usable = schemas.filter(schema => schema && typeof schema === 'object')
  if (!usable.length) return {}
  const types = new Set(usable.map(schema => schema.type).filter(Boolean))
  // Mixed element types carry no single defensible type — leave it open
  // rather than silently picking one and mis-typing half the array.
  if (types.size > 1) return {}
  const [type] = [...types]

  if (type === 'object') {
    const properties = {}
    for (const schema of usable) {
      for (const [key, value] of Object.entries(schema.properties || {})) {
        properties[key] = properties[key] ? mergeSchemas([properties[key], value]) : value
      }
    }
    const required = [...new Set(usable.flatMap(schema => schema.required || []))]
      .filter(key => usable.every(schema => (schema.required || []).includes(key)))
    return {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false
    }
  }
  if (type === 'array') {
    return { type: 'array', items: mergeSchemas(usable.map(schema => schema.items).filter(Boolean)) }
  }
  return { type }
}

// Infer a JSON Schema from a sample value. Every key present in an object
// sample is marked required — that is the useful default for a tool schema,
// and dropping the optional ones is a smaller edit than adding them back.
export function inferSchema(value) {
  if (value === null) return { type: 'null' }
  if (Array.isArray(value)) {
    if (!value.length) return { type: 'array', items: {} }
    return { type: 'array', items: mergeSchemas(value.map(inferSchema)) }
  }
  if (typeof value === 'object') {
    const properties = {}
    const required = []
    for (const [key, item] of Object.entries(value)) {
      properties[key] = inferSchema(item)
      required.push(key)
    }
    return {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false
    }
  }
  if (typeof value === 'string') return { type: 'string' }
  if (typeof value === 'number') return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' }
  if (typeof value === 'boolean') return { type: 'boolean' }
  return {}
}

const TARGETS = [
  { value: 'openai', label: 'OpenAI tools' },
  { value: 'anthropic', label: 'Anthropic tools' }
]

export function buildToolSchema(sample, { name = 'my_function', description = '', target = 'openai' } = {}) {
  if (sample === null || typeof sample !== 'object' || Array.isArray(sample)) {
    throw new Error('需要一个 JSON 对象作为参数示例（顶层是 { }）')
  }
  const schema = inferSchema(sample)
  if (target === 'anthropic') {
    return { name, description, input_schema: schema, strict: true }
  }
  return { type: 'function', function: { name, description, parameters: schema, strict: true } }
}

const SAMPLE = JSON.stringify({
  city: '北京',
  days: 3,
  units: 'metric',
  include_forecast: true
}, null, 2)

export default {
  id: 'tool-schema',
  name: 'Function Schema 生成',
  description: '根据参数示例 JSON 生成 OpenAI 或 Anthropic 的工具调用 Schema',
  category: 'ai',
  icon: 'ai-tool-schema',
  render(container) {
    const nameInput = createElement('input', { className: 'input', value: 'get_weather', placeholder: 'get_weather' })
    const descriptionInput = createElement('input', {
      className: 'input',
      value: '查询指定城市未来几天的天气',
      placeholder: '描述这个函数做什么'
    })
    const sampleInput = createElement('textarea', {
      className: 'textarea large',
      placeholder: '{"city": "北京", "days": 3}',
      rows: 12
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      readOnly: true,
      placeholder: '生成的 Schema 将显示在此…',
      rows: 12
    })
    const error = createElement('div', { className: 'error-text' })
    const hint = createElement('div', { className: 'form-hint' })

    let target = 'openai'
    const targetGroup = createSegmentedGroup(TARGETS, value => {
      target = value
      run()
    }, { label: '输出格式' })

    function run() {
      error.textContent = ''
      hint.textContent = ''
      if (!sampleInput.value.trim()) {
        output.value = ''
        return
      }
      try {
        const sample = JSON.parse(sampleInput.value)
        output.value = JSON.stringify(buildToolSchema(sample, {
          name: nameInput.value.trim() || 'my_function',
          description: descriptionInput.value.trim(),
          target
        }), null, 2)
        hint.textContent = target === 'openai'
          ? '把该对象放进请求的 tools 数组即可；strict: true 要求参数严格符合 Schema。'
          : '把该对象放进请求的 tools 数组即可；input_schema 为 JSON Schema 格式。'
      } catch (cause) {
        output.value = ''
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    for (const input of [nameInput, descriptionInput, sampleInput]) {
      input.addEventListener('input', run)
    }

    sampleInput.value = SAMPLE
    run()

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '函数名' }),
          nameInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '函数描述' }),
          descriptionInput
        ])
      ]),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '输出格式' }),
          targetGroup
        ])
      ]),
      createElement('div', { className: 'grid-2' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '参数示例（JSON）' }),
          sampleInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '生成的 Schema' }),
          output
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '生成 Schema',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            sampleInput.value = SAMPLE
            run()
          }
        }),
        createCopyButton(() => output.value)
      ]),
      error,
      hint
    )
  }
}
