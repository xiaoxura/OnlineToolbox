import { LUNAR_INFO, TERM_INFO } from './lunar-data.js'
import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

// Chinese lunisolar calendar conversion for the 1900-2100 window. The two data
// tables live in ./lunar-data.js; everything below is derived from them.

const MIN_YEAR = 1900
const MAX_YEAR = 2100
// 1900-01-31 is lunar 1900-01-01, the first day the tables can describe.
const EPOCH_UTC = Date.UTC(1900, 0, 31)
const DAY_MS = 86400000

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
]
const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const DAY_TENS = ['初', '十', '廿', '卅']
const DAY_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const YEAR_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export const SOLAR_TERM_NAMES = TERM_NAMES

function isSupportedYear(year) {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function solarMonthDays(year, month) {
  if (month < 1 || month > 12) return 0
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

// --- Lunar year anatomy ----------------------------------------------------

// The leap month number of a lunar year, or 0 when it has none.
export function leapMonth(year) {
  if (!isSupportedYear(year)) return 0
  return LUNAR_INFO[year - MIN_YEAR] & 0xf
}

export function leapMonthDays(year) {
  if (!leapMonth(year)) return 0
  return LUNAR_INFO[year - MIN_YEAR] & 0x10000 ? 30 : 29
}

export function lunarMonthDays(year, month) {
  if (!isSupportedYear(year) || month < 1 || month > 12) return 0
  return LUNAR_INFO[year - MIN_YEAR] & (0x10000 >> month) ? 30 : 29
}

export function lunarYearDays(year) {
  if (!isSupportedYear(year)) return 0
  let days = 0
  for (let month = 1; month <= 12; month++) days += lunarMonthDays(year, month)
  return days + leapMonthDays(year)
}

// Every month of a lunar year in calendar order, with the leap month inserted
// directly after the month it duplicates.
export function lunarMonthsOfYear(year) {
  const leap = leapMonth(year)
  const months = []
  for (let month = 1; month <= 12; month++) {
    months.push({ month, isLeap: false, days: lunarMonthDays(year, month) })
    if (month === leap) months.push({ month, isLeap: true, days: leapMonthDays(year) })
  }
  return months
}

// --- Solar terms -----------------------------------------------------------

function padDigits(hexGroup) {
  return parseInt(hexGroup, 16).toString().padStart(6, '0')
}

// Day of the n-th solar term (1 = 小寒 … 24 = 冬至) in a given Gregorian year.
export function solarTermDay(year, index) {
  if (!isSupportedYear(year) || index < 1 || index > 24) return 0
  const table = TERM_INFO[year - MIN_YEAR]
  const groupIndex = Math.floor((index - 1) / 4)
  const digits = padDigits(table.slice(groupIndex * 5, groupIndex * 5 + 5))
  switch ((index - 1) % 4) {
    case 0: return Number(digits[0])
    case 1: return Number(digits.slice(1, 3))
    case 2: return Number(digits[3])
    default: return Number(digits.slice(4, 6))
  }
}

// Name of the solar term that falls on the given Gregorian date, or ''.
export function getSolarTerm(year, month, day) {
  if (!isSupportedYear(year) || month < 1 || month > 12) return ''
  const first = month * 2 - 1
  if (solarTermDay(year, first) === day) return TERM_NAMES[first - 1]
  if (solarTermDay(year, first + 1) === day) return TERM_NAMES[first]
  return ''
}

export function getSolarTermsOfMonth(year, month) {
  if (!isSupportedYear(year) || month < 1 || month > 12) return []
  const first = month * 2 - 1
  return [
    { name: TERM_NAMES[first - 1], day: solarTermDay(year, first) },
    { name: TERM_NAMES[first], day: solarTermDay(year, first + 1) }
  ]
}

// --- Stem-branch / zodiac --------------------------------------------------

export function getHeavenlyStemAndEarthlyBranch(year) {
  const offset = (((year - 4) % 60) + 60) % 60
  return HEAVENLY_STEMS[offset % 10] + EARTHLY_BRANCHES[offset % 12]
}

export function getZodiac(year) {
  return ZODIAC[((((year - 4) % 12) + 12) % 12)]
}

// The stem-branch year runs from 立春, not from 1 January.
function ganzhiYearForDate(year, month, day) {
  const lichun = solarTermDay(year, 3)
  const effective = month < 2 || (month === 2 && day < lichun) ? year - 1 : year
  return effective
}

// The stem-branch month runs from the 节 (odd-indexed term) that opens it.
function ganzhiMonthForDate(year, month, day) {
  const openingDay = solarTermDay(year, month * 2 - 1)
  const shift = day >= openingDay ? 12 : 11
  const offset = ((year - MIN_YEAR) * 12 + month + shift) % 60
  return HEAVENLY_STEMS[offset % 10] + EARTHLY_BRANCHES[offset % 12]
}

// 1900-01-01 is 甲戌, i.e. index 10 of the 60-day cycle.
function ganzhiDayForDate(year, month, day) {
  const firstOfMonth = Math.floor(Date.UTC(year, month - 1, 1) / DAY_MS)
  const offset = ((firstOfMonth + 25567 + 10 + day - 1) % 60 + 60) % 60
  return HEAVENLY_STEMS[offset % 10] + EARTHLY_BRANCHES[offset % 12]
}

// --- Text formatters -------------------------------------------------------

export function formatLunarYear(year) {
  return String(year).split('').map(digit => YEAR_DIGITS[Number(digit)]).join('') + '年'
}

export function formatLunarMonth(month, isLeap = false) {
  if (month < 1 || month > 12) return ''
  return (isLeap ? '闰' : '') + MONTH_NAMES[month - 1] + '月'
}

export function formatLunarDay(day) {
  if (day < 1 || day > 30) return ''
  if (day === 10) return '初十'
  if (day === 20) return '二十'
  if (day === 30) return '三十'
  return DAY_TENS[Math.floor(day / 10)] + DAY_DIGITS[day % 10]
}

export function formatWeekday(index) {
  return WEEKDAYS[index] || ''
}

// --- Conversion ------------------------------------------------------------

export function solarToLunar(year, month, day) {
  year = Number(year)
  month = Number(month)
  day = Number(day)
  if (!isSupportedYear(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > solarMonthDays(year, month)) return null

  let offset = Math.round((Date.UTC(year, month - 1, day) - EPOCH_UTC) / DAY_MS)
  if (offset < 0) return null

  let lunarYear = MIN_YEAR
  while (lunarYear <= MAX_YEAR) {
    const daysInYear = lunarYearDays(lunarYear)
    if (offset < daysInYear) break
    offset -= daysInYear
    lunarYear++
  }
  if (lunarYear > MAX_YEAR) return null

  const months = lunarMonthsOfYear(lunarYear)
  let cursor = offset
  let entry = months[months.length - 1]
  for (const candidate of months) {
    if (cursor < candidate.days) { entry = candidate; break }
    cursor -= candidate.days
  }

  return buildResult({
    solar: { year, month, day },
    lunarYear,
    lunarMonth: entry.month,
    lunarDay: cursor + 1,
    isLeapMonth: entry.isLeap
  })
}

export function lunarToSolar(year, month, day, isLeapMonth = false) {
  year = Number(year)
  month = Number(month)
  day = Number(day)
  isLeapMonth = Boolean(isLeapMonth)
  if (!isSupportedYear(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null

  const months = lunarMonthsOfYear(year)
  const index = months.findIndex(entry => entry.month === month && entry.isLeap === isLeapMonth)
  if (index < 0) return null
  if (day < 1 || day > months[index].days) return null

  let offset = 0
  for (let y = MIN_YEAR; y < year; y++) offset += lunarYearDays(y)
  for (let i = 0; i < index; i++) offset += months[i].days
  offset += day - 1

  const date = new Date(EPOCH_UTC + offset * DAY_MS)
  const solar = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
  if (solar.year > MAX_YEAR) return null

  return buildResult({
    solar,
    lunarYear: year,
    lunarMonth: month,
    lunarDay: day,
    isLeapMonth
  })
}

function buildResult({ solar, lunarYear, lunarMonth, lunarDay, isLeapMonth }) {
  const { year, month, day } = solar
  const zodiacYear = ganzhiYearForDate(year, month, day)
  const monthText = formatLunarMonth(lunarMonth, isLeapMonth)
  const dayText = formatLunarDay(lunarDay)
  return {
    solarYear: year,
    solarMonth: month,
    solarDay: day,
    lunarYear,
    lunarMonth,
    lunarDay,
    isLeapMonth,
    lunarText: `${formatLunarYear(lunarYear)}${monthText}${dayText}`,
    monthText,
    dayText,
    ganzhiYear: getHeavenlyStemAndEarthlyBranch(zodiacYear),
    ganzhiMonth: ganzhiMonthForDate(year, month, day),
    ganzhiDay: ganzhiDayForDate(year, month, day),
    zodiac: getZodiac(zodiacYear),
    solarTerm: getSolarTerm(year, month, day),
    weekdayIndex: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    weekday: formatWeekday(new Date(Date.UTC(year, month - 1, day)).getUTCDay()),
    dayOfYear: Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY_MS) + 1,
    daysInYear: isLeapYear(year) ? 366 : 365
  }
}

// --- UI --------------------------------------------------------------------

const SAMPLE_SOLAR = '2024-02-10'
const SAMPLE_LUNAR = { year: 2024, month: 1, day: 1, isLeap: false }

function yearOptions() {
  const options = []
  for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
    options.push(createElement('option', { value: String(year), textContent: `${year} 年` }))
  }
  return options
}

export default {
  id: 'lunar-calendar',
  name: '农历 ↔ 公历',
  description: '公历与农历互转，显示天干地支、生肖、节气与星期',
  category: 'converter',
  icon: 'timestamp',
  keywords: ['农历', '公历', '阴历', '阳历', '干支', '生肖', '节气', 'lunar'],
  render(container) {
    const mode = createSegmentedGroup([
      { value: 'solar-to-lunar', label: '公历 → 农历' },
      { value: 'lunar-to-solar', label: '农历 → 公历' }
    ], () => { syncPanels(); run() }, { label: '转换方向' })

    const dateInput = createElement('input', {
      className: 'input',
      type: 'date',
      min: '1900-01-31',
      max: '2100-12-31',
      value: SAMPLE_SOLAR,
      'aria-label': '公历日期'
    })

    const yearSelect = createElement('select', { className: 'select', 'aria-label': '农历年份' }, yearOptions())
    yearSelect.value = String(SAMPLE_LUNAR.year)
    const monthSelect = createElement('select', { className: 'select', 'aria-label': '农历月份' },
      MONTH_NAMES.map((name, index) => createElement('option', {
        value: String(index + 1),
        textContent: `${name}月`
      })))
    monthSelect.value = String(SAMPLE_LUNAR.month)
    const daySelect = createElement('select', { className: 'select', 'aria-label': '农历日期' })

    const leapCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    const leapLabel = createElement('label', { className: 'option-item' }, [
      leapCheckbox,
      createElement('span', { textContent: '闰月' })
    ])
    const leapHint = createElement('div', { className: 'form-hint' })

    const solarPanel = createElement('div', { className: 'tool-stack' }, [
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '公历日期' }),
          dateInput
        ])
      ])
    ])

    const lunarPanel = createElement('div', { className: 'tool-stack', hidden: true }, [
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '农历年份' }),
          yearSelect
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '农历月份' }),
          monthSelect
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '农历日期' }),
          daySelect
        ])
      ]),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [leapLabel, leapHint])
      ])
    ])

    const errorEl = createElement('div', { className: 'error-text' })

    const table = createElement('table', { className: 'result-table' })
    const tbody = createElement('tbody')
    table.appendChild(tbody)
    const resultBox = createElement('div', { className: 'result-box' }, [
      createTableScroll(table, '农历转换结果')
    ])

    const isSolarMode = () => mode.getValue() === 'solar-to-lunar'

    function refreshLeapAvailability() {
      const year = Number(yearSelect.value)
      const month = Number(monthSelect.value)
      const leap = leapMonth(year)
      const available = leap === month
      leapCheckbox.disabled = !available
      if (!available) leapCheckbox.checked = false
      leapHint.textContent = available
        ? `${year} 年有闰${MONTH_NAMES[leap - 1]}月`
        : leap
          ? `${year} 年闰${MONTH_NAMES[leap - 1]}月，与本月的${MONTH_NAMES[month - 1]}月不匹配`
          : `${year} 年没有闰月`
    }

    function refreshDayOptions() {
      const year = Number(yearSelect.value)
      const month = Number(monthSelect.value)
      const useLeap = leapCheckbox.checked && leapMonth(year) === month
      const days = useLeap ? leapMonthDays(year) : lunarMonthDays(year, month)
      const previous = Number(daySelect.value) || 1
      daySelect.replaceChildren(...Array.from({ length: days }, (_, index) => createElement('option', {
        value: String(index + 1),
        textContent: `${formatLunarDay(index + 1)}（${index + 1}）`
      })))
      daySelect.value = String(Math.min(previous, days))
    }

    function syncPanels() {
      const solarMode = isSolarMode()
      solarPanel.hidden = !solarMode
      lunarPanel.hidden = solarMode
    }

    function addRow(label, value, extraClass) {
      tbody.appendChild(createElement('tr', {}, [
        createElement('th', { scope: 'row', textContent: label }),
        createElement('td', { className: extraClass, textContent: value })
      ]))
    }

    function run() {
      errorEl.textContent = ''
      tbody.replaceChildren()
      try {
        const result = isSolarMode() ? fromSolarInput() : fromLunarInput()
        if (!result) {
          resultBox.hidden = true
          return
        }
        resultBox.hidden = false
        addRow('农历日期', `${result.lunarText}（${result.lunarYear}-${result.lunarMonth}-${result.lunarDay}${result.isLeapMonth ? ' 闰' : ''}）`)
        addRow('公历日期', `${result.solarYear} 年 ${result.solarMonth} 月 ${result.solarDay} 日 ${result.weekday}`)
        addRow('干支', `${result.ganzhiYear}年 ${result.ganzhiMonth}月 ${result.ganzhiDay}日`)
        addRow('生肖', result.zodiac)
        addRow('节气', result.solarTerm ? `${result.solarTerm}（当日节气）` : `无（本月节气：${getSolarTermsOfMonth(result.solarYear, result.solarMonth).map(item => `${item.name} ${item.day} 日`).join('、')}）`)
        addRow('年内第几天', `第 ${result.dayOfYear} 天 / 共 ${result.daysInYear} 天`)
      } catch (cause) {
        resultBox.hidden = true
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    function fromSolarInput() {
      const raw = dateInput.value
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw || '')
      if (!match) throw new Error('请选择 1900-01-31 至 2100-12-31 之间的公历日期')
      const result = solarToLunar(Number(match[1]), Number(match[2]), Number(match[3]))
      if (!result) throw new Error('该日期超出 1900-2100 年的农历数据范围')
      return result
    }

    function fromLunarInput() {
      const result = lunarToSolar(
        Number(yearSelect.value),
        Number(monthSelect.value),
        Number(daySelect.value),
        leapCheckbox.checked
      )
      if (!result) throw new Error('该农历日期不存在，请检查年份、月份、闰月与日期')
      return result
    }

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        if (isSolarMode()) {
          dateInput.value = SAMPLE_SOLAR
        } else {
          yearSelect.value = String(SAMPLE_LUNAR.year)
          monthSelect.value = String(SAMPLE_LUNAR.month)
          refreshLeapAvailability()
          refreshDayOptions()
          leapCheckbox.checked = SAMPLE_LUNAR.isLeap
          refreshDayOptions()
        }
        run()
      }
    })

    dateInput.addEventListener('input', run)
    yearSelect.addEventListener('change', () => { refreshLeapAvailability(); refreshDayOptions(); run() })
    monthSelect.addEventListener('change', () => { refreshLeapAvailability(); refreshDayOptions(); run() })
    daySelect.addEventListener('change', run)
    leapCheckbox.addEventListener('change', () => {
      const year = Number(yearSelect.value)
      const month = Number(monthSelect.value)
      if (leapCheckbox.checked && leapMonth(year) !== month) leapCheckbox.checked = false
      refreshDayOptions()
      run()
    })

    refreshLeapAvailability()
    refreshDayOptions()

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '转换方向' }),
          mode
        ])
      ]),
      solarPanel,
      lunarPanel,
      createElement('div', { className: 'btn-group' }, [sampleBtn]),
      errorEl,
      createSection('转换结果', resultBox)
    )

    resultBox.hidden = true
    run()
  }
}
