import CryptoJS from 'crypto-js'
import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

// UUID generation and inspection, RFC 9562 / RFC 4122.
//   v1 — Gregorian timestamp + random clock sequence + random node
//   v3 — MD5(namespace bytes ‖ name)
//   v4 — 122 random bits
//   v5 — SHA-1(namespace bytes ‖ name)
// MD5 and SHA-1 come from the bundled crypto-js so v3/v5 stay synchronous.

export const NAMESPACES = {
  dns: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  url: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  oid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  x500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8'
}

// 100-nanosecond intervals between 1582-10-15 and 1970-01-01.
const GREGORIAN_OFFSET = 122192928000000000n
const VERSIONS = [1, 3, 4, 5]

/** Parse a UUID string (with or without hyphens / braces / urn prefix) into 16 bytes. */
export function uuidToBytes(uuid) {
  if (typeof uuid !== 'string') throw new TypeError('UUID 必须是字符串')
  const hex = uuid.trim().toLowerCase()
    .replace(/^urn:uuid:/, '')
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`"${uuid.trim()}" 不是合法的 UUID`)
  const bytes = new Uint8Array(16)
  for (let index = 0; index < 16; index++) bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  return bytes
}

/** Render 16 bytes as a UUID. */
export function formatUuid(bytes, options = {}) {
  const { uppercase = false, hyphens = true } = options
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  const value = hyphens
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : hex
  return uppercase ? value.toUpperCase() : value
}

function randomBytes(target) {
  if (!globalThis.crypto?.getRandomValues) throw new Error('当前环境不支持 crypto.getRandomValues，无法生成随机 UUID')
  globalThis.crypto.getRandomValues(target)
  return target
}

/** Version 4 — 122 random bits. */
export function uuidV4() {
  const bytes = randomBytes(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return formatUuid(bytes)
}

let lastTimestamp = 0n
let clockSequence = null
let node = null

function nextTimestamp100ns() {
  let timestamp = BigInt(Date.now()) * 10000n + GREGORIAN_OFFSET
  // Never go backwards, even when the clock does.
  if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1n
  lastTimestamp = timestamp
  return timestamp
}

function clockSeqAndNode() {
  if (!clockSequence) {
    const seed = randomBytes(new Uint8Array(8))
    clockSequence = (((seed[0] & 0x3f) << 8) | seed[1]) || 1
    node = seed.slice(2)
    // The multicast bit marks a randomly generated node id.
    node[0] |= 0x01
  }
  return { clockSequence, node }
}

/** Version 1 — real timestamp, random clock sequence, random multicast node. */
export function uuidV1() {
  const timestamp = nextTimestamp100ns()
  const { clockSequence: sequence, node: nodeBytes } = clockSeqAndNode()
  const bytes = new Uint8Array(16)
  const timeLow = Number(timestamp & 0xffffffffn)
  const timeMid = Number((timestamp >> 32n) & 0xffffn)
  const timeHigh = Number((timestamp >> 48n) & 0x0fffn)

  bytes[0] = (timeLow >>> 24) & 0xff
  bytes[1] = (timeLow >>> 16) & 0xff
  bytes[2] = (timeLow >>> 8) & 0xff
  bytes[3] = timeLow & 0xff
  bytes[4] = (timeMid >>> 8) & 0xff
  bytes[5] = timeMid & 0xff
  bytes[6] = 0x10 | ((timeHigh >>> 8) & 0x0f)
  bytes[7] = timeHigh & 0xff
  bytes[8] = 0x80 | ((sequence >>> 8) & 0x3f)
  bytes[9] = sequence & 0xff
  bytes.set(nodeBytes, 10)
  return formatUuid(bytes)
}

function toWordArray(bytes) {
  const words = []
  for (let index = 0; index < bytes.length; index++) {
    words[index >>> 2] = (words[index >>> 2] || 0) | (bytes[index] << (24 - (index % 4) * 8))
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

function wordArrayToBytes(wordArray) {
  const bytes = new Uint8Array(wordArray.sigBytes)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = (wordArray.words[index >>> 2] >>> (24 - (index % 4) * 8)) & 0xff
  }
  return bytes
}

function resolveNamespace(namespace) {
  const value = String(namespace ?? '').trim()
  if (!value) throw new Error('请选择或填写命名空间 UUID')
  return Object.hasOwn(NAMESPACES, value.toLowerCase()) ? NAMESPACES[value.toLowerCase()] : value
}

function nameBasedUuid(version, namespace, name) {
  const namespaceBytes = uuidToBytes(resolveNamespace(namespace))
  if (typeof name !== 'string' || name === '') throw new Error('名称不能为空')
  const nameBytes = new TextEncoder().encode(name)
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length)
  input.set(namespaceBytes, 0)
  input.set(nameBytes, namespaceBytes.length)

  const hasher = version === 3 ? CryptoJS.algo.MD5 : CryptoJS.algo.SHA1
  const digest = wordArrayToBytes(hasher.create().update(toWordArray(input)).finalize())
  const bytes = digest.slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | (version << 4)
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return formatUuid(bytes)
}

/** Version 3 — MD5 name-based UUID. */
export function uuidV3(namespace, name) {
  return nameBasedUuid(3, namespace, name)
}

/** Version 5 — SHA-1 name-based UUID. */
export function uuidV5(namespace, name) {
  return nameBasedUuid(5, namespace, name)
}

function normalizeVersion(version) {
  const value = typeof version === 'string' ? version.replace(/^v/i, '') : version
  const numeric = Number(value)
  if (!VERSIONS.includes(numeric)) throw new Error(`不支持的 UUID 版本 "${version}"，仅支持 v1 / v3 / v4 / v5`)
  return numeric
}

// 'dns' / 'url' / 'oid' / 'x500' resolve to the standard namespace constants.
export function generateUuid(version, options = {}) {
  const numeric = normalizeVersion(version)
  const { uppercase = false, hyphens = true } = options

  let uuid
  if (numeric === 1) uuid = uuidV1()
  else if (numeric === 4) uuid = uuidV4()
  else {
    const namespace = options.namespace ?? NAMESPACES.dns
    uuid = numeric === 3 ? uuidV3(namespace, options.name) : uuidV5(namespace, options.name)
  }

  const value = hyphens ? uuid : uuid.replace(/-/g, '')
  return uppercase ? value.toUpperCase() : value
}

/** Batch helper used by the UI — same options plus `count`. */
export function generateUuids(version, options = {}) {
  const count = Math.max(1, Math.min(1000, Number(options.count) || 1))
  return Array.from({ length: count }, () => generateUuid(version, options))
}

function variantName(byte) {
  if ((byte & 0x80) === 0x00) return 'NCS 向后兼容'
  if ((byte & 0xc0) === 0x80) return 'RFC 4122'
  if ((byte & 0xe0) === 0xc0) return 'Microsoft COM'
  return '保留（未来定义）'
}

/**
 * Inspect a UUID. Always returns an object; `valid` says whether it parsed.
 * Version 1 UUIDs additionally expose `timestamp` (ISO), `timestampMs`,
 * `clockSeq` and `node`.
 */
export function parseUuid(uuid) {
  let bytes
  try {
    bytes = uuidToBytes(uuid)
  } catch (cause) {
    return { valid: false, version: null, variant: null, formatted: '', error: cause.message }
  }

  const version = bytes[6] >> 4
  const result = {
    valid: true,
    version,
    variant: variantName(bytes[8]),
    formatted: formatUuid(bytes)
  }

  if (version === 1) {
    const timeLow = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
    const timeMid = (bytes[4] << 8) | bytes[5]
    const timeHigh = ((bytes[6] & 0x0f) << 8) | bytes[7]
    const timestamp = (BigInt(timeHigh) << 48n) | (BigInt(timeMid) << 32n) | BigInt(timeLow)
    const milliseconds = Number(timestamp - GREGORIAN_OFFSET) / 10000
    result.timestampMs = milliseconds
    result.timestamp = new Date(milliseconds).toISOString()
    result.clockSeq = ((bytes[8] & 0x3f) << 8) | bytes[9]
    result.node = Array.from(bytes.slice(10), byte => byte.toString(16).padStart(2, '0')).join(':')
  }

  return result
}

const SAMPLE_NAMESPACE = NAMESPACES.dns
const SAMPLE_NAME = 'example.com'
const SAMPLE_UUID = 'f47ac10b-58cc-11cf-a447-001122334455'

function tableRow(label, value) {
  return createElement('tr', {}, [
    createElement('th', { scope: 'row', textContent: label }),
    createElement('td', { className: 'code-text', textContent: value })
  ])
}

export default {
  id: 'uuid-converter',
  name: 'UUID 生成与解析',
  description: '生成与解析 UUID v1/v3/v4/v5，显示版本、变体与内嵌时间戳',
  category: 'generator',
  icon: 'uuid',
  keywords: ['uuid', 'guid', 'v4', 'v5', 'v1', '唯一标识'],
  render(container) {
    let version = 'v4'

    const versionGroup = createSegmentedGroup([
      { label: 'v1 时间戳', value: 'v1' },
      { label: 'v3 MD5', value: 'v3' },
      { label: 'v4 随机', value: 'v4' },
      { label: 'v5 SHA-1', value: 'v5' }
    ], value => {
      version = value
      syncVersionFields()
    }, { label: 'UUID 版本' })

    const countInput = createElement('input', {
      className: 'input', type: 'number', min: '1', max: '100', value: '5', 'aria-label': '生成数量'
    })

    const uppercaseCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox', id: 'uuid-converter-uppercase' })
    const hyphensCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox', id: 'uuid-converter-hyphens', checked: true })
    const optionsRow = createElement('div', { className: 'form-group option-control-group' }, [
      createElement('label', { className: 'option-item' }, [uppercaseCheckbox, createElement('span', { textContent: '大写' })]),
      createElement('label', { className: 'option-item' }, [hyphensCheckbox, createElement('span', { textContent: '带连字符' })])
    ])

    const namespaceSelect = createElement('select', { className: 'select', 'aria-label': '命名空间预设' }, [
      createElement('option', { value: 'dns', textContent: 'DNS' }),
      createElement('option', { value: 'url', textContent: 'URL' }),
      createElement('option', { value: 'oid', textContent: 'OID' }),
      createElement('option', { value: 'x500', textContent: 'X500' }),
      createElement('option', { value: 'custom', textContent: '自定义' })
    ])
    const namespaceInput = createElement('input', {
      className: 'input', type: 'text', value: SAMPLE_NAMESPACE, 'aria-label': '命名空间 UUID'
    })
    const nameInput = createElement('input', {
      className: 'input', type: 'text', placeholder: 'example.com', 'aria-label': '名称'
    })
    const nameRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '命名空间预设' }),
        namespaceSelect
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '命名空间 UUID' }),
        namespaceInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '名称' }),
        nameInput
      ])
    ])

    const output = createElement('textarea', {
      className: 'textarea', rows: 10, readOnly: true, placeholder: '生成的 UUID 将显示在此（每行一个）…'
    })

    const parseInput = createElement('input', {
      className: 'input', type: 'text', placeholder: 'f47ac10b-58cc-11cf-a447-001122334455', 'aria-label': '待解析的 UUID'
    })

    const errorEl = createElement('div', { className: 'error-text' })

    const table = createElement('table', { className: 'result-table' })
    const tbody = createElement('tbody')
    table.append(createElement('thead', {}, [
      createElement('tr', {}, [
        createElement('th', { textContent: '字段' }),
        createElement('th', { textContent: '值' })
      ])
    ]), tbody)
    const tableScroll = createTableScroll(table, 'UUID 解析结果')

    function syncVersionFields() {
      nameRow.hidden = version !== 'v3' && version !== 'v5'
    }

    function generate() {
      errorEl.textContent = ''
      try {
        const options = {
          uppercase: uppercaseCheckbox.checked,
          hyphens: hyphensCheckbox.checked,
          count: Number(countInput.value) || 1
        }
        if (version === 'v3' || version === 'v5') {
          options.namespace = namespaceInput.value.trim()
          options.name = nameInput.value
        }
        output.value = generateUuids(version, options).join('\n')
      } catch (cause) {
        output.value = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    function parse() {
      errorEl.textContent = ''
      const value = parseInput.value.trim()
      if (!value) {
        tbody.replaceChildren(tableRow('提示', '请输入要解析的 UUID'))
        return
      }
      const result = parseUuid(value)
      if (!result.valid) {
        tbody.replaceChildren(tableRow('错误', result.error))
        return
      }
      const rows = [
        tableRow('标准化', result.formatted),
        tableRow('版本', `v${result.version}`),
        tableRow('变体', result.variant)
      ]
      if (result.version === 1) {
        rows.push(
          tableRow('内嵌时间戳', result.timestamp),
          tableRow('时间戳(ms)', String(Math.round(result.timestampMs))),
          tableRow('时钟序列', String(result.clockSeq)),
          tableRow('节点', result.node)
        )
      }
      tbody.replaceChildren(...rows)
    }

    namespaceSelect.addEventListener('change', () => {
      if (namespaceSelect.value !== 'custom') namespaceInput.value = NAMESPACES[namespaceSelect.value]
      generate()
    })
    for (const control of [countInput, uppercaseCheckbox, hyphensCheckbox, namespaceInput, nameInput]) {
      control.addEventListener('input', generate)
      control.addEventListener('change', generate)
    }
    parseInput.addEventListener('input', parse)

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '版本' }),
          versionGroup
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '数量' }),
          countInput
        ]),
        optionsRow
      ]),
      nameRow,
      createElement('div', { className: 'btn-group' }, [
        createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '生成', onClick: generate }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            namespaceSelect.value = 'dns'
            namespaceInput.value = SAMPLE_NAMESPACE
            nameInput.value = SAMPLE_NAME
            parseInput.value = SAMPLE_UUID
            generate()
            parse()
          }
        })
      ]),
      errorEl,
      createSection('生成结果', output),
      createSection('解析 UUID', createElement('div', { className: 'tool-stack' }, [
        parseInput,
        createElement('div', { className: 'btn-group' }, [
          createElement('button', { className: 'btn btn-secondary', type: 'button', textContent: '解析', onClick: parse })
        ]),
        tableScroll
      ]))
    )

    syncVersionFields()
    generate()
    parse()
  }
}
