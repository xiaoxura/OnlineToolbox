import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

const graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

function splitGraphemes(value) {
  return graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(value), item => item.segment)
    : Array.from(value)
}

function isWhitespace(value) {
  return /^\s+$/u.test(value)
}

function trimStart(segments) {
  let index = 0
  while (index < segments.length && isWhitespace(segments[index])) index++
  return segments.slice(index)
}

function wrapLine(line, width, breakLongWords) {
  const graphemes = splitGraphemes(line)
  if (graphemes.length <= width) return line
  const output = []
  let remaining = graphemes
  while (remaining.length > width) {
    let cut = -1
    for (let index = Math.min(width, remaining.length - 1); index > 0; index--) {
      if (isWhitespace(remaining[index])) {
        cut = index
        break
      }
    }
    if (cut < Math.floor(width * 0.45)) {
      if (!breakLongWords) {
        const nextBreak = remaining.findIndex((segment, index) => index > width && isWhitespace(segment))
        if (nextBreak === -1) {
          output.push(remaining.join(''))
          remaining = []
          break
        }
        cut = nextBreak
      } else {
        cut = width
      }
    }
    output.push(remaining.slice(0, cut).join('').trimEnd())
    remaining = trimStart(remaining.slice(cut))
  }
  if (remaining.length) output.push(remaining.join(''))
  return output.join('\n')
}

export default {
  id: 'text-wrap',
  name: '文本自动换行',
  description: '按指定列宽自动换行并保留段落结构',
  category: 'text',
  icon: 'lorem',
  render(container) {
    const width = createElement('input', { className: 'input', type: 'number', min: '10', max: '500', value: '80' })
    const breakLong = createElement('input', { type: 'checkbox', checked: true })
    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '每行最大字符数' }),
        width
      ]),
      createElement('label', { className: 'option-item' }, [breakLong, createElement('span', { textContent: '拆分超长单词' })])
    ])
    const state = renderTextTransform(container, {
      inputTitle: '原始文本',
      outputTitle: '换行结果',
      actionLabel: '自动换行',
      sample: 'A compact developer toolbox should make repeated data transformations fast, predictable, and private without sending your input to a server.',
      options,
      transform(text) {
        const maxWidth = Math.min(500, Math.max(10, Number(width.value) || 80))
        return text.split(/\r\n|\r|\n/).map(line => wrapLine(line, maxWidth, breakLong.checked)).join('\n')
      }
    })
    width.addEventListener('input', state.run)
    breakLong.addEventListener('change', state.run)
  }
}
