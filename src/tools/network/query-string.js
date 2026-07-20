import { createSegmentedGroup } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

function serializeScalar(params, key, value) {
  const type = typeof value
  if (value !== null && type !== 'string' && type !== 'number' && type !== 'boolean') {
    throw new Error('JSON 属性仅支持标量值或标量数组')
  }
  params.append(key, value === null ? '' : String(value))
}

export default {
  id: 'query-string',
  name: 'Query String 转换',
  description: '在 JSON 对象与 URL 查询字符串之间双向转换',
  category: 'network',
  icon: 'url-encode',
  render(container) {
    let mode = 'json-to-query'
    let rerun = () => {}
    const modeGroup = createSegmentedGroup([
      { label: 'JSON → Query', value: 'json-to-query' },
      { label: 'Query → JSON', value: 'query-to-json' }
    ], value => { mode = value; rerun() }, { label: '转换方向' })
    const state = renderTextTransform(container, {
      inputTitle: '输入',
      outputTitle: '结果',
      inputPlaceholder: '{"page":1,"tag":["js","css"],"draft":false}',
      outputPlaceholder: 'page=1&tag=js&tag=css&draft=false',
      actionLabel: '转换',
      sample: '{"page":1,"tag":["js","css"],"draft":false}',
      options: modeGroup,
      transform(text) {
        if (!text.trim()) return ''
        if (mode === 'json-to-query') {
          const value = JSON.parse(text)
          if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('JSON 输入必须是对象')
          const params = new URLSearchParams()
          Object.entries(value).forEach(([key, item]) => {
            if (Array.isArray(item)) item.forEach(valueItem => serializeScalar(params, key, valueItem))
            else serializeScalar(params, key, item)
          })
          return params.toString()
        }
        const result = Object.create(null)
        new URLSearchParams(text.replace(/^\?/, '')).forEach((value, key) => {
          if (Object.hasOwn(result, key)) result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value]
          else result[key] = value
        })
        return JSON.stringify(result, null, 2)
      }
    })
    rerun = state.run
  }
}
