import { createElement, createCopyButton } from '../../utils/dom.js'

const safeName = name => /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
const typeName = name => String(name).replace(/[^A-Za-z0-9_$]/g, ' ').replace(/(?:^|\s)(\w)/g, (_, c) => c.toUpperCase()).replace(/^\d/, '_$&') || 'Root'

export function jsonToTypeScript(value, rootName = 'Root', useType = false, optional = false) {
  const declarations = []
  const seen = new Set()
  function infer(data, name) {
    if (data === null) return 'null'
    if (Array.isArray(data)) {
      if (!data.length) return 'unknown[]'
      const types = [...new Set(data.map(item => infer(item, `${name}Item`)))]
      return types.length === 1 ? `${types[0]}[]` : `(${types.join(' | ')})[]`
    }
    if (typeof data !== 'object') return typeof data
    const normalizedName = typeName(name)
    if (!seen.has(normalizedName)) {
      seen.add(normalizedName)
      const fields = Object.entries(data).map(([key, item]) => `  ${safeName(key)}${optional ? '?' : ''}: ${infer(item, key)};`)
      declarations.push(useType
        ? `export type ${normalizedName} = {\n${fields.join('\n')}\n};`
        : `export interface ${normalizedName} {\n${fields.join('\n')}\n}`)
    }
    return normalizedName
  }
  const rootType = infer(value, rootName)
  if (!value || typeof value !== 'object' || Array.isArray(value)) declarations.push(`export type ${typeName(rootName)} = ${rootType};`)
  return declarations.reverse().join('\n\n')
}

export default {
  id: 'json-typescript', name: 'JSON 转 TypeScript', description: '根据 JSON 自动生成 TypeScript interface 或 type', category: 'converter', icon: 'json',
  render(container) {
    const input = createElement('textarea', { className: 'textarea large', placeholder: '粘贴 JSON 数据…' })
    const output = createElement('textarea', { className: 'textarea large', readOnly: true, placeholder: 'TypeScript 类型将在这里生成…' })
    const rootName = createElement('input', { className: 'input', value: 'Root', placeholder: '根类型名称' })
    const declaration = createElement('select', { className: 'select', 'aria-label': '声明类型' }, [createElement('option', { value: 'interface', textContent: 'interface' }), createElement('option', { value: 'type', textContent: 'type' })])
    const optional = createElement('input', { className: 'checkbox', type: 'checkbox' })
    const error = createElement('div', { className: 'error-text' })
    const run = () => { error.textContent = ''; try { output.value = jsonToTypeScript(JSON.parse(input.value), rootName.value || 'Root', declaration.value === 'type', optional.checked) } catch (e) { output.value = ''; error.textContent = `JSON 解析失败：${e.message}` } }
    container.append(
      createElement('div', { className: 'grid-2' }, [
        createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: 'JSON 输入' }), input]),
        createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: 'TypeScript 输出' }), output])
      ]),
      createElement('div', { className: 'form-row' }, [createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '根类型名称' }), rootName]), createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '声明方式' }), declaration])]),
      createElement('label', { className: 'option-item' }, [optional, createElement('span', { textContent: '所有属性设为可选' })]), error,
      createElement('div', { className: 'btn-group' }, [createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '生成类型', onClick: run }), createElement('button', { className: 'btn btn-secondary', type: 'button', textContent: '示例数据', onClick: () => { input.value = '{"id":1,"user":{"name":"Alice","roles":["admin"]},"active":true}'; run() } }), createCopyButton(() => output.value)])
    )
  }
}
