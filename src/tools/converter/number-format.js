import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

export default {
  id: 'number-format',
  name: '数字格式化',
  description: '按地区格式化数字、货币和百分比',
  category: 'converter',
  icon: 'radix',
  render(container) {
    const locale = createElement('select', { className: 'select', 'aria-label': '地区格式' }, [
      createElement('option', { value: 'zh-CN', textContent: '中国大陆（zh-CN）' }),
      createElement('option', { value: 'en-US', textContent: '美国（en-US）' }),
      createElement('option', { value: 'de-DE', textContent: '德国（de-DE）' }),
      createElement('option', { value: 'ja-JP', textContent: '日本（ja-JP）' })
    ])
    const style = createElement('select', { className: 'select', 'aria-label': '数字样式' }, [
      createElement('option', { value: 'decimal', textContent: '普通数字' }),
      createElement('option', { value: 'currency', textContent: '货币' }),
      createElement('option', { value: 'percent', textContent: '百分比' })
    ])
    const currency = createElement('select', { className: 'select', 'aria-label': '货币代码' }, [
      createElement('option', { value: 'CNY', textContent: 'CNY 人民币' }),
      createElement('option', { value: 'USD', textContent: 'USD 美元' }),
      createElement('option', { value: 'EUR', textContent: 'EUR 欧元' }),
      createElement('option', { value: 'JPY', textContent: 'JPY 日元' })
    ])
    const digits = createElement('input', { className: 'input', type: 'number', min: '0', max: '10', value: '2' })
    const options = createElement('div', { className: 'grid-4' }, [
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '地区' }), locale]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '样式' }), style]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '货币' }), currency]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '最大小数位' }), digits])
    ])
    const state = renderTextTransform(container, {
      inputTitle: '数字（每行一个）',
      outputTitle: '格式化结果',
      inputPlaceholder: '1234567.89\n0.156',
      actionLabel: '格式化',
      sample: '1234567.89\n0.156\n-42000',
      options,
      rows: 9,
      transform(text) {
        const maximumFractionDigits = Math.min(10, Math.max(0, Number(digits.value) || 0))
        const settings = { style: style.value, maximumFractionDigits }
        if (style.value === 'currency') settings.currency = currency.value
        const formatter = new Intl.NumberFormat(locale.value, settings)
        return text.split(/\r\n|\r|\n/).filter(line => line.trim()).map((line, index) => {
          const value = Number(line.trim())
          if (!Number.isFinite(value)) throw new Error(`第 ${index + 1} 行不是有效数字`)
          return formatter.format(value)
        }).join('\n')
      }
    })
    ;[locale, style, currency, digits].forEach(control => control.addEventListener('change', state.run))
  }
}
