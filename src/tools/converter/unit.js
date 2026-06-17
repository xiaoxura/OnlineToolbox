import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

const unitCategories = {
  length: {
    label: '长度',
    units: {
      mm: { name: '毫米 (mm)', factor: 0.001 },
      cm: { name: '厘米 (cm)', factor: 0.01 },
      m: { name: '米 (m)', factor: 1 },
      km: { name: '千米 (km)', factor: 1000 },
      in: { name: '英寸 (in)', factor: 0.0254 },
      ft: { name: '英尺 (ft)', factor: 0.3048 },
      yd: { name: '码 (yd)', factor: 0.9144 },
      mi: { name: '英里 (mi)', factor: 1609.344 }
    }
  },
  weight: {
    label: '重量',
    units: {
      mg: { name: '毫克 (mg)', factor: 0.000001 },
      g: { name: '克 (g)', factor: 0.001 },
      kg: { name: '千克 (kg)', factor: 1 },
      lb: { name: '磅 (lb)', factor: 0.453592 },
      oz: { name: '盎司 (oz)', factor: 0.0283495 },
      ton: { name: '吨 (t)', factor: 1000 }
    }
  },
  temperature: {
    label: '温度',
    units: {
      c: { name: '摄氏度 (°C)' },
      f: { name: '华氏度 (°F)' },
      k: { name: '开尔文 (K)' }
    },
    special: true
  },
  area: {
    label: '面积',
    units: {
      mm2: { name: '平方毫米 (mm²)', factor: 0.000001 },
      cm2: { name: '平方厘米 (cm²)', factor: 0.0001 },
      m2: { name: '平方米 (m²)', factor: 1 },
      km2: { name: '平方千米 (km²)', factor: 1000000 },
      ha: { name: '公顷 (ha)', factor: 10000 },
      acre: { name: '英亩', factor: 4046.8564224 }
    }
  },
  volume: {
    label: '体积',
    units: {
      ml: { name: '毫升 (mL)', factor: 0.000001 },
      l: { name: '升 (L)', factor: 0.001 },
      gal: { name: '加仑 (gal)', factor: 0.00378541 },
      floz: { name: '液盎司 (fl oz)', factor: 0.0000295735 },
      m3: { name: '立方米 (m³)', factor: 1 }
    }
  },
  data: {
    label: '数据存储',
    units: {
      b: { name: '字节 (B)', factor: 1 },
      kb: { name: '千字节 (KB)', factor: 1024 },
      mb: { name: '兆字节 (MB)', factor: 1048576 },
      gb: { name: '吉字节 (GB)', factor: 1073741824 },
      tb: { name: '太字节 (TB)', factor: 1099511627776 }
    }
  }
}

export default {
  id: 'unit',
  name: '单位转换',
  category: 'converter',
  icon: 'unit',
  description: '长度、重量、温度等单位转换',
  render(container) {
    const tabContainer = createElement('div')
    const contentContainer = createElement('div')
    container.appendChild(tabContainer)
    container.appendChild(contentContainer)

    const panels = {}
    let activePanel = null

    // Build panels for each category
    for (const [key, cat] of Object.entries(unitCategories)) {
      const panel = createElement('div', { className: 'unit-panel' })
      panel.style.display = 'none'

      const unitKeys = Object.keys(cat.units)

      const fromSelect = createElement('select', { className: 'select' },
        unitKeys.map(k => createElement('option', { value: k, textContent: cat.units[k].name }))
      )

      const toSelect = createElement('select', { className: 'select' },
        unitKeys.map((k, i) => createElement('option', { value: k, textContent: cat.units[k].name }))
      )
      if (unitKeys.length > 1) toSelect.selectedIndex = 1

      const input = createElement('input', {
        className: 'input',
        type: 'number',
        value: '1',
        placeholder: '输入数值'
      })

      // Swap button
      const swapBtn = createElement('button', {
        className: 'btn-swap',
        title: '交换单位',
        innerHTML: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`,
        onClick: () => {
          const temp = fromSelect.value
          fromSelect.value = toSelect.value
          toSelect.value = temp
          convert()
        }
      })

      // Result
      const resultValue = createElement('span', {
        className: 'unit-result-value',
        textContent: '--'
      })
      const resultUnit = createElement('span', {
        className: 'unit-result-unit',
        textContent: ''
      })
      const resultEl = createElement('div', { className: 'unit-result' }, [resultValue, resultUnit])

      const copyBtn = createCopyButton(() => resultEl.textContent)

      function convert() {
        const val = parseFloat(input.value)
        if (isNaN(val)) {
          resultValue.textContent = '--'
          resultUnit.textContent = ''
          return
        }

        const fromKey = fromSelect.value
        const toKey = toSelect.value
        let result

        if (cat.special && key === 'temperature') {
          result = convertTemperature(val, fromKey, toKey)
        } else {
          const fromFactor = cat.units[fromKey].factor
          const toFactor = cat.units[toKey].factor
          const base = val * fromFactor
          result = base / toFactor
        }

        const formatted = parseFloat(result.toPrecision(10))
        resultValue.textContent = formatted
        resultUnit.textContent = cat.units[toKey].name
      }

      input.addEventListener('input', convert)
      fromSelect.addEventListener('change', convert)
      toSelect.addEventListener('change', convert)

      // Layout: [from select] [swap] [to select] / [input]
      const selectRow = createElement('div', { className: 'unit-selects-row' }, [
        createElement('div', { className: 'unit-select-group' }, [
          createElement('label', { className: 'label', textContent: '从' }),
          fromSelect
        ]),
        swapBtn,
        createElement('div', { className: 'unit-select-group' }, [
          createElement('label', { className: 'label', textContent: '到' }),
          toSelect
        ])
      ])

      const inputGroup = createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '输入数值' }),
        input
      ])

      const resultSection = createSection('转换结果', resultEl, [copyBtn])

      panel.appendChild(selectRow)
      panel.appendChild(inputGroup)
      panel.appendChild(resultSection)
      contentContainer.appendChild(panel)
      panels[key] = panel

      convert()
    }

    // Create tabs
    const tabs = Object.entries(unitCategories).map(([key, cat]) => ({
      label: cat.label,
      value: key
    }))

    const tabGroup = createTabGroup(tabs, (value) => {
      if (activePanel) activePanel.style.display = 'none'
      panels[value].style.display = 'block'
      activePanel = panels[value]
    })

    tabContainer.appendChild(tabGroup)

    // Show first tab
    const firstKey = Object.keys(unitCategories)[0]
    panels[firstKey].style.display = 'block'
    activePanel = panels[firstKey]
  }
}

function convertTemperature(val, from, to) {
  if (from === to) return val
  let celsius
  switch (from) {
    case 'c': celsius = val; break
    case 'f': celsius = (val - 32) * 5 / 9; break
    case 'k': celsius = val - 273.15; break
  }
  switch (to) {
    case 'c': return celsius
    case 'f': return celsius * 9 / 5 + 32
    case 'k': return celsius + 273.15
  }
}
