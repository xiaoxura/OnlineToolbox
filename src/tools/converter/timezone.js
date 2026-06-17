import { createElement, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (纽约)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (洛杉矶)' },
  { value: 'Europe/London', label: 'Europe/London (伦敦)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (巴黎)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (东京)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (上海)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (加尔各答)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (悉尼)' }
]

export default {
  id: 'timezone',
  name: '时区转换',
  description: '在不同时区之间转换时间',
  category: 'converter',
  icon: 'timestamp',

  render(container) {
    const section = createSection('时区转换')

    const inputGroup = createElement('div', { className: 'form-group' })
    const dtLabel = createElement('label', { className: 'label', textContent: '日期时间' })
    const dtInput = createElement('input', {
      className: 'input',
      attrs: { type: 'datetime-local' }
    })
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    dtInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    inputGroup.appendChild(dtLabel)
    inputGroup.appendChild(dtInput)

    const row = createElement('div', { className: 'form-row' })

    const srcGroup = createElement('div', { className: 'form-group' })
    const srcLabel = createElement('label', { className: 'label', textContent: '源时区' })
    const srcSelect = createElement('select', { className: 'select' })
    TIMEZONES.forEach(tz => {
      const opt = createElement('option', { attrs: { value: tz.value }, textContent: tz.label })
      srcSelect.appendChild(opt)
    })
    srcSelect.value = 'Asia/Shanghai'
    srcGroup.appendChild(srcLabel)
    srcGroup.appendChild(srcSelect)

    const tgtGroup = createElement('div', { className: 'form-group' })
    const tgtLabel = createElement('label', { className: 'label', textContent: '目标时区' })
    const tgtSelect = createElement('select', { className: 'select' })
    TIMEZONES.forEach(tz => {
      const opt = createElement('option', { attrs: { value: tz.value }, textContent: tz.label })
      tgtSelect.appendChild(opt)
    })
    tgtSelect.value = 'America/New_York'
    tgtGroup.appendChild(tgtLabel)
    tgtGroup.appendChild(tgtSelect)

    row.appendChild(srcGroup)
    row.appendChild(tgtGroup)

    const btnGroup = createElement('div', { className: 'btn-group' })
    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '转换'
    })
    btnGroup.appendChild(convertBtn)

    const resultBox = createElement('div', { className: 'result-box' })
    const errorText = createElement('div', { className: 'error-text', style: 'display:none' })

    section.appendChild(inputGroup)
    section.appendChild(row)
    section.appendChild(btnGroup)
    section.appendChild(errorText)
    section.appendChild(resultBox)
    container.appendChild(section)

    function formatInTimezone(date, tz) {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date)
    }

    function getTimezoneOffset(date, tz) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset'
      })
      const parts = formatter.formatToParts(date)
      const tzPart = parts.find(p => p.type === 'timeZoneName')
      return tzPart ? tzPart.value : tz
    }

    function convert() {
      errorText.style.display = 'none'
      resultBox.innerHTML = ''

      const dtVal = dtInput.value
      if (!dtVal) {
        errorText.textContent = '请选择日期时间'
        errorText.style.display = 'block'
        return
      }

      const srcTz = srcSelect.value
      const tgtTz = tgtSelect.value

      try {
        const date = new Date(dtVal)
        if (isNaN(date.getTime())) {
          errorText.textContent = '无效的日期时间'
          errorText.style.display = 'block'
          return
        }

        const srcFormatted = formatInTimezone(date, srcTz)
        const tgtFormatted = formatInTimezone(date, tgtTz)
        const srcOffset = getTimezoneOffset(date, srcTz)
        const tgtOffset = getTimezoneOffset(date, tgtTz)

        const statsRow = createElement('div', { className: 'stats-row' })

        const srcItem = createElement('div', { className: 'stat-item' })
        const srcLabelEl = createElement('span', {
          className: 'stat-label',
          textContent: `源时间 (${srcTz})`
        })
        const srcValue = createElement('span', { className: 'stat-value', textContent: srcFormatted })
        srcItem.appendChild(srcLabelEl)
        srcItem.appendChild(srcValue)
        statsRow.appendChild(srcItem)

        const tgtItem = createElement('div', { className: 'stat-item' })
        const tgtLabelEl = createElement('span', {
          className: 'stat-label',
          textContent: `目标时间 (${tgtTz})`
        })
        const tgtValue = createElement('span', { className: 'stat-value', textContent: tgtFormatted })
        tgtItem.appendChild(tgtLabelEl)
        tgtItem.appendChild(tgtValue)
        statsRow.appendChild(tgtItem)

        resultBox.appendChild(statsRow)

        const offsetRow = createElement('div', { className: 'stats-row' })
        const offsetItem = createElement('div', { className: 'stat-item' })
        const offsetLabel = createElement('span', {
          className: 'stat-label',
          textContent: '时区偏移'
        })
        const offsetValue = createElement('span', {
          className: 'stat-value',
          textContent: `${srcOffset} → ${tgtOffset}`
        })
        offsetItem.appendChild(offsetLabel)
        offsetItem.appendChild(offsetValue)
        offsetRow.appendChild(offsetItem)
        resultBox.appendChild(offsetRow)

        const copyBtn = createElement('button', {
          className: 'btn btn-secondary',
          textContent: '复制转换结果'
        })
        copyBtn.addEventListener('click', () => {
          copyToClipboard(tgtFormatted)
          copyBtn.textContent = '已复制'
          setTimeout(() => { copyBtn.textContent = '复制转换结果' }, 1500)
        })
        resultBox.appendChild(copyBtn)
      } catch {
        errorText.textContent = '时区转换失败，请检查输入'
        errorText.style.display = 'block'
      }
    }

    convertBtn.addEventListener('click', convert)
  }
}
