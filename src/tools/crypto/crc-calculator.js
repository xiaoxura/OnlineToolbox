import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

// Bitwise CRC helpers. Inputs are small (pasted text), so the table-less forms
// keep the module dependency-free and every variant share one code path.

function crcReflected(bytes, width, polynomial, initial, xorOut) {
  const mask = width === 32 ? 0xFFFFFFFF : 0xFFFF
  let crc = initial
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ polynomial : crc >>> 1
      // JavaScript bitwise ops are 32-bit signed; re-normalize above 16 bits.
      if (width === 16) crc &= 0xFFFF
      else crc >>>= 0
    }
  }
  return (((crc ^ xorOut) & mask) >>> 0)
}

function crcForward(bytes, polynomial, initial, xorOut) {
  let crc = initial
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ polynomial) : crc << 1
      crc &= 0xFFFF
    }
  }
  return (crc ^ xorOut) & 0xFFFF
}

export function adler32(bytes) {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

export function crc32(bytes, polynomial = 0xEDB88320) {
  return crcReflected(bytes, 32, polynomial, 0xFFFFFFFF, 0xFFFFFFFF)
}

export function crc32c(bytes) {
  return crc32(bytes, 0x82F63B78)
}

export const ALGORITHMS = [
  { id: 'crc16-arc', name: 'CRC-16/ARC', width: 16, run: bytes => crcReflected(bytes, 16, 0xA001, 0x0000, 0x0000) },
  { id: 'crc16-modbus', name: 'CRC-16/MODBUS', width: 16, run: bytes => crcReflected(bytes, 16, 0xA001, 0xFFFF, 0x0000) },
  { id: 'crc16-ccitt', name: 'CRC-16/CCITT-FALSE', width: 16, run: bytes => crcForward(bytes, 0x1021, 0xFFFF, 0x0000) },
  { id: 'crc16-xmodem', name: 'CRC-16/XMODEM', width: 16, run: bytes => crcForward(bytes, 0x1021, 0x0000, 0x0000) },
  { id: 'crc32', name: 'CRC-32 (IEEE)', width: 32, run: bytes => crc32(bytes) },
  { id: 'crc32c', name: 'CRC-32C (Castagnoli)', width: 32, run: bytes => crc32c(bytes) },
  { id: 'adler32', name: 'Adler-32', width: 32, run: bytes => adler32(bytes) }
]

export function computeChecksums(bytes) {
  return ALGORITHMS.map(algorithm => {
    const value = algorithm.run(bytes)
    return {
      id: algorithm.id,
      name: algorithm.name,
      hex: value.toString(16).toUpperCase().padStart(algorithm.width / 4, '0'),
      decimal: String(value)
    }
  })
}

export function parseHexBytes(input) {
  const cleaned = input.replace(/0x/gi, '').replace(/[\s,;:_-]/g, '')
  if (!cleaned) throw new Error('请输入十六进制内容')
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error('十六进制内容包含非法字符')
  if (cleaned.length % 2 !== 0) throw new Error('十六进制长度必须为偶数（每 2 位 1 字节）')
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

const SAMPLE_TEXT = '123456789'
const SAMPLE_HEX = '48 65 6C 6C 6F'

export default {
  id: 'crc-calculator',
  name: 'CRC 校验和',
  description: '计算 CRC-16、CRC-32、CRC-32C 与 Adler-32 校验和，支持文本与十六进制输入',
  category: 'crypto',
  icon: 'crc',
  keywords: ['crc32', 'crc16', 'adler', '校验和', 'checksum', 'modbus'],
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      rows: 6,
      placeholder: '输入要计算校验和的文本或十六进制字节…'
    })

    const mode = createSegmentedGroup([
      { value: 'text', label: '文本' },
      { value: 'hex', label: '十六进制' }
    ], () => run())

    const toBytes = () => (mode.getValue() === 'hex'
      ? parseHexBytes(input.value)
      : new TextEncoder().encode(input.value))

    const errorEl = createElement('div', { className: 'error-text' })

    const resultBox = createElement('div', { className: 'result-box' })
    const table = createElement('table', { className: 'result-table' })
    const thead = createElement('thead', {}, [
      createElement('tr', {}, [
        createElement('th', { textContent: '算法' }),
        createElement('th', { textContent: '十六进制' }),
        createElement('th', { textContent: '十进制' })
      ])
    ])
    const tbody = createElement('tbody')
    table.append(thead, tbody)
    const tableScroll = createTableScroll(table, '校验和结果')
    resultBox.append(tableScroll)

    function run() {
      errorEl.textContent = ''
      tbody.innerHTML = ''
      if (!input.value) {
        resultBox.hidden = true
        return
      }
      try {
        const rows = computeChecksums(toBytes())
        resultBox.hidden = false
        for (const row of rows) {
          tbody.appendChild(createElement('tr', {}, [
            createElement('th', { scope: 'row', textContent: row.name }),
            createElement('td', { className: 'code-text', textContent: row.hex }),
            createElement('td', { textContent: row.decimal })
          ]))
        }
      } catch (cause) {
        resultBox.hidden = true
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const isHex = () => mode.getValue() === 'hex'
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = isHex() ? SAMPLE_HEX : SAMPLE_TEXT
        run()
      }
    })

    input.addEventListener('input', run)

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '输入类型' }),
          mode
        ])
      ]),
      createElement('div', { className: 'btn-group' }, [sampleBtn]),
      errorEl,
      createSection('输入内容', input),
      createSection('校验和结果', resultBox)
    )

    resultBox.hidden = true
  }
}
