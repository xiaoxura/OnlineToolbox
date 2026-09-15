import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

// IEEE 754 binary32 / binary64 conversion. All of the arithmetic lives in pure
// functions (DataView + BigInt) so the module can be tested without a DOM.

export const PRECISIONS = {
  single: { id: 'single', label: '单精度 float32', bits: 32, exponentBits: 8, mantissaBits: 23, bias: 127 },
  double: { id: 'double', label: '双精度 float64', bits: 64, exponentBits: 11, mantissaBits: 52, bias: 1023 }
}

export const CATEGORY_LABELS = {
  zero: '正零',
  'negative-zero': '负零',
  normal: '规格化数',
  subnormal: '次正规数（denormal）',
  infinity: '正无穷',
  'negative-infinity': '负无穷',
  nan: 'NaN（非数）'
}

export function normalizePrecision(precision) {
  if (precision === undefined || precision === null || precision === '' || precision === 'double' || precision === 64 || precision === 'float64' || precision === 'f64') return 'double'
  if (precision === 'single' || precision === 32 || precision === 'float32' || precision === 'f32') return 'single'
  throw new Error(`不支持的精度：${precision}`)
}

function configOf(precision) {
  return PRECISIONS[normalizePrecision(precision)]
}

const buffer = new ArrayBuffer(8)
const view = new DataView(buffer)

function bitsOfNumber(value, id) {
  if (id === 'single') {
    view.setFloat32(0, value)
    return BigInt(view.getUint32(0))
  }
  view.setFloat64(0, value)
  return view.getBigUint64(0)
}

function numberFromBits(bits, id) {
  if (id === 'single') {
    view.setUint32(0, Number(bits & 0xFFFFFFFFn))
    return view.getFloat32(0)
  }
  view.setBigUint64(0, bits)
  return view.getFloat64(0)
}

// Accepts a binary string ("0011 1111 1000…", "0b0011…"), a hex string
// ("0x3F800000", "3F800000") or a BigInt. Missing leading zeros are allowed.
export function parseBits(input, precision = 'double') {
  const config = configOf(precision)
  const raw = String(input ?? '').trim().replace(/[\s_,]/g, '')
  if (!raw) throw new Error('请输入二进制或十六进制位串')
  let text = raw
  let radix = 16
  if (/^0x/i.test(text)) text = text.slice(2)
  else if (/^0b/i.test(text)) { text = text.slice(2); radix = 2 }
  else if (/^[01]+$/.test(text)) radix = 2
  else if (!/^[0-9a-fA-F]+$/.test(text)) throw new Error('位串只能包含二进制（0/1）或十六进制字符')

  if (radix === 2 && !/^[01]*$/.test(text)) throw new Error('二进制位串只能包含 0 和 1')
  if (radix === 16 && !/^[0-9a-fA-F]*$/.test(text)) throw new Error('十六进制位串包含非法字符')
  if (!text) throw new Error('位串为空')

  const limit = radix === 2 ? config.bits : config.bits / 4
  if (text.length > limit) {
    throw new Error(`${radix === 2 ? '二进制' : '十六进制'}位串最多 ${limit} 位，当前为 ${text.length} 位`)
  }
  const bits = BigInt(radix === 2 ? `0b${text}` : `0x${text}`)
  return bits
}

export function toNumber(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').trim()
  if (!text) throw new Error('请输入十进制数值')
  const lowered = text.toLowerCase()
  if (lowered === 'nan') return NaN
  if (lowered === 'infinity' || lowered === 'inf' || lowered === '+infinity' || lowered === '+inf') return Infinity
  if (lowered === '-infinity' || lowered === '-inf') return -Infinity
  const number = Number(text)
  if (Number.isNaN(number)) throw new Error(`“${text}” 不是有效的十进制数值`)
  return number
}

export function splitBits(bitsInput, precision = 'double') {
  const config = configOf(precision)
  const bits = typeof bitsInput === 'bigint' ? bitsInput : parseBits(bitsInput, config.id)
  const exponentMask = (1n << BigInt(config.exponentBits)) - 1n
  const mantissaMask = (1n << BigInt(config.mantissaBits)) - 1n
  const sign = Number((bits >> BigInt(config.bits - 1)) & 1n)
  const exponentField = Number((bits >> BigInt(config.mantissaBits)) & exponentMask)
  const mantissaField = bits & mantissaMask
  return {
    precision: config.id,
    precisionLabel: config.label,
    width: config.bits,
    bias: config.bias,
    sign,
    signBit: String(sign),
    exponentField,
    exponentMask: Number(exponentMask),
    mantissaField,
    exponentBits: exponentField.toString(2).padStart(config.exponentBits, '0'),
    mantissaBits: mantissaField.toString(2).padStart(config.mantissaBits, '0'),
    exponentAllOnes: exponentField === Number(exponentMask),
    mantissaZero: mantissaField === 0n,
    binary: bits.toString(2).padStart(config.bits, '0'),
    hex: `0x${bits.toString(16).toUpperCase().padStart(config.bits / 4, '0')}`
  }
}

// Sign / exponent / mantissa grouped for reading: "0 01111011 10011001100110011001101"
export function groupBits(binary, precision = 'double') {
  const config = configOf(precision)
  return `${binary.slice(0, 1)} ${binary.slice(1, 1 + config.exponentBits)} ${binary.slice(1 + config.exponentBits)}`
}

export function classify(parts) {
  if (parts.exponentAllOnes) {
    if (!parts.mantissaZero) return 'nan'
    return parts.sign ? 'negative-infinity' : 'infinity'
  }
  if (parts.exponentField === 0) {
    if (parts.mantissaZero) return parts.sign ? 'negative-zero' : 'zero'
    return 'subnormal'
  }
  return 'normal'
}

// Full breakdown of a bit pattern: the value it encodes plus every field.
export function describeBits(bitsInput, precision = 'double') {
  const config = configOf(precision)
  const bits = typeof bitsInput === 'bigint' ? bitsInput : parseBits(bitsInput, config.id)
  const parts = splitBits(bits, config.id)
  const value = numberFromBits(bits, config.id)
  const category = classify(parts)

  const mantissaValue = Number(parts.mantissaField) / 2 ** config.mantissaBits
  const isSubnormal = category === 'subnormal'
  const hasSignificand = category === 'normal' || isSubnormal
  const actualExponent = category === 'normal'
    ? parts.exponentField - config.bias
    : isSubnormal ? 1 - config.bias : null

  return {
    ...parts,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    value,
    isSpecial: category === 'nan' || category === 'infinity' || category === 'negative-infinity',
    isSubnormal,
    actualExponent,
    exponentBiasApplied: category === 'normal'
      ? `${parts.exponentField} − ${config.bias} = ${actualExponent}`
      : isSubnormal ? `1 − ${config.bias} = ${actualExponent}（次正规数规定阶码为 1 − 偏置）` : '—',
    significand: hasSignificand
      ? `${isSubnormal ? '0' : '1'}.${parts.mantissaBits}`
      : '—',
    significandValue: hasSignificand ? (isSubnormal ? mantissaValue : 1 + mantissaValue) : null
  }
}

// Decimal number → the nearest value representable in the chosen precision,
// together with its bit pattern and component breakdown.
export function decodeFloat(value, precision = 'double') {
  const config = configOf(precision)
  const input = toNumber(value)
  const bits = bitsOfNumber(input, config.id)
  const described = describeBits(bits, config.id)
  return {
    ...described,
    input,
    exact: Object.is(described.value, input),
    difference: described.value - input
  }
}

export function encodeFloat(bits, precision = 'double') {
  return describeBits(bits, precision).value
}

export function roundTrip(value, precision = 'double') {
  const described = decodeFloat(value, precision)
  const difference = described.value - described.input
  const relative = Number.isFinite(difference) && described.input !== 0
    ? Math.abs(difference / described.input)
    : null
  return {
    input: described.input,
    decoded: described.value,
    exact: described.exact,
    difference,
    relativeError: relative
  }
}

export function formatNumber(value) {
  if (Object.is(value, -0)) return '-0'
  if (Number.isNaN(value)) return 'NaN'
  if (value === Infinity) return 'Infinity'
  if (value === -Infinity) return '-Infinity'
  return String(value)
}

const SAMPLE_DECODE = '0.1'
const SAMPLE_ENCODE = { single: '0x3DCCCCCD', double: '0x3FB999999999999A' }

function statCard(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('div', { className: 'stat-value', textContent: String(value) }),
    createElement('div', { className: 'stat-label', textContent: label })
  ])
}

export default {
  id: 'ieee754',
  name: 'IEEE 754 浮点数',
  description: '在十进制浮点数与 IEEE 754 二进制、十六进制表示之间转换',
  category: 'converter',
  icon: 'radix',
  keywords: ['ieee754', 'float32', 'float64', '浮点数', '单精度', '双精度', 'denormal'],
  render(container) {
    const direction = createSegmentedGroup([
      { value: 'decode', label: '数值 → 位串' },
      { value: 'encode', label: '位串 → 数值' }
    ], () => {
      syncInput()
      run()
    })

    const precision = createSegmentedGroup([
      { value: 'single', label: '单精度 float32' },
      { value: 'double', label: '双精度 float64' }
    ], () => run())

    const isDecode = () => direction.getValue() === 'decode'
    const currentPrecision = () => precision.getValue()

    const input = createElement('textarea', { className: 'textarea', rows: 4, placeholder: '请输入十进制数值，例如 0.1、-0、Infinity、NaN' })
    const output = createElement('textarea', { className: 'textarea', rows: 4, readOnly: true, placeholder: '转换结果将显示在此…' })
    const error = createElement('div', { className: 'error-text' })
    const statsEl = createElement('div', { className: 'stats-row' })
    const tableHost = createElement('div')
    const hint = createElement('div', { className: 'form-hint' })

    function syncInput() {
      if (isDecode()) {
        input.placeholder = '请输入十进制数值，例如 0.1、-0、Infinity、NaN'
        output.placeholder = '位串结果（符号 阶码 尾数）将显示在此…'
      } else {
        input.placeholder = '请输入二进制或十六进制位串，例如 0x3F800000、00111111100000000000000000000000'
        output.placeholder = '十进制结果将显示在此…'
      }
    }

    function renderDetail(described) {
      statsEl.replaceChildren()
      tableHost.replaceChildren()
      hint.textContent = ''

      statsEl.append(
        statCard('符号位', `${described.signBit}（${described.sign ? '负' : '正'}）`),
        statCard('阶码', `${described.exponentBits} = ${described.exponentField}`),
        statCard('尾数', described.mantissaBits),
        statCard('实际指数', described.actualExponent === null ? '—' : String(described.actualExponent)),
        statCard('值', formatNumber(described.value))
      )

      const rows = [
        ['十六进制', described.hex],
        ['二进制（符号 阶码 尾数）', groupBits(described.binary, described.precision)],
        ['有效数字', described.significand === '—' ? '—' : `${described.significand}（二进制）`],
        ['实际指数推导', described.exponentBiasApplied],
        ['类别', described.categoryLabel],
        ['指数偏置', `${described.bias}（${described.precisionLabel}固定）`]
      ]

      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement('tr', {}, [
            createElement('th', { textContent: '项目' }),
            createElement('th', { textContent: '值' })
          ])
        ]),
        createElement('tbody', {}, rows.map(([name, value]) => createElement('tr', {}, [
          createElement('th', { scope: 'row', textContent: name }),
          createElement('td', { className: 'code-text', textContent: value })
        ])))
      )
      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, 'IEEE 754 字段明细，可横向滚动')
      tableHost.appendChild(host)
    }

    function run() {
      error.textContent = ''
      statsEl.replaceChildren()
      tableHost.replaceChildren()
      hint.textContent = ''
      const text = input.value.trim()
      if (!text) {
        output.value = ''
        return
      }
      const id = currentPrecision()
      try {
        if (isDecode()) {
          const described = decodeFloat(text, id)
          output.value = groupBits(described.binary, id)
          renderDetail(described)
          if (described.isSpecial) {
            hint.textContent = '特殊值：' + described.categoryLabel + '，其阶码为全 1（或全 0），没有常规的有效数字。'
          } else if (!described.exact) {
            hint.textContent = `${formatNumber(described.input)} 无法被 ${described.precisionLabel} 精确表示，已按最接近的可表示值显示（差值 ${described.difference}）。`
          } else {
            hint.textContent = `${formatNumber(described.input)} 可以被 ${described.precisionLabel} 精确表示。`
          }
        } else {
          const described = describeBits(text, id)
          output.value = formatNumber(described.value)
          renderDetail(described)
          hint.textContent = `位串解析为 ${described.categoryLabel}，指数偏置为 ${described.bias}。`
        }
      } catch (cause) {
        output.value = ''
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const nextSample = () => (isDecode() ? SAMPLE_DECODE : SAMPLE_ENCODE[currentPrecision()])

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '转换方向' }),
          direction
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '浮点精度' }),
          precision
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '转换',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            input.value = nextSample()
            run()
          }
        })
      ]),
      error,
      createSection('输入', input),
      // One output card keeps the input on the left and every result on the
      // right when the shared two-column layout splits the page.
      createSection('浮点解析', createElement('div', { className: 'tool-stack' }, [
        createElement('div', { className: 'label', textContent: '转换结果' }),
        output,
        statsEl,
        hint,
        tableHost
      ]))
    )

    syncInput()
  }
}
