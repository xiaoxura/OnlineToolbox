import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

export default {
  id: 'line-endings',
  name: '换行符转换',
  description: '在 LF、CRLF 和 CR 换行格式之间转换文本',
  category: 'text',
  icon: 'text-sort',
  render(container) {
    const format = createElement('select', { className: 'select', 'aria-label': '目标换行格式' }, [
      createElement('option', { value: '\n', textContent: 'LF（Unix / macOS）' }),
      createElement('option', { value: '\r\n', textContent: 'CRLF（Windows）' }),
      createElement('option', { value: '\r', textContent: 'CR（旧版 Mac）' })
    ])
    const trimTrailing = createElement('input', { type: 'checkbox' })
    const finalNewline = createElement('input', { type: 'checkbox', checked: true })
    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '目标格式' }),
        format
      ]),
      createElement('label', { className: 'option-item' }, [trimTrailing, createElement('span', { textContent: '移除行尾空白' })]),
      createElement('label', { className: 'option-item' }, [finalNewline, createElement('span', { textContent: '保留末尾换行' })])
    ])

    const state = renderTextTransform(container, {
      inputTitle: '原始文本',
      outputTitle: '转换结果',
      inputPlaceholder: '粘贴需要统一换行符的文本...',
      actionLabel: '转换换行符',
      sample: 'first line\r\nsecond line  \r\nthird line\r\n',
      options,
      transform(text) {
        let normalized = text.replace(/\r\n|\r/g, '\n')
        if (trimTrailing.checked) normalized = normalized.split('\n').map(line => line.replace(/[\t ]+$/g, '')).join('\n')
        const finalNewlineCount = normalized.match(/\n+$/)?.[0].length || 0
        normalized = normalized.replace(/\n+$/, '')
        const converted = normalized.replace(/\n/g, format.value)
        return finalNewline.checked ? converted + format.value.repeat(finalNewlineCount) : converted
      }
    })
    format.addEventListener('change', state.run)
    trimTrailing.addEventListener('change', state.run)
    finalNewline.addEventListener('change', state.run)
  }
}
