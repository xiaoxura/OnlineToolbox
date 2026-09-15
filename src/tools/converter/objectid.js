import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

// A MongoDB ObjectId is 24 hex characters (12 bytes):
//   0-3   seconds since the Unix epoch, big-endian
//   4-8   random value, unique to the machine and process
//   9-11  counter, starting at a random value
// Decoding it recovers the creation time; the rest is opaque uniqueness padding.

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/
const MAX_TIMESTAMP_SECONDS = 0xFFFFFFFF

export function parseObjectId(hex) {
  const text = String(hex ?? '').trim()
  if (!OBJECT_ID_PATTERN.test(text)) {
    return {
      valid: false,
      hex: text,
      error: 'ObjectId 必须是 24 位十六进制字符串，例如 507f1f77bcf86cd799439011'
    }
  }
  const lower = text.toLowerCase()
  const timestampSeconds = parseInt(lower.slice(0, 8), 16)
  const timestamp = new Date(timestampSeconds * 1000)
  return {
    valid: true,
    hex: lower,
    timestamp,
    timestampSeconds,
    iso: timestamp.toISOString(),
    random: lower.slice(8, 18),
    counter: parseInt(lower.slice(18, 24), 16)
  }
}

function normalizeSeconds(timestamp) {
  const seconds = timestamp instanceof Date ? Math.floor(timestamp.getTime() / 1000) : Number(timestamp)
  if (!Number.isFinite(seconds)) throw new Error('时间戳必须是数字（Unix 秒）或日期')
  const whole = Math.floor(seconds)
  if (whole < 0 || whole > MAX_TIMESTAMP_SECONDS) {
    throw new Error('时间戳超出 ObjectId 的 4 字节范围（1970-01-01 ~ 2106-02-07）')
  }
  return whole
}

function randomHex(length) {
  const bytes = new Uint8Array(Math.ceil(length / 2))
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  }
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, length)
}

// The counter is process-wide and starts at a random value, like the driver's.
let counter = Math.floor(Math.random() * 0x1000000)

function nextCounterHex() {
  counter = (counter + 1) % 0x1000000
  return counter.toString(16).padStart(6, '0')
}

export function timestampToObjectId(timestamp) {
  const seconds = normalizeSeconds(timestamp)
  return seconds.toString(16).padStart(8, '0') + randomHex(10) + nextCounterHex()
}

export function objectIdToTimestamp(hex) {
  const parsed = parseObjectId(hex)
  if (!parsed.valid) throw new Error(parsed.error)
  return parsed.timestamp
}

export function generateObjectId(date) {
  const seconds = date === undefined ? Math.floor(Date.now() / 1000) : normalizeSeconds(date)
  return seconds.toString(16).padStart(8, '0') + randomHex(10) + nextCounterHex()
}

// Batch helper: one ObjectId per line, blank lines ignored.
export function parseObjectIds(text) {
  const rows = []
  String(text ?? '').split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return
    rows.push({ line: index + 1, source: trimmed, result: parseObjectId(trimmed) })
  })
  return rows
}

const SAMPLE_IDS = '507f1f77bcf86cd799439011\n5f2f1c2b9a3d4e5f6a7b8c9d\n000000000000000000000000'

export default {
  id: 'objectid',
  name: 'MongoDB ObjectId',
  description: '在时间戳与 ObjectId 之间互转并解析其结构',
  category: 'converter',
  icon: 'uuid',
  keywords: ['mongodb', 'objectid', 'bson', '_id', '时间戳', '随机数'],
  render(container) {
    const mode = createSegmentedGroup([
      { value: 'ts2id', label: '时间戳 → ObjectId' },
      { value: 'id2ts', label: 'ObjectId → 时间戳' },
      { value: 'generate', label: '批量生成' }
    ], () => {
      syncMode()
      run()
    }, { label: '转换模式' })

    const timestampInput = createElement('input', {
      className: 'input',
      placeholder: '例如 1700000000',
      value: String(Math.floor(Date.now() / 1000))
    })

    const idsInput = createElement('textarea', {
      className: 'textarea',
      rows: 6,
      placeholder: '每行一个 ObjectId，例如\n507f1f77bcf86cd799439011'
    })

    const countInput = createElement('input', { className: 'input', value: '5', placeholder: '1 - 50' })
    const baseTimestampInput = createElement('input', { className: 'input', placeholder: '留空表示当前时间（Unix 秒）' })

    const tsGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: 'Unix 时间戳（秒）' }),
      timestampInput
    ])
    const idGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: 'ObjectId 列表（每行一个）' }),
      idsInput
    ])
    const generateGroup = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '生成数量（1-50）' }),
        countInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '基准时间戳（可选）' }),
        baseTimestampInput
      ])
    ])

    const errorEl = createElement('div', { className: 'error-text' })
    const statsRow = createElement('div', { className: 'stats-row' })

    const table = createElement('table', { className: 'result-table' })
    const tbody = createElement('tbody')
    table.append(
      createElement('thead', {}, [
        createElement('tr', {}, [
          createElement('th', { textContent: 'ObjectId' }),
          createElement('th', { textContent: '时间戳（秒）' }),
          createElement('th', { textContent: 'ISO 时间' }),
          createElement('th', { textContent: '随机数' }),
          createElement('th', { textContent: '计数器' })
        ])
      ]),
      tbody
    )
    const tableScroll = createTableScroll(table, 'ObjectId 解析结果')
    const resultStack = createElement('div', { className: 'tool-stack' }, [statsRow, tableScroll])

    const primaryBtn = createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '转换', onClick: () => run() })
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        const current = mode.getValue()
        if (current === 'ts2id') timestampInput.value = '1700000000'
        else if (current === 'id2ts') idsInput.value = SAMPLE_IDS
        else {
          countInput.value = '5'
          baseTimestampInput.value = '1700000000'
        }
        run()
      }
    })

    const isTs2Id = () => mode.getValue() === 'ts2id'
    const isId2Ts = () => mode.getValue() === 'id2ts'

    function syncMode() {
      tsGroup.hidden = !isTs2Id()
      idGroup.hidden = !isId2Ts()
      generateGroup.hidden = isTs2Id() || isId2Ts()
      primaryBtn.textContent = isTs2Id() ? '生成 ObjectId' : isId2Ts() ? '解析 ObjectId' : '批量生成'
      tbody.replaceChildren()
      statsRow.replaceChildren()
      errorEl.textContent = ''
    }

    function renderStats(result) {
      statsRow.replaceChildren(
        createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: '时间戳' }),
          createElement('span', { className: 'stat-value', textContent: result.hex.slice(0, 8) })
        ]),
        createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: 'Unix 秒' }),
          createElement('span', { className: 'stat-value', textContent: String(result.timestampSeconds) })
        ]),
        createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: 'ISO 时间' }),
          createElement('span', { className: 'stat-value', textContent: result.iso })
        ]),
        createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: '随机部分' }),
          createElement('span', { className: 'stat-value', textContent: result.random })
        ]),
        createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: '计数器' }),
          createElement('span', { className: 'stat-value', textContent: String(result.counter) })
        ])
      )
    }

    function appendRow(hex, result) {
      const invalid = !result.valid
      tbody.appendChild(createElement('tr', {}, [
        createElement('th', { scope: 'row', className: 'code-text', textContent: hex }),
        createElement('td', { textContent: invalid ? '—' : String(result.timestampSeconds) }),
        createElement('td', { textContent: invalid ? '无法解析' : result.iso }),
        createElement('td', { className: 'code-text', textContent: invalid ? '—' : result.random }),
        createElement('td', { textContent: invalid ? '—' : String(result.counter) })
      ]))
    }

    function run() {
      errorEl.textContent = ''
      tbody.replaceChildren()
      statsRow.replaceChildren()
      try {
        if (isTs2Id()) {
          const hex = timestampToObjectId(timestampInput.value.trim())
          const result = parseObjectId(hex)
          renderStats(result)
          appendRow(hex, result)
          return
        }
        if (isId2Ts()) {
          const rows = parseObjectIds(idsInput.value)
          if (!rows.length) return
          const invalidLines = rows.filter(row => !row.result.valid).map(row => row.line)
          for (const row of rows) appendRow(row.source, row.result)
          const first = rows.find(row => row.result.valid)
          if (first) renderStats(first.result)
          if (invalidLines.length) errorEl.textContent = `第 ${invalidLines.join('、')} 行不是合法的 24 位十六进制 ObjectId`
          return
        }
        const count = Number(countInput.value)
        if (!Number.isInteger(count) || count < 1 || count > 50) {
          throw new Error('生成数量必须是 1 到 50 之间的整数')
        }
        const base = baseTimestampInput.value.trim()
        for (let index = 0; index < count; index++) {
          const hex = base ? timestampToObjectId(Number(base)) : generateObjectId()
          const result = parseObjectId(hex)
          if (index === 0) renderStats(result)
          appendRow(hex, result)
        }
      } catch (cause) {
        tbody.replaceChildren()
        statsRow.replaceChildren()
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const inputStack = createElement('div', { className: 'tool-stack' }, [tsGroup, idGroup, generateGroup])

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '转换模式' }),
          mode
        ])
      ]),
      createElement('div', { className: 'btn-group' }, [primaryBtn, sampleBtn]),
      errorEl,
      createSection('输入', inputStack),
      createSection('解析结果', resultStack)
    )

    syncMode()
  }
}
