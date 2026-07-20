import { createElement, createSection } from '../../utils/dom.js'

function parseHex(value) {
  const hex = value.trim().replace(/^#/, '')
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(hex)) throw new Error('请输入 3 位或 6 位十六进制颜色')
  const expanded = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex
  return [0, 2, 4].map(index => Number.parseInt(expanded.slice(index, index + 2), 16) / 255)
}

function luminance(rgb) {
  return rgb.reduce((sum, channel, index) => {
    const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return sum + linear * [0.2126, 0.7152, 0.0722][index]
  }, 0)
}

function contrastRatio(first, second) {
  const a = luminance(parseHex(first))
  const b = luminance(parseHex(second))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function colorField(label, initial) {
  const picker = createElement('input', { type: 'color', value: initial, 'aria-label': `${label}颜色选择器` })
  const text = createElement('input', { className: 'input', type: 'text', value: initial, 'aria-label': `${label}十六进制值` })
  picker.addEventListener('input', () => { text.value = picker.value; text.dispatchEvent(new Event('input', { bubbles: true })) })
  text.addEventListener('input', () => {
    if (/^#[\da-f]{6}$/i.test(text.value)) picker.value = text.value
  })
  return { picker, text, element: createElement('div', { className: 'color-field' }, [
    createElement('label', { className: 'label', textContent: label }),
    createElement('div', { className: 'color-field-controls' }, [picker, text])
  ]) }
}

export default {
  id: 'color-contrast',
  name: 'WCAG 颜色对比度',
  description: '计算前景色与背景色对比度，检查 WCAG AA/AAA 标准',
  category: 'devtool',
  icon: 'color',
  render(container) {
    const foreground = colorField('前景色', '#1f2937')
    const background = colorField('背景色', '#ffffff')
    const result = createElement('div', { className: 'contrast-result', role: 'status', 'aria-live': 'polite' })
    const preview = createElement('div', { className: 'contrast-preview', textContent: 'Aa 示例文本' })
    const update = () => {
      try {
        const ratio = contrastRatio(foreground.text.value, background.text.value)
        const ratioText = `${ratio.toFixed(2)}:1`
        const normalAA = ratio >= 4.5
        const largeAA = ratio >= 3
        const normalAAA = ratio >= 7
        result.innerHTML = `<strong>${ratioText}</strong><span>普通文本：${normalAA ? 'AA 通过' : 'AA 未通过'} · AAA ${normalAAA ? '通过' : '未通过'}</span><span>大号文本：${largeAA ? 'AA 通过' : 'AA 未通过'}</span>`
        preview.style.color = foreground.text.value
        preview.style.backgroundColor = background.text.value
      } catch (error) {
        result.textContent = error.message
      }
    }
    foreground.text.addEventListener('input', update)
    background.text.addEventListener('input', update)
    foreground.picker.addEventListener('input', update)
    background.picker.addEventListener('input', update)
    container.append(
      createElement('div', { className: 'color-contrast-grid' }, [foreground.element, background.element]),
      createSection('对比预览', preview),
      createSection('WCAG 结果', result)
    )
    update()
  }
}
