import '../../styles/tools/qr.css'
import bwipjs from 'bwip-js/browser'
import { createElement, createSection } from '../../utils/dom.js'
import { downloadText } from '../../utils/download.js'

// Barcode rendering is delegated to bwip-js; the input validation and the
// check-digit maths below stay dependency-free so they are unit-testable.

export const BARCODE_TYPES = [
  { id: 'code128', name: 'Code 128', hint: '任意可打印 ASCII 字符，1-80 位', sample: 'OnlineToolbox-2024' },
  { id: 'ean13', name: 'EAN-13', hint: '12 位数字（自动补校验位）或 13 位完整码', sample: '690123456789' },
  { id: 'upca', name: 'UPC-A', hint: '11 位数字（自动补校验位）或 12 位完整码', sample: '03600029145' },
  { id: 'code39', name: 'Code 39', hint: '数字、大写字母以及 - . 空格 $ / + %', sample: 'TOOLBOX-39' },
  { id: 'interleaved2of5', name: 'Interleaved 2 of 5', hint: '偶数个数字，1-64 位', sample: '1234567890' }
]

const MAX_LENGTHS = {
  code128: 80,
  code39: 64,
  interleaved2of5: 64
}

// EAN-13 / UPC-A weighted 3-1 check digit. The rightmost payload digit always
// carries weight 3, then the weights alternate 3,1,3,1… leftwards.
export function computeCheckDigit(digits) {
  const payload = String(digits ?? '').replace(/\D/g, '')
  if (!payload) throw new Error('需要至少一位数字才能计算校验位')
  let sum = 0
  for (let index = 0; index < payload.length; index++) {
    const digit = Number(payload[payload.length - 1 - index])
    sum += index % 2 === 0 ? digit * 3 : digit
  }
  return (10 - (sum % 10)) % 10
}

function fail(message) {
  return { ok: false, message }
}

// Validates `text` for the given symbology. Returns { ok: true, value } with the
// normalized text to encode (check digit appended where the format needs one),
// or { ok: false, message } with a Chinese hint.
export function validateBarcodeInput(text, type) {
  const raw = String(text ?? '').trim()
  const definition = BARCODE_TYPES.find(item => item.id === type)
  if (!definition) return fail('未知的条码类型')

  if (!raw) return fail('请输入要编码的内容')

  if (type === 'ean13' || type === 'upca') {
    const payloadLength = type === 'ean13' ? 12 : 11
    if (!/^\d+$/.test(raw)) return fail(`${definition.name} 只能包含数字`)
    if (raw.length === payloadLength) {
      const check = computeCheckDigit(raw)
      return { ok: true, value: raw + check, checkDigit: check, appended: true }
    }
    if (raw.length === payloadLength + 1) {
      const expected = computeCheckDigit(raw.slice(0, payloadLength))
      if (Number(raw[payloadLength]) !== expected) {
        return fail(`校验位不正确，第 ${payloadLength + 1} 位应为 ${expected}`)
      }
      return { ok: true, value: raw, checkDigit: expected, appended: false }
    }
    return fail(`${definition.name} 需要 ${payloadLength} 位数字（自动补校验位）或 ${payloadLength + 1} 位完整码`)
  }

  if (type === 'interleaved2of5') {
    if (!/^\d+$/.test(raw)) return fail('Interleaved 2 of 5 只能包含数字')
    if (raw.length % 2 !== 0) return fail('Interleaved 2 of 5 需要偶数个数字')
  }

  if (type === 'code39' && !/^[0-9A-Z\-. $/+%]+$/.test(raw)) {
    return fail('Code 39 只支持数字、大写字母与 - . 空格 $ / + %')
  }

  if (type === 'code128' && !/^[\x20-\x7E]+$/.test(raw)) {
    return fail('Code 128 只支持可打印 ASCII 字符（不含中文与换行）')
  }

  const limit = MAX_LENGTHS[type]
  if (limit && raw.length > limit) return fail(`${definition.name} 最多支持 ${limit} 个字符`)

  return { ok: true, value: raw, checkDigit: null, appended: false }
}

export default {
  id: 'barcode',
  name: '条形码生成',
  description: '生成 Code128、EAN-13、UPC-A 与 Code39 条形码，可下载 PNG 或 SVG',
  category: 'generator',
  icon: 'qrcode',
  keywords: ['barcode', '条形码', 'code128', 'ean13', 'upca', 'code39'],
  render(container) {
    const typeSelect = createElement('select', { className: 'select', 'aria-label': '条码类型' },
      BARCODE_TYPES.map(item => createElement('option', { value: item.id, textContent: item.name })))

    const textInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: BARCODE_TYPES[0].sample,
      placeholder: '请输入要编码的内容…',
      'aria-label': '条码内容'
    })

    const scaleInput = createElement('input', {
      className: 'input',
      type: 'number',
      min: '1',
      max: '8',
      step: '1',
      value: '3',
      'aria-label': '缩放倍数'
    })

    const heightInput = createElement('input', {
      className: 'input',
      type: 'number',
      min: '5',
      max: '60',
      step: '1',
      value: '15',
      'aria-label': '条码高度（毫米）'
    })

    const textCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    textCheckbox.checked = true
    const textOption = createElement('label', { className: 'option-item' }, [
      textCheckbox,
      createElement('span', { textContent: '显示文本' })
    ])

    const hint = createElement('div', { className: 'form-hint' })
    const errorEl = createElement('div', { className: 'error-text' })
    const checkResult = createElement('div', { className: 'inline-result' })

    const canvas = createElement('canvas', { className: 'qrcode-canvas' })
    const statusText = createElement('div', { className: 'qr-status-text' })
    const canvasWrap = createElement('div', { className: 'qr-canvas-wrap' }, [canvas, statusText])

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '生成条形码',
      onClick: () => { generate() }
    })

    const pngBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '下载 PNG',
      onClick: downloadPng
    })

    const svgBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '下载 SVG',
      onClick: downloadSvg
    })

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        const definition = BARCODE_TYPES.find(item => item.id === typeSelect.value) || BARCODE_TYPES[0]
        textInput.value = definition.sample
        run()
      }
    })

    const currentType = () => BARCODE_TYPES.find(item => item.id === typeSelect.value) || BARCODE_TYPES[0]

    function buildOptions(value) {
      return {
        bcid: typeSelect.value,
        text: value,
        scale: Math.min(8, Math.max(1, Number(scaleInput.value) || 3)),
        height: Math.min(60, Math.max(5, Number(heightInput.value) || 15)),
        includetext: textCheckbox.checked,
        textxalign: 'center'
      }
    }

    function clearCanvas() {
      canvas.width = 0
      canvas.height = 0
      canvas.hidden = true
    }

    // Validates the current form state, refreshes the hint/check-digit row and
    // clears any previous graphic. Returns the validation result, or null when
    // the input is not encodable.
    function run() {
      errorEl.textContent = ''
      checkResult.replaceChildren()
      statusText.textContent = ''
      clearCanvas()

      const definition = currentType()
      hint.textContent = `${definition.name}：${definition.hint}`

      const result = validateBarcodeInput(textInput.value, typeSelect.value)
      if (!result.ok) {
        errorEl.textContent = result.message
        return null
      }

      if (result.checkDigit !== null) {
        checkResult.append(
          createElement('span', { className: 'stat-label', textContent: result.appended ? '已补校验位：' : '校验位：' }),
          createElement('span', { className: 'result-value', textContent: String(result.checkDigit) }),
          createElement('span', { className: 'stat-label', textContent: `完整编码：${result.value}` })
        )
      }

      statusText.textContent = '点击「生成条形码」渲染图形'
      return result
    }

    // Rendering only happens on demand: bwip-js needs a real 2D context, which
    // jsdom does not provide. Every failure is reported, never thrown.
    function generate() {
      const result = run()
      if (!result) return
      try {
        bwipjs.toCanvas(canvas, buildOptions(result.value))
        if (!canvas.width || !canvas.height) throw new Error('画布未生成内容')
        canvas.hidden = false
        statusText.textContent = `${currentType().name} · ${result.value}`
      } catch (cause) {
        clearCanvas()
        statusText.textContent = ''
        errorEl.textContent = `生成失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    function downloadPng() {
      if (!canvas.width || !canvas.height) {
        errorEl.textContent = '请先生成条形码'
        return
      }
      const link = document.createElement('a')
      link.download = `${typeSelect.value}-barcode.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    async function downloadSvg() {
      const result = run()
      if (!result) return
      try {
        const svg = await bwipjs.toSVG(buildOptions(result.value))
        if (typeof svg !== 'string' || !svg) throw new Error('未生成 SVG 内容')
        downloadText(`${typeSelect.value}-barcode.svg`, svg, 'image/svg+xml;charset=utf-8')
      } catch (cause) {
        errorEl.textContent = `生成 SVG 失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    typeSelect.addEventListener('change', run)
    textInput.addEventListener('input', run)
    scaleInput.addEventListener('input', run)
    heightInput.addEventListener('input', run)
    textCheckbox.addEventListener('change', run)

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '条码内容' }),
          textInput,
          hint
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '条码类型' }),
          typeSelect
        ])
      ]),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '缩放倍数（1-8）' }),
          scaleInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '高度（毫米）' }),
          heightInput
        ]),
        createElement('div', { className: 'form-group option-control-group' }, [textOption])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [generateBtn, pngBtn, svgBtn, sampleBtn]),
      errorEl,
      checkResult,
      createSection('条形码预览', canvasWrap)
    )

    clearCanvas()
    run()
  }
}
