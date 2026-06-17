import { createElement, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'palette-gen',
  name: '调色板生成',
  description: '基于色彩理论生成互补色、三色组、类似色等配色方案',
  category: 'generator',
  icon: 'color',
  render(container) {
    function hexToHsl(hex) {
      let r = parseInt(hex.slice(1, 3), 16) / 255
      let g = parseInt(hex.slice(3, 5), 16) / 255
      let b = parseInt(hex.slice(5, 7), 16) / 255

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      let h = 0
      let s = 0
      const l = (max + min) / 2

      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
          case g: h = ((b - r) / d + 2) / 6; break
          case b: h = ((r - g) / d + 4) / 6; break
        }
      }

      return { h: h * 360, s: s * 100, l: l * 100 }
    }

    function hslToHex(h, s, l) {
      h = ((h % 360) + 360) % 360
      s = Math.max(0, Math.min(100, s)) / 100
      l = Math.max(0, Math.min(100, l)) / 100

      const c = (1 - Math.abs(2 * l - 1)) * s
      const x = c * (1 - Math.abs((h / 60) % 2 - 1))
      const m = l - c / 2

      let r, g, b
      if (h < 60) { r = c; g = x; b = 0 }
      else if (h < 120) { r = x; g = c; b = 0 }
      else if (h < 180) { r = 0; g = c; b = x }
      else if (h < 240) { r = 0; g = x; b = c }
      else if (h < 300) { r = x; g = 0; b = c }
      else { r = c; g = 0; b = x }

      const toHex = (v) => {
        const hex = Math.round((v + m) * 255).toString(16)
        return hex.length === 1 ? '0' + hex : hex
      }

      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    function generateColors(baseHex, mode) {
      const { h, s, l } = hexToHsl(baseHex)
      switch (mode) {
        case 'complement':
          return [baseHex, hslToHex(h + 180, s, l)]
        case 'triadic':
          return [baseHex, hslToHex(h + 120, s, l), hslToHex(h + 240, s, l)]
        case 'analogous':
          return [hslToHex(h - 30, s, l), baseHex, hslToHex(h + 30, s, l)]
        case 'split-complementary':
          return [baseHex, hslToHex(h + 150, s, l), hslToHex(h + 210, s, l)]
        case 'monochromatic':
          return [
            hslToHex(h, s, Math.max(10, l - 30)),
            hslToHex(h, s, Math.max(10, l - 15)),
            baseHex,
            hslToHex(h, s, Math.min(90, l + 15)),
            hslToHex(h, s, Math.min(90, l + 30))
          ]
        default:
          return [baseHex]
      }
    }

    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgb(${r}, ${g}, ${b})`
    }

    const baseColorInput = createElement('input', {
      className: 'input',
      type: 'color',
      id: 'pg-base-color',
      value: '#3b82f6'
    })

    const baseGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'pg-base-color' }, ['基础颜色']),
      baseColorInput
    ])

    const modeSelect = createElement('select', { className: 'select', id: 'pg-mode' }, [
      createElement('option', { value: 'complement' }, ['互补色']),
      createElement('option', { value: 'triadic' }, ['三色组']),
      createElement('option', { value: 'analogous' }, ['类似色']),
      createElement('option', { value: 'split-complementary' }, ['分裂互补']),
      createElement('option', { value: 'monochromatic', selected: 'true' }, ['单色系'])
    ])

    const modeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'pg-mode' }, ['配色模式']),
      modeSelect
    ])

    const optionsRow = createElement('div', { className: 'form-row' }, [baseGroup, modeGroup])

    const swatchContainer = createElement('div', { className: 'stats-row' })
    const cssVarsOutput = createElement('textarea', {
      className: 'textarea',
      rows: '8',
      readonly: 'readonly'
    })
    const cssVarsCopyBtn = createCopyButton(() => cssVarsOutput.value)

    const exportFormatGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'pg-export' }, ['导出格式']),
      createElement('select', { className: 'select', id: 'pg-export' }, [
        createElement('option', { value: 'css' }, ['CSS Variables']),
        createElement('option', { value: 'scss' }, ['SCSS Variables'])
      ])
    ])

    let currentColors = []

    function renderSwatches(colors) {
      currentColors = colors
      swatchContainer.innerHTML = ''
      colors.forEach((hex, index) => {
        const rgb = hexToRgb(hex)
        const swatchColor = createElement('div', { className: 'stat-item' })
        swatchColor.setAttribute('style', `background-color: ${hex}`)

        const hexLabel = createElement('div', { className: 'stat-value', textContent: hex })
        const rgbLabel = createElement('div', { className: 'stat-label', textContent: rgb })

        const copyBtn = createElement('button', {
          className: 'btn btn-secondary',
          textContent: '复制',
          onClick: () => {
            copyToClipboard(hex)
          }
        })

        const swatchItem = createElement('div', { className: 'stat-item' }, [
          swatchColor,
          hexLabel,
          rgbLabel,
          copyBtn
        ])

        swatchContainer.appendChild(swatchItem)
      })

      updateExport()
    }

    function updateExport() {
      const format = document.getElementById('pg-export').value
      if (format === 'css') {
        cssVarsOutput.value = currentColors.map((hex, i) =>
          `--color-${i + 1}: ${hex};`
        ).join('\n')
      } else {
        cssVarsOutput.value = currentColors.map((hex, i) =>
          `$color-${i + 1}: ${hex};`
        ).join('\n')
      }
    }

    function generate() {
      const baseHex = document.getElementById('pg-base-color').value
      const mode = document.getElementById('pg-mode').value
      const colors = generateColors(baseHex, mode)
      renderSwatches(colors)
    }

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '生成',
      onClick: generate
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [generateBtn])

    const exportSelect = exportFormatGroup.querySelector('select')
    exportSelect.addEventListener('change', updateExport)
    modeSelect.addEventListener('change', generate)
    baseColorInput.addEventListener('input', generate)

    container.appendChild(optionsRow)
    container.appendChild(btnGroup)
    container.appendChild(swatchContainer)
    container.appendChild(exportFormatGroup)
    container.appendChild(createSection('导出', cssVarsOutput, [cssVarsCopyBtn]))

    generate()
  }
}
