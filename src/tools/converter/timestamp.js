import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'timestamp',
  name: '时间戳转换',
  description: 'Unix 时间戳与日期时间相互转换',
  category: 'converter',
  icon: 'timestamp',
  render(container) {
    // Current timestamp display
    const currentTimeEl = createElement('div', { className: 'live-timestamp' })
    const currentDateEl = createElement('div', { className: 'sub-label' })

    function refreshCurrentTime() {
      const now = Date.now()
      const sec = Math.floor(now / 1000)
      currentTimeEl.textContent = `${sec} / ${now}`
      currentDateEl.textContent = formatTimestamp(sec, 'local')
    }

    const currentSection = createSection('当前时间戳', createElement('div', {}, [currentTimeEl, currentDateEl]))
    container.appendChild(currentSection)

    refreshCurrentTime()
    const timer = setInterval(refreshCurrentTime, 1000)

    // Cleanup on re-render
    container.addEventListener('DOMNodeRemoved', () => clearInterval(timer))

    // --- Section 1: Timestamp → Date ---
    const tsInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '输入时间戳（秒或毫秒，自动识别）'
    })

    const formatSelect = createElement('select', { className: 'select' }, [
      createElement('option', { value: 'iso', textContent: 'ISO 8601' }),
      createElement('option', { value: 'local', textContent: '本地时间' }),
      createElement('option', { value: 'utc', textContent: 'UTC' })
    ])

    const tsResult = createElement('div', {
      className: 'inline-result'
    })

    const tsCopyBtn = createCopyButton(() => tsResult.textContent)

    function convertTimestampToDate() {
      const val = tsInput.value.trim()
      if (!val) { tsResult.textContent = ''; return }
      const num = Number(val)
      if (isNaN(num)) { tsResult.textContent = '请输入有效数字'; return }

      // Auto-detect: if > 1e12, treat as milliseconds; otherwise seconds
      const ms = num > 1e12 ? num : num * 1000
      const fmt = formatSelect.value
      tsResult.textContent = formatTimestamp(ms, fmt)
    }

    tsInput.addEventListener('input', convertTimestampToDate)
    formatSelect.addEventListener('change', convertTimestampToDate)

    const tsInputRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '时间戳' }),
        tsInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '格式' }),
        formatSelect
      ])
    ])
    const tsContent = createElement('div', {}, [tsInputRow, tsResult])
    const tsSection = createSection('时间戳 → 日期', tsContent, [tsCopyBtn])
    container.appendChild(tsSection)

    // --- Section 2: Date → Timestamp ---
    const dateInput = createElement('input', {
      className: 'input',
      type: 'datetime-local'
    })

    // Set default to now
    const now = new Date()
    dateInput.value = localISOString(now)

    const dateResult = createElement('div', {
      className: 'inline-result'
    })

    const dateCopyBtn = createCopyButton(() => dateResult.textContent)

    function convertDateToTimestamp() {
      const val = dateInput.value
      if (!val) { dateResult.textContent = ''; return }
      const date = new Date(val)
      if (isNaN(date.getTime())) { dateResult.textContent = '无效日期'; return }
      const ms = date.getTime()
      const sec = Math.floor(ms / 1000)
      dateResult.textContent = `秒: ${sec}　毫秒: ${ms}`
    }

    dateInput.addEventListener('input', convertDateToTimestamp)
    convertDateToTimestamp()

    const dateContent = createElement('div', {}, [dateInput, dateResult])
    const dateSection = createSection('日期 → 时间戳', dateContent, [dateCopyBtn])
    container.appendChild(dateSection)
  }
}

function formatTimestamp(ms, fmt) {
  const date = new Date(ms)
  switch (fmt) {
    case 'iso':
      return date.toISOString()
    case 'utc':
      return date.toUTCString()
    case 'local':
    default:
      return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }
}

function localISOString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}
