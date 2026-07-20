import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

export default {
  id: 'slugify',
  name: 'Slug 生成器',
  description: '将标题或文本转换为 URL 友好的 slug',
  category: 'text',
  icon: 'url-encode',
  render(container) {
    const separator = createElement('select', { className: 'select', 'aria-label': '分隔符' }, [
      createElement('option', { value: '-', textContent: '连字符 (-)' }),
      createElement('option', { value: '_', textContent: '下划线 (_)' }),
      createElement('option', { value: '', textContent: '不使用分隔符' })
    ])
    const lowercase = createElement('input', { type: 'checkbox', checked: true })
    const removeMarks = createElement('input', { type: 'checkbox', checked: true })
    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '分隔符' }),
        separator
      ]),
      createElement('label', { className: 'option-item' }, [lowercase, createElement('span', { textContent: '转为小写' })]),
      createElement('label', { className: 'option-item' }, [removeMarks, createElement('span', { textContent: '移除拉丁重音' })])
    ])

    const state = renderTextTransform(container, {
      inputTitle: '原始标题',
      outputTitle: 'Slug',
      inputPlaceholder: '例如：Hello World! 你好，开发者工具箱',
      outputPlaceholder: 'hello-world-你好-开发者工具箱',
      actionLabel: '生成 Slug',
      sample: 'Build Faster: JSON Tools & API Helpers 2026',
      options,
      live: true,
      transform(text) {
        const joiner = separator.value
        let value = text.trim().normalize('NFKD')
        if (removeMarks.checked) value = value.replace(/\p{M}+/gu, '')
        if (lowercase.checked) value = value.toLocaleLowerCase()
        value = value.replace(/[^\p{L}\p{N}]+/gu, joiner)
        if (joiner) {
          const escaped = joiner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          value = value.replace(new RegExp(`${escaped}{2,}`, 'g'), joiner)
          value = value.replace(new RegExp(`^${escaped}|${escaped}$`, 'g'), '')
        }
        return value
      }
    })
    separator.addEventListener('change', state.run)
    lowercase.addEventListener('change', state.run)
    removeMarks.addEventListener('change', state.run)
  }
}
