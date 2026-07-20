import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

const UNITS = [
  ['ms', '毫秒', 1],
  ['s', '秒', 1000],
  ['min', '分钟', 60_000],
  ['h', '小时', 3_600_000],
  ['d', '天', 86_400_000],
  ['w', '周', 604_800_000]
]

function unitSelect(label, initial) {
  const select = createElement('select', { className: 'select', 'aria-label': label })
  UNITS.forEach(([value, name]) => select.appendChild(createElement('option', { value, textContent: `${name} (${value})` })))
  select.value = initial
  return select
}

function compactNumber(value) {
  if (!Number.isFinite(value)) throw new Error('换算结果超出有效数值范围')
  return Number(value.toPrecision(12)).toString()
}

export default {
  id: 'duration-converter',
  name: '时间长度转换',
  description: '批量换算毫秒、秒、分钟、小时、天和周',
  category: 'converter',
  icon: 'timestamp',
  render(container) {
    const from = unitSelect('原始单位', 'ms')
    const to = unitSelect('目标单位', 's')
    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '原始单位' }), from]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '目标单位' }), to])
    ])
    const state = renderTextTransform(container, {
      inputTitle: '数值',
      outputTitle: '换算结果',
      inputPlaceholder: '1000\n60000\n3600000',
      actionLabel: '换算',
      sample: '250\n1000\n60000\n86400000',
      options,
      rows: 9,
      transform(text) {
        const fromFactor = UNITS.find(([id]) => id === from.value)[2]
        const toFactor = UNITS.find(([id]) => id === to.value)[2]
        return text.split(/\r\n|\r|\n/).filter(line => line.trim()).map((line, index) => {
          const value = Number(line.trim())
          if (!Number.isFinite(value)) throw new Error(`第 ${index + 1} 行不是有效数字`)
          return compactNumber(value * fromFactor / toFactor)
        }).join('\n')
      }
    })
    from.addEventListener('change', state.run)
    to.addEventListener('change', state.run)
  }
}
