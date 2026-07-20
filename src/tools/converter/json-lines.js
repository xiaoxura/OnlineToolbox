import { createSegmentedGroup } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

export default {
  id: 'json-lines',
  name: 'JSONL ↔ JSON 转换',
  description: '在 JSON Lines 与 JSON 数组之间双向转换和校验',
  category: 'converter',
  icon: 'json',
  render(container) {
    let mode = 'jsonl-to-json'
    let rerun = () => {}
    const modeGroup = createSegmentedGroup([
      { label: 'JSONL → JSON', value: 'jsonl-to-json' },
      { label: 'JSON → JSONL', value: 'json-to-jsonl' }
    ], value => {
      mode = value
      rerun()
    }, { label: '转换方向' })

    const state = renderTextTransform(container, {
      inputTitle: '输入数据',
      outputTitle: '转换结果',
      inputPlaceholder: '{"id":1,"name":"Alice"}\n{"id":2,"name":"Bob"}',
      actionLabel: '转换',
      sample: '{"id":1,"event":"login"}\n{"id":2,"event":"purchase","amount":99.9}',
      options: modeGroup,
      transform(text) {
        if (!text.trim()) return ''
        if (mode === 'json-to-jsonl') {
          const value = JSON.parse(text)
          if (!Array.isArray(value)) throw new Error('JSON 输入必须是数组')
          return value.map(item => JSON.stringify(item)).join('\n')
        }
        const values = text.split(/\r\n|\r|\n/).map((line, index) => ({ line, index })).filter(item => item.line.trim()).map(item => {
          try {
            return JSON.parse(item.line)
          } catch (cause) {
            throw new Error(`第 ${item.index + 1} 行不是有效 JSON：${cause.message}`)
          }
        })
        return JSON.stringify(values, null, 2)
      }
    })
    rerun = state.run
  }
}
