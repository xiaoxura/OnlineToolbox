import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

const UNITS = ['px', 'em', 'rem', 'vh', 'vw', '%', 'cm', 'in', 'pt']

const PX_PER_UNIT = {
  px: 1,
  em: 16,
  rem: 16,
  vh: null,
  vw: null,
  '%': null,
  cm: 37.795275591,
  in: 96,
  pt: 1.333333333
}

function convert(value, fromUnit, baseFontSize, viewportWidth, viewportHeight) {
  let px

  switch (fromUnit) {
    case 'px':
      px = value
      break
    case 'em':
    case 'rem':
      px = value * baseFontSize
      break
    case 'vh':
      px = value * (viewportHeight / 100)
      break
    case 'vw':
      px = value * (viewportWidth / 100)
      break
    case '%':
      px = value * (baseFontSize / 100)
      break
    case 'cm':
      px = value * PX_PER_UNIT.cm
      break
    case 'in':
      px = value * PX_PER_UNIT.in
      break
    case 'pt':
      px = value * PX_PER_UNIT.pt
      break
    default:
      px = value
  }

  const results = {}
  for (const unit of UNITS) {
    switch (unit) {
      case 'px':
        results[unit] = px
        break
      case 'em':
      case 'rem':
        results[unit] = px / baseFontSize
        break
      case 'vh':
        results[unit] = viewportHeight ? (px / viewportHeight) * 100 : 0
        break
      case 'vw':
        results[unit] = viewportWidth ? (px / viewportWidth) * 100 : 0
        break
      case '%':
        results[unit] = baseFontSize ? (px / baseFontSize) * 100 : 0
        break
      case 'cm':
        results[unit] = px / PX_PER_UNIT.cm
        break
      case 'in':
        results[unit] = px / PX_PER_UNIT.in
        break
      case 'pt':
        results[unit] = px / PX_PER_UNIT.pt
        break
    }
  }

  return results
}

function formatNumber(num) {
  if (Number.isInteger(num)) return String(num)
  const str = num.toFixed(6)
  return str.replace(/\.?0+$/, '')
}

export default {
  id: 'css-unit',
  name: 'CSS 单位转换',
  description: '在 px、em、rem、vh、vw、%、cm、in、pt 等 CSS 单位之间互相转换',
  category: 'devtool',
  icon: 'unit',
  render(container) {
    const valueInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '16',
      step: 'any'
    })

    const unitSelect = createElement('select', { className: 'select' })
    UNITS.forEach(unit => {
      const opt = createElement('option', { value: unit, textContent: unit })
      if (unit === 'px') opt.selected = true
      unitSelect.appendChild(opt)
    })

    const baseInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '16',
      step: 'any'
    })

    const viewportWInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '1920',
      step: 'any'
    })

    const viewportHInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '1080',
      step: 'any'
    })

    const gridEl = createElement('div', { className: 'result-box' })

    function doConvert() {
      const value = parseFloat(valueInput.value)
      if (isNaN(value)) {
        gridEl.innerHTML = '<span class="error-text">请输入有效数字</span>'
        return
      }

      const fromUnit = unitSelect.value
      const baseFontSize = parseFloat(baseInput.value) || 16
      const viewportW = parseFloat(viewportWInput.value) || 1920
      const viewportH = parseFloat(viewportHInput.value) || 1080

      const results = convert(value, fromUnit, baseFontSize, viewportW, viewportH)
      gridEl.innerHTML = ''

      const grid = createElement('div', { className: 'stats-row' })
      UNITS.forEach(unit => {
        const displayVal = fromUnit === unit
          ? formatNumber(value)
          : formatNumber(results[unit])

        const item = createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-value', textContent: displayVal }),
          createElement('span', { className: 'stat-label', textContent: unit }),
          createCopyButton(displayVal)
        ])
        grid.appendChild(item)
      })

      gridEl.appendChild(grid)
    }

    valueInput.addEventListener('input', doConvert)
    unitSelect.addEventListener('change', doConvert)
    baseInput.addEventListener('input', doConvert)
    viewportWInput.addEventListener('input', doConvert)
    viewportHInput.addEventListener('input', doConvert)

    const inputRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '数值' }),
        valueInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '单位' }),
        unitSelect
      ])
    ])

    const configRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '根字体大小 (px)' }),
        baseInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '视口宽度 (px)' }),
        viewportWInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '视口高度 (px)' }),
        viewportHInput
      ])
    ])

    doConvert()

    const inputSection = createSection('输入', inputRow)
    const configSection = createSection('基准配置', configRow)
    const resultSection = createSection('转换结果', gridEl)

    container.appendChild(inputSection)
    container.appendChild(configSection)
    container.appendChild(resultSection)
  }
}
