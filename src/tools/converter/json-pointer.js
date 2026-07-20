import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

function resolvePointer(value, pointer) {
  if (pointer === '') return value
  if (!pointer.startsWith('/')) throw new Error('JSON Pointer 必须为空或以 / 开头')
  return pointer.slice(1).split('/').reduce((current, rawToken) => {
    if (/~(?:[^01]|$)/.test(rawToken)) throw new Error(`JSON Pointer 包含无效转义：${rawToken}`)
    const token = rawToken.replaceAll('~1', '/').replaceAll('~0', '~')
    const isArrayIndex = /^(0|[1-9]\d*)$/.test(token)
    if (current === null || typeof current !== 'object'
      || (Array.isArray(current) && !isArrayIndex)
      || !Object.hasOwn(current, token)) {
      throw new Error(`路径片段不存在：${token}`)
    }
    return current[token]
  }, value)
}

export default {
  id: 'json-pointer',
  name: 'JSON Pointer 查询',
  description: '使用 RFC 6901 JSON Pointer 精确读取 JSON 节点',
  category: 'converter',
  icon: 'json-path',
  render(container) {
    const pointer = createElement('input', {
      className: 'input',
      type: 'text',
      value: '/users/0/name',
      placeholder: '/users/0/name'
    })
    const options = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: 'JSON Pointer' }),
      pointer,
      createElement('span', { className: 'form-hint', textContent: '使用 / 分隔层级，~1 表示 /，~0 表示 ~。' })
    ])
    const state = renderTextTransform(container, {
      inputTitle: 'JSON 数据',
      outputTitle: '节点值',
      inputPlaceholder: '{\n  "users": [{ "name": "Alice" }]\n}',
      actionLabel: '查询节点',
      sample: '{\n  "users": [\n    { "name": "Alice", "roles": ["admin", "editor"] },\n    { "name": "Bob", "roles": ["viewer"] }\n  ]\n}',
      options,
      transform(text) {
        if (!text.trim()) return ''
        const result = resolvePointer(JSON.parse(text), pointer.value)
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      }
    })
    pointer.addEventListener('input', state.run)
  }
}
