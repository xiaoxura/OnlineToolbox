import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'color',
  name: '颜色转换',
  description: 'HEX/RGB/HSL 颜色格式相互转换',
  category: 'converter',
  icon: 'color',
  render(container) {
    // Color picker + preview
    const pickerWrapper = createElement('div', { className: 'color-picker-wrap' })

    const colorPicker = createElement('input', { type: 'color', value: '#3498db' })

    const previewSwatch = createElement('div', {
      className: 'color-preview'
    })

    const pickerLabel = createElement('span', { className: 'sub-label', textContent: '点击选择颜色' })

    pickerWrapper.appendChild(colorPicker)
    pickerWrapper.appendChild(previewSwatch)
    pickerWrapper.appendChild(pickerLabel)

    // Input fields
    const fields = {}
    const fieldNames = ['hex', 'rgb', 'rgba', 'hsl']

    const fieldsEl = createElement('div', { className: 'color-fields' })

    for (const name of fieldNames) {
      const label = createElement('label', { className: 'label', textContent: name.toUpperCase() })
      const input = createElement('input', {
        className: 'input',
        type: 'text',
        placeholder: getPlaceholder(name),
        'data-format': name
      })
      const copyBtn = createCopyButton(() => input.value)
      const row = createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [label, input]),
        copyBtn
      ])
      fieldsEl.appendChild(row)
      fields[name] = input
    }

    let syncing = false

    function updateFromHex(hex) {
      if (syncing) return
      syncing = true
      hex = hex.trim()
      if (!/^#[0-9a-fA-F]{6}$/.test(hex) && !/^#[0-9a-fA-F]{3}$/.test(hex)) {
        syncing = false
        return
      }

      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      }

      const rgb = hexToRgb(hex)
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

      colorPicker.value = hex
      previewSwatch.style.background = hex

      fields.hex.value = hex
      fields.rgb.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
      fields.rgba.value = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`
      fields.hsl.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
      syncing = false
    }

    function updateFromRgb(str) {
      if (syncing) return
      const m = str.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)/)
      if (!m) return
      const r = clamp(+m[1], 0, 255)
      const g = clamp(+m[2], 0, 255)
      const b = clamp(+m[3], 0, 255)
      const hex = rgbToHex(r, g, b)
      updateFromHex(hex)
    }

    function updateFromHsl(str) {
      if (syncing) return
      const m = str.match(/hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*\)/)
      if (!m) return
      const h = clamp(+m[1], 0, 360)
      const s = clamp(+m[2], 0, 100)
      const l = clamp(+m[3], 0, 100)
      const rgb = hslToRgb(h, s, l)
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
      updateFromHex(hex)
    }

    colorPicker.addEventListener('input', () => updateFromHex(colorPicker.value))
    fields.hex.addEventListener('input', () => updateFromHex(fields.hex.value))
    fields.rgb.addEventListener('input', () => updateFromRgb(fields.rgb.value))
    fields.rgba.addEventListener('input', () => updateFromRgb(fields.rgba.value))
    fields.hsl.addEventListener('input', () => updateFromHsl(fields.hsl.value))

    const pickerSection = createSection('颜色选择', pickerWrapper)
    const fieldsSection = createSection('颜色格式', fieldsEl)

    container.appendChild(pickerSection)
    container.appendChild(fieldsSection)

    // Initialize
    updateFromHex('#3498db')
  }
}

function getPlaceholder(name) {
  switch (name) {
    case 'hex': return '#RRGGBB'
    case 'rgb': return 'rgb(255, 255, 255)'
    case 'rgba': return 'rgba(255, 255, 255, 1)'
    case 'hsl': return 'hsl(360, 100%, 100%)'
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  }
}
