import { createElement, createSection } from '../../utils/dom.js'

// Resolve a dotted path ("user.name", "items.0.title") against a variables
// object. Missing links resolve to undefined rather than throwing, so the
// caller can report every unfilled placeholder at once.
export function resolvePath(variables, path) {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)]
    if (typeof current !== 'object') return undefined
    return current[key]
  }, variables)
}

export function stringifyValue(value) {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// Fill {{placeholders}} from `variables`.
//
// - "\{{name}}" escapes a placeholder and renders as a literal "{{name}}".
// - An unresolved placeholder is left verbatim and reported in `missing`, so a
//   half-filled prompt is visibly half-filled instead of silently empty.
export function renderTemplate(template, variables) {
  const missing = new Set()
  const used = new Set()
  const output = String(template).replace(/\\?\{\{\s*([\w.$-]+)\s*\}\}/g, (match, path) => {
    if (match.startsWith('\\')) return match.slice(1)
    const value = resolvePath(variables, path)
    if (value === undefined) {
      missing.add(path)
      return match
    }
    used.add(path)
    return stringifyValue(value)
  })
  return { output, missing: [...missing], used: [...used] }
}

const SAMPLE_TEMPLATE = `你是一名{{role}}，请用{{tone}}的语气回答。

用户问题：{{question}}
参考资料：
{{context}}`

const SAMPLE_VARIABLES = `{
  "role": "资深后端工程师",
  "tone": "简洁专业",
  "question": "如何设计一个限流器？",
  "context": "令牌桶与漏桶的区别"
}`

export default {
  id: 'prompt-template',
  name: 'Prompt 模板填充',
  description: '用 JSON 变量填充 {{占位符}}，并列出未填充的变量',
  category: 'ai',
  icon: 'ai-prompt',
  render(container) {
    const template = createElement('textarea', {
      className: 'textarea large',
      placeholder: '例如：你是一名{{role}}，请回答{{question}}',
      rows: 12
    })
    const variables = createElement('textarea', {
      className: 'textarea large',
      placeholder: '{"role": "助手", "question": "你好"}',
      rows: 6
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      readOnly: true,
      placeholder: '填充结果将显示在此…',
      rows: 12
    })
    const report = createElement('div', { className: 'form-hint' })
    const error = createElement('div', { className: 'error-text' })

    function run() {
      error.textContent = ''
      report.textContent = ''
      try {
        const raw = variables.value.trim()
        const parsed = raw ? JSON.parse(raw) : {}
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('变量需要是一个 JSON 对象')
        }
        const result = renderTemplate(template.value, parsed)
        output.value = result.output
        const parts = []
        if (result.used.length) parts.push(`已填充 ${result.used.length} 个变量`)
        if (result.missing.length) parts.push(`未填充：${result.missing.map(name => `{{${name}}}`).join('、')}`)
        report.textContent = parts.join(' · ')
        if (result.missing.length) report.classList.add('form-hint-warn')
        else report.classList.remove('form-hint-warn')
      } catch (cause) {
        output.value = ''
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    template.addEventListener('input', run)
    variables.addEventListener('input', run)

    template.value = SAMPLE_TEMPLATE
    variables.value = SAMPLE_VARIABLES
    run()

    container.append(
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '填充模板',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            template.value = SAMPLE_TEMPLATE
            variables.value = SAMPLE_VARIABLES
            run()
          }
        })
      ]),
      error,
      report,
      createSection('Prompt 模板', template),
      createSection('变量（JSON）', variables),
      createSection('填充结果', output)
    )
  }
}
