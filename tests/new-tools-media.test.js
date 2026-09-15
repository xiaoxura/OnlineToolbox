import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { enhanceFormAccessibility } from '../src/utils/dom.js'

import lunarCalendar, {
  solarToLunar,
  lunarToSolar,
  getSolarTerm,
  getHeavenlyStemAndEarthlyBranch,
  getZodiac,
  leapMonth,
  leapMonthDays,
  lunarMonthDays,
  lunarYearDays,
  getSolarTermsOfMonth,
  formatLunarDay,
  formatLunarMonth,
  formatLunarYear
} from '../src/tools/converter/lunar-calendar.js'
import { LUNAR_INFO, TERM_INFO } from '../src/tools/converter/lunar-data.js'

import barcode, { computeCheckDigit, validateBarcodeInput, BARCODE_TYPES } from '../src/tools/generator/barcode.js'
import wifiQr, { buildWifiPayload, escapeWifiValue } from '../src/tools/generator/wifi-qr.js'
import percentage, {
  percentOf,
  whatPercent,
  percentChange,
  addPercent,
  subtractPercent,
  discount,
  ratioToPercent,
  percentagePoints,
  formatNumber
} from '../src/tools/math/percentage.js'
import faviconGenerator, {
  buildIco,
  buildIconHtml,
  buildWebManifest,
  dataUrlToBytes,
  formatBytes,
  FAVICON_SIZES
} from '../src/tools/image/favicon-generator.js'
import exifTool, {
  stripJpegMetadata,
  stripPngMetadata,
  stripMetadata,
  isJpeg,
  isPng,
  decimalToDms,
  formatExposureTime,
  formatExifDate,
  groupMetadata,
  METADATA_GROUPS
} from '../src/tools/image/exif.js'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  root = null
})

// --- helpers ---------------------------------------------------------------

function indexOfSequence(haystack, needle) {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

function bytes(...values) {
  return new Uint8Array(values)
}

// A minimal but structurally valid JPEG: SOI, JFIF APP0, EXIF APP1, an SOS
// header followed by scan data, then EOI.
function buildSyntheticJpeg() {
  const app0 = [
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, // 'JFIF\0'
    0x01, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00
  ]
  const app1 = [
    0xff, 0xe1, 0x00, 0x10,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // 'Exif\0\0'
    0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88
  ]
  const comment = [0xff, 0xfe, 0x00, 0x08, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46]
  const sos = [
    0xff, 0xda, 0x00, 0x0c,
    0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00
  ]
  const scan = [0x12, 0x34, 0x56, 0xff, 0x00, 0xab, 0xff, 0xd9]
  return Uint8Array.from([0xff, 0xd8, ...app0, ...app1, ...comment, ...sos, ...scan])
}

function pngChunk(type, data) {
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length, false)
  for (let index = 0; index < 4; index++) chunk[4 + index] = type.charCodeAt(index)
  chunk.set(data, 8)
  return chunk
}

function buildSyntheticPng() {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const ihdr = pngChunk('IHDR', new Uint8Array(13))
  const text = pngChunk('tEXt', Uint8Array.from([0x41, 0x75, 0x74, 0x68, 0x6f, 0x72]))
  const itxt = pngChunk('iTXt', Uint8Array.from([1, 2, 3]))
  const ztxt = pngChunk('zTXt', Uint8Array.from([4, 5]))
  const exif = pngChunk('eXIf', Uint8Array.from([6, 7, 8, 9]))
  const time = pngChunk('tIME', Uint8Array.from([0x07, 0xe8, 1, 2, 3, 4, 5]))
  const idat = pngChunk('IDAT', Uint8Array.from([0xaa, 0xbb, 0xcc]))
  const iend = pngChunk('IEND', new Uint8Array(0))
  const total = signature.length + [ihdr, text, itxt, ztxt, exif, time, idat, iend]
    .reduce((sum, chunk) => sum + chunk.length, 0)
  const png = new Uint8Array(total)
  png.set(signature, 0)
  let offset = signature.length
  for (const chunk of [ihdr, text, itxt, ztxt, exif, time, idat, iend]) {
    png.set(chunk, offset)
    offset += chunk.length
  }
  return png
}

// Mirrors tests/tools-smoke.test.js so these six tools satisfy the same
// structural rules the registry-wide smoke test enforces.
const HARD_RULE_TOOLS = [
  ['lunar-calendar', lunarCalendar],
  ['barcode', barcode],
  ['wifi-qr', wifiQr],
  ['percentage', percentage],
  ['favicon-generator', faviconGenerator],
  ['exif', exifTool]
]

describe('hard rules shared by every tool', () => {
  for (const [id, tool] of HARD_RULE_TOOLS) {
    it(`${id} renders synchronously and satisfies the structural rules`, () => {
      expect(() => {
        const result = tool.render(root)
        expect(result).toBeUndefined()
      }).not.toThrow()

      enhanceFormAccessibility(root)
      expect(root.childElementCount).toBeGreaterThan(0)

      for (const control of root.querySelectorAll('input, textarea, select')) {
        const named = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
        expect(Boolean(named), `${id}: unnamed ${control.tagName}`).toBe(true)
      }

      expect(root.querySelector('select.input'), `${id}: select uses text-input styling`).toBeNull()
      expect(root.querySelector('button[class="btn"]'), `${id}: button has no variant`).toBeNull()

      for (const choice of root.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
        expect(choice.closest('label'), `${id}: choice is not wrapped by a label`).not.toBeNull()
      }

      expect(root.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box')).toBeNull()

      for (const table of root.querySelectorAll('table.result-table')) {
        expect(table.parentElement?.classList.contains('table-scroll'), `${id}: table is not scrollable`).toBe(true)
      }

      for (const tab of root.querySelectorAll('[role="tab"]')) {
        const panelId = tab.getAttribute('aria-controls')
        expect(panelId, `${id}: tab without aria-controls`).toBeTruthy()
        expect(root.querySelector(`#${panelId}`)?.getAttribute('role')).toBe('tabpanel')
      }

      for (const group of root.querySelectorAll('[role="radiogroup"]')) {
        expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
      }

      expect(tool.id).toBe(id)
    })
  }

  it('每个工具都带有 示例数据 按钮（有文本输入时）', () => {
    for (const [id, tool] of HARD_RULE_TOOLS) {
      tool.render(root)
      const hasTextInput = root.querySelector('input[type="text"], textarea:not([readonly])')
      const labels = [...root.querySelectorAll('button')].map(button => button.textContent)
      if (hasTextInput) expect(labels, id).toContain('示例数据')
      document.body.replaceChildren(root = document.createElement('main'))
    }
  })
})

// ---------------------------------------------------------------------------

describe('农历 ↔ 公历', () => {
  it('数据表覆盖 1900-2100 共 201 年', () => {
    expect(LUNAR_INFO).toHaveLength(201)
    expect(TERM_INFO).toHaveLength(201)
  })

  it('换算已知的春节日期', () => {
    const cases = [
      [2024, 2, 10, 2024, 1, 1],
      [2025, 1, 29, 2025, 1, 1],
      [2023, 1, 22, 2023, 1, 1],
      [2020, 1, 25, 2020, 1, 1],
      [2000, 2, 5, 2000, 1, 1],
      [1985, 2, 20, 1985, 1, 1],
      [2033, 1, 31, 2033, 1, 1],
      [1900, 1, 31, 1900, 1, 1]
    ]
    for (const [year, month, day, lunarYear, lunarMonth, lunarDay] of cases) {
      const result = solarToLunar(year, month, day)
      expect([result.lunarYear, result.lunarMonth, result.lunarDay], `${year}-${month}-${day}`)
        .toEqual([lunarYear, lunarMonth, lunarDay])
      expect(result.isLeapMonth).toBe(false)
      expect(result.dayText).toBe('初一')
      expect(result.monthText).toBe('正月')
    }
    expect(solarToLunar(2024, 2, 10).lunarText).toBe('二〇二四年正月初一')
  })

  it('给出正确的干支、生肖与星期', () => {
    const spring = solarToLunar(2024, 2, 10)
    expect(spring.ganzhiYear).toBe('甲辰')
    expect(spring.ganzhiMonth).toBe('丙寅')
    expect(spring.ganzhiDay).toBe('甲辰')
    expect(spring.zodiac).toBe('龙')
    expect(spring.weekday).toBe('星期六')
    expect(spring.dayOfYear).toBe(41)

    // Before 立春 the stem-branch year is still the previous one.
    const beforeLichun = solarToLunar(2024, 1, 15)
    expect(beforeLichun.ganzhiYear).toBe('癸卯')
    expect(beforeLichun.zodiac).toBe('兔')

    expect(getHeavenlyStemAndEarthlyBranch(2024)).toBe('甲辰')
    expect(getHeavenlyStemAndEarthlyBranch(1984)).toBe('甲子')
    expect(getZodiac(2024)).toBe('龙')
    expect(getZodiac(2023)).toBe('兔')
  })

  it('公历—农历在 1950-2050 年间逐日往返一致', () => {
    for (let time = Date.UTC(1950, 0, 1); time <= Date.UTC(2050, 11, 31); time += 86400000) {
      const date = new Date(time)
      const lunar = solarToLunar(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
      const back = lunarToSolar(lunar.lunarYear, lunar.lunarMonth, lunar.lunarDay, lunar.isLeapMonth)
      expect(back.solarYear).toBe(date.getUTCFullYear())
      expect(back.solarMonth).toBe(date.getUTCMonth() + 1)
      expect(back.solarDay).toBe(date.getUTCDate())
    }
  })

  it('正确处理闰月', () => {
    expect(leapMonth(2020)).toBe(4)
    expect(leapMonth(2023)).toBe(2)
    expect(leapMonth(2025)).toBe(6)
    expect(leapMonth(2033)).toBe(11)
    expect(leapMonth(2024)).toBe(0)
    expect(leapMonthDays(2024)).toBe(0)

    const leap = lunarToSolar(2023, 2, 1, true)
    expect([leap.solarYear, leap.solarMonth, leap.solarDay]).toEqual([2023, 3, 22])
    expect(leap.isLeapMonth).toBe(true)
    expect(leap.monthText).toBe('闰二月')
    expect(leap.lunarText).toBe('二〇二三年闰二月初一')

    // The same year/month without the leap flag is the ordinary second month.
    const regular = lunarToSolar(2023, 2, 1, false)
    expect(regular.isLeapMonth).toBe(false)
    expect(regular.solarMonth).toBe(2)

    // The infamous 2033 leap-eleventh-month case.
    const rare = lunarToSolar(2033, 11, 1, true)
    expect(rare.isLeapMonth).toBe(true)
    expect(rare.monthText).toBe('闰冬月')

    // A leap month that does not exist in that year is rejected.
    expect(lunarToSolar(2024, 2, 1, true)).toBeNull()
    expect(lunarToSolar(2024, 1, 31)).toBeNull()
  })

  it('识别二十四节气', () => {
    expect(getSolarTerm(2024, 2, 4)).toBe('立春')
    expect(getSolarTerm(2025, 2, 3)).toBe('立春')
    expect(getSolarTerm(2024, 12, 21)).toBe('冬至')
    expect(getSolarTerm(2024, 4, 4)).toBe('清明')
    expect(getSolarTerm(2024, 6, 21)).toBe('夏至')
    expect(getSolarTerm(2023, 3, 6)).toBe('惊蛰')
    expect(getSolarTerm(2024, 1, 6)).toBe('小寒')
    expect(getSolarTerm(2024, 2, 5)).toBe('')

    const february = getSolarTermsOfMonth(2024, 2)
    expect(february.map(item => item.name)).toEqual(['立春', '雨水'])
    expect(february[0].day).toBe(4)
    expect(solarToLunar(2024, 2, 4).solarTerm).toBe('立春')
    expect(solarToLunar(2024, 2, 5).solarTerm).toBe('')
  })

  it('越界输入返回 null', () => {
    expect(solarToLunar(1899, 12, 31)).toBeNull()
    expect(solarToLunar(2101, 1, 1)).toBeNull()
    expect(solarToLunar(2024, 2, 30)).toBeNull()
    expect(lunarToSolar(1800, 1, 1)).toBeNull()
  })

  it('格式化农历年月日', () => {
    expect(formatLunarYear(2024)).toBe('二〇二四年')
    expect(formatLunarMonth(1)).toBe('正月')
    expect(formatLunarMonth(11)).toBe('冬月')
    expect(formatLunarMonth(12, true)).toBe('闰腊月')
    expect(formatLunarDay(1)).toBe('初一')
    expect(formatLunarDay(10)).toBe('初十')
    expect(formatLunarDay(21)).toBe('廿一')
    expect(formatLunarDay(30)).toBe('三十')
    expect(lunarMonthDays(2024, 1)).toBe(29)
    expect(lunarYearDays(2024)).toBe(354)
  })

  it('界面：公历转农历与农历转公历', () => {
    lunarCalendar.render(root)
    const dateInput = root.querySelector('input[type="date"]')
    dateInput.value = '2024-02-10'
    dateInput.dispatchEvent(new Event('input', { bubbles: true }))

    const text = root.querySelector('.result-box').textContent
    expect(text).toContain('二〇二四年正月初一')
    expect(text).toContain('甲辰年 丙寅月 甲辰日')
    expect(text).toContain('龙')
    expect(text).toContain('星期六')
    expect(text).toContain('第 41 天')

    root.querySelector('.segmented-btn[data-value="lunar-to-solar"]').click()
    const [yearSelect, monthSelect, daySelect] = root.querySelectorAll('select')
    yearSelect.value = '2025'
    yearSelect.dispatchEvent(new Event('change', { bubbles: true }))
    monthSelect.value = '1'
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }))
    daySelect.value = '1'
    daySelect.dispatchEvent(new Event('change', { bubbles: true }))

    expect(root.querySelector('.result-box').textContent).toContain('2025 年 1 月 29 日')
  })

  it('界面：闰月复选框只在当年确有该闰月时可用', () => {
    lunarCalendar.render(root)
    root.querySelector('.segmented-btn[data-value="lunar-to-solar"]').click()
    const [yearSelect, monthSelect] = root.querySelectorAll('select')
    const leap = root.querySelector('input[type="checkbox"]')

    yearSelect.value = '2023'
    yearSelect.dispatchEvent(new Event('change', { bubbles: true }))
    monthSelect.value = '2'
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }))
    expect(leap.disabled).toBe(false)

    monthSelect.value = '3'
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }))
    expect(leap.disabled).toBe(true)
    expect(leap.checked).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('条形码生成', () => {
  it('计算 EAN-13 / UPC-A 的校验位', () => {
    // Known real-world codes: 4006381333931, 6901234567892, 036000291452.
    expect(computeCheckDigit('400638133393')).toBe(1)
    expect(computeCheckDigit('690123456789')).toBe(2)
    expect(computeCheckDigit('03600029145')).toBe(2)
    expect(computeCheckDigit('0')).toBe(0)
    expect(() => computeCheckDigit('')).toThrow()
  })

  it('按格式校验输入', () => {
    expect(validateBarcodeInput('690123456789', 'ean13')).toMatchObject({ ok: true, value: '6901234567892', appended: true })
    expect(validateBarcodeInput('6901234567892', 'ean13')).toMatchObject({ ok: true, appended: false })
    expect(validateBarcodeInput('6901234567891', 'ean13')).toMatchObject({ ok: false })
    expect(validateBarcodeInput('6901234567891', 'ean13').message).toContain('校验位不正确')
    expect(validateBarcodeInput('69012345678', 'ean13').ok).toBe(false)
    expect(validateBarcodeInput('69012345678a', 'ean13').ok).toBe(false)

    expect(validateBarcodeInput('03600029145', 'upca')).toMatchObject({ ok: true, value: '036000291452' })
    expect(validateBarcodeInput('036000291452', 'upca').ok).toBe(true)
    expect(validateBarcodeInput('036000291451', 'upca').ok).toBe(false)

    expect(validateBarcodeInput('ABC-123', 'code39').ok).toBe(true)
    expect(validateBarcodeInput('abc', 'code39').ok).toBe(false)
    expect(validateBarcodeInput('中文', 'code128').ok).toBe(false)
    expect(validateBarcodeInput('a'.repeat(81), 'code128').ok).toBe(false)

    expect(validateBarcodeInput('1234', 'interleaved2of5').ok).toBe(true)
    expect(validateBarcodeInput('123', 'interleaved2of5').ok).toBe(false)

    for (const type of BARCODE_TYPES.map(item => item.id)) {
      expect(validateBarcodeInput('', type).ok).toBe(false)
    }
    expect(validateBarcodeInput('x', 'unknown-type').ok).toBe(false)
  })

  it('界面：切换类型并生成条形码不会抛错', () => {
    barcode.render(root)
    const select = root.querySelector('select')
    const text = root.querySelector('input[type="text"]')
    const error = root.querySelector('.error-text')

    select.value = 'ean13'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    text.value = '690123456789'
    text.dispatchEvent(new Event('input', { bubbles: true }))
    expect(error.textContent).toBe('')
    expect(root.querySelector('.inline-result').textContent).toContain('已补校验位')
    expect(root.querySelector('.inline-result').textContent).toContain('6901234567892')

    expect(() => root.querySelector('.btn-primary').click()).not.toThrow()
    expect(error.textContent).toBe('')

    text.value = '12345'
    text.dispatchEvent(new Event('input', { bubbles: true }))
    expect(error.textContent).not.toBe('')
    expect(() => root.querySelector('.btn-primary').click()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------

describe('WiFi 二维码', () => {
  it('生成标准的 WIFI: 载荷', () => {
    expect(buildWifiPayload({ ssid: 'MyNet', encryption: 'WPA', password: 'secret' }))
      .toBe('WIFI:T:WPA;S:MyNet;P:secret;;')
    expect(buildWifiPayload({ ssid: 'MyNet', encryption: 'WPA', password: 'secret', hidden: true }))
      .toBe('WIFI:T:WPA;S:MyNet;P:secret;H:true;;')
    expect(buildWifiPayload({ ssid: 'Open', encryption: 'nopass' })).toBe('WIFI:T:nopass;S:Open;;')
    expect(buildWifiPayload({ ssid: 'Open', encryption: 'nopass', password: 'ignored', hidden: true }))
      .toBe('WIFI:T:nopass;S:Open;H:true;;')
    expect(buildWifiPayload({ ssid: 'Old', encryption: 'WEP', password: 'abcde' }))
      .toBe('WIFI:T:WEP;S:Old;P:abcde;;')
    expect(buildWifiPayload()).toBe('WIFI:T:WPA;S:;P:;;')
  })

  it('转义 SSID 与密码中的特殊字符', () => {
    expect(escapeWifiValue('a;b')).toBe('a\\;b')
    expect(escapeWifiValue('a,b')).toBe('a\\,b')
    expect(escapeWifiValue('a:b')).toBe('a\\:b')
    expect(escapeWifiValue('a"b')).toBe('a\\"b')
    expect(escapeWifiValue('a\\b')).toBe('a\\\\b')
    expect(buildWifiPayload({ ssid: 'Guest;Net', password: 'p:a,ss"1\\2' }))
      .toBe('WIFI:T:WPA;S:Guest\\;Net;P:p\\:a\\,ss\\"1\\\\2;;')
  })

  it('界面：载荷文本随输入实时更新，无加密时隐藏密码', () => {
    wifiQr.render(root)
    const ssid = root.querySelector('input[aria-label="网络名称 SSID"]')
    const password = root.querySelector('input[aria-label="WiFi 密码"]')
    const output = root.querySelector('textarea[readonly]')
    const select = root.querySelector('select')

    ssid.value = 'MyNet'
    ssid.dispatchEvent(new Event('input', { bubbles: true }))
    expect(output.value).toBe('WIFI:T:WPA;S:MyNet;P:;;')

    password.value = 'p@ss;word,1'
    password.dispatchEvent(new Event('input', { bubbles: true }))
    expect(output.value).toBe('WIFI:T:WPA;S:MyNet;P:p@ss\\;word\\,1;;')

    select.value = 'nopass'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(output.value).toBe('WIFI:T:nopass;S:MyNet;;')
    expect(password.closest('.form-group').hidden).toBe(true)

    select.value = 'WPA'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(password.closest('.form-group').hidden).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('百分比计算器', () => {
  it('计算各类百分比问题', () => {
    expect(percentOf(200, 15)).toBeCloseTo(30, 10)
    expect(percentOf(0, 50)).toBe(0)
    expect(whatPercent(30, 200)).toBeCloseTo(15, 10)
    expect(percentChange(100, 125)).toBeCloseTo(25, 10)
    expect(percentChange(100, 80)).toBeCloseTo(-20, 10)
    expect(addPercent(200, 10)).toBeCloseTo(220, 10)
    expect(subtractPercent(200, 10)).toBeCloseTo(180, 10)
    expect(discount(299, 20)).toBeCloseTo(239.2, 10)
    expect(ratioToPercent(30, 70)).toBeCloseTo(30, 10)
    expect(percentagePoints(20, 25)).toBeCloseTo(5, 10)
    expect(percentagePoints(25, 20)).toBeCloseTo(-5, 10)
    expect(formatNumber(239.2)).toBe('239.2')
    expect(formatNumber(1 / 3)).toBe('0.3333')
  })

  it('除数为零时给出中文提示', () => {
    expect(() => whatPercent(1, 0)).toThrow(/不能为 0/)
    expect(() => percentChange(0, 10)).toThrow(/不能为 0/)
    expect(() => ratioToPercent(0, 0)).toThrow(/占比/)
    expect(() => percentOf('abc', 10)).toThrow(/有效数字/)
    expect(() => percentOf('', 10)).toThrow(/请输入/)
  })

  it('界面：切换问题类型并实时计算', () => {
    percentage.render(root)
    const panels = root.querySelectorAll('[role="tabpanel"]')
    expect(panels).toHaveLength(7)

    const [x, y] = panels[0].querySelectorAll('input')
    x.value = '200'
    x.dispatchEvent(new Event('input', { bubbles: true }))
    y.value = '15'
    y.dispatchEvent(new Event('input', { bubbles: true }))
    expect(panels[0].querySelector('.inline-result').textContent).toContain('30')
    expect(panels[0].querySelector('.form-hint').textContent).toContain('X × Y ÷ 100')

    // A 是 B 的百分之几，B = 0 时给出提示
    const [a, b] = panels[1].querySelectorAll('input')
    a.value = '30'
    a.dispatchEvent(new Event('input', { bubbles: true }))
    b.value = '0'
    b.dispatchEvent(new Event('input', { bubbles: true }))
    expect(panels[1].querySelector('.error-text').textContent).toContain('不能为 0')

    // 加上/减去百分之几 —— 分段控件切换运算方式
    const changePanel = panels[3]
    const [value, percent] = changePanel.querySelectorAll('input')
    value.value = '200'
    value.dispatchEvent(new Event('input', { bubbles: true }))
    percent.value = '10'
    percent.dispatchEvent(new Event('input', { bubbles: true }))
    expect(changePanel.querySelector('.inline-result').textContent).toContain('220')

    changePanel.querySelector('.segmented-btn[data-value="subtract"]').click()
    expect(changePanel.querySelector('.inline-result').textContent).toContain('180')

    // 示例数据按钮填充并计算
    panels[0].querySelector('.btn-secondary').click()
    expect(panels[0].querySelector('.inline-result').textContent).toContain('30')
  })
})

// ---------------------------------------------------------------------------

describe('Favicon 生成', () => {
  it('按 ICO 容器格式打包 PNG', () => {
    const ico = buildIco([
      { width: 16, height: 16, pngBytes: bytes(1, 2, 3, 4) },
      { width: 256, height: 256, pngBytes: bytes(9, 9) }
    ])
    const view = new DataView(ico.buffer)

    // ICONDIR
    expect(view.getUint16(0, true)).toBe(0)
    expect(view.getUint16(2, true)).toBe(1)
    expect(view.getUint16(4, true)).toBe(2)
    expect(ico.length).toBe(6 + 2 * 16 + 4 + 2)

    // First ICONDIRENTRY
    expect(ico[6]).toBe(16)
    expect(ico[7]).toBe(16)
    expect(ico[8]).toBe(0)
    expect(ico[9]).toBe(0)
    expect(view.getUint16(10, true)).toBe(1)
    expect(view.getUint16(12, true)).toBe(32)
    expect(view.getUint32(14, true)).toBe(4)
    expect(view.getUint32(18, true)).toBe(38)

    // Second entry: 256 is stored as the byte 0
    expect(ico[22]).toBe(0)
    expect(ico[23]).toBe(0)
    expect(view.getUint32(30, true)).toBe(2)
    expect(view.getUint32(34, true)).toBe(42)

    expect([...ico.slice(38, 42)]).toEqual([1, 2, 3, 4])
    expect([...ico.slice(42)]).toEqual([9, 9])
  })

  it('拒绝不合法的 ICO 输入', () => {
    expect(() => buildIco([])).toThrow(/至少/)
    expect(() => buildIco([{ width: 16, height: 16, pngBytes: bytes() }])).toThrow(/缺少 PNG 数据/)
    expect(() => buildIco([{ width: 512, height: 512, pngBytes: bytes(1) }])).toThrow(/256/)
    expect(() => buildIco([{ width: 0, height: 16, pngBytes: bytes(1) }])).toThrow(/尺寸无效/)
    expect(() => buildIco([{ width: 16, height: 16, pngBytes: 'nope' }])).toThrow(/Uint8Array/)
  })

  it('生成引用代码与 webmanifest', () => {
    const html = buildIconHtml([16, 32])
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="any">')
    expect(html).toContain('sizes="16x16" href="/favicon-16x16.png"')
    expect(html).toContain('apple-touch-icon')

    const manifest = JSON.parse(buildWebManifest())
    expect(manifest.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512'])
    expect(manifest.icons[0].src).toBe('/favicon-192x192.png')
    expect(manifest.display).toBe('standalone')

    expect(FAVICON_SIZES).toEqual([16, 32, 48, 64, 128, 180, 192, 512])
  })

  it('解析 data URL 与体积显示', () => {
    expect([...dataUrlToBytes('data:image/png;base64,AAECAw==')]).toEqual([0, 1, 2, 3])
    expect(() => dataUrlToBytes('nope')).toThrow()
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
  })

  it('界面：文件选择前后都能安全渲染', () => {
    faviconGenerator.render(root)
    expect(root.querySelector('.drop-area')).not.toBeNull()
    expect(root.querySelector('input[type="file"]')).not.toBeNull()
    expect(root.querySelector('textarea[aria-label="HTML 引用代码"]').value).toContain('favicon-32x32.png')
    expect(root.querySelector('textarea[aria-label="site.webmanifest 内容"]').value).toContain('192x192')

    const icoButton = root.querySelector('.btn-success')
    expect(icoButton.disabled).toBe(true)
    expect(() => icoButton.click()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------

describe('图片 EXIF', () => {
  it('清除 JPEG 的 APPn 与 COM 段但保留 SOS 之后的数据', () => {
    const original = buildSyntheticJpeg()
    const cleaned = stripJpegMetadata(original)

    expect(isJpeg(cleaned)).toBe(true)
    expect(cleaned.length).toBe(original.length - 18 - 10)

    // APP1/EXIF 段被移除
    expect(indexOfSequence(cleaned, [0xff, 0xe1])).toBe(-1)
    expect(indexOfSequence(cleaned, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00])).toBe(-1)
    // COM 段被移除
    expect(indexOfSequence(cleaned, [0xff, 0xfe])).toBe(-1)
    // APP0/JFIF 默认保留
    expect(indexOfSequence(cleaned, [0xff, 0xe0])).toBe(2)
    expect(indexOfSequence(cleaned, [0x4a, 0x46, 0x49, 0x46])).toBeGreaterThan(0)
    // SOS 及其后的扫描数据逐字节保留
    const sosAt = indexOfSequence(cleaned, [0xff, 0xda, 0x00, 0x0c])
    expect(sosAt).toBeGreaterThan(0)
    expect([...cleaned.slice(sosAt)]).toEqual([
      0xff, 0xda, 0x00, 0x0c,
      0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00,
      0x12, 0x34, 0x56, 0xff, 0x00, 0xab, 0xff, 0xd9
    ])

    // 可选地连 APP0 一起丢弃
    const aggressive = stripJpegMetadata(original, { keepApp0: false })
    expect(indexOfSequence(aggressive, [0xff, 0xe0])).toBe(-1)
    expect(aggressive.length).toBe(original.length - 36 - 10)

    expect(() => stripJpegMetadata(bytes(1, 2, 3))).toThrow(/JPEG/)
    expect(() => stripMetadata(bytes(1, 2, 3))).toThrow(/JPEG 与 PNG/)
  })

  it('清除 PNG 的文本与时间块，保留关键块', () => {
    const original = buildSyntheticPng()
    const cleaned = stripPngMetadata(original)

    expect(isPng(cleaned)).toBe(true)
    expect(indexOfSequence(cleaned, [0x74, 0x45, 0x58, 0x74])).toBe(-1) // tEXt
    expect(indexOfSequence(cleaned, [0x69, 0x54, 0x58, 0x74])).toBe(-1) // iTXt
    expect(indexOfSequence(cleaned, [0x7a, 0x54, 0x58, 0x74])).toBe(-1) // zTXt
    expect(indexOfSequence(cleaned, [0x65, 0x58, 0x49, 0x66])).toBe(-1) // eXIf
    expect(indexOfSequence(cleaned, [0x74, 0x49, 0x4d, 0x45])).toBe(-1) // tIME

    expect(indexOfSequence(cleaned, [0x49, 0x48, 0x44, 0x52])).toBe(12) // IHDR (8-byte signature + 4-byte length)
    expect(indexOfSequence(cleaned, [0x49, 0x44, 0x41, 0x54])).toBeGreaterThan(0)
    expect(indexOfSequence(cleaned, [0x49, 0x45, 0x4e, 0x44])).toBeGreaterThan(0)
    expect(cleaned.length).toBeLessThan(original.length)
    expect(indexOfSequence(cleaned, [0x89, 0x50, 0x4e, 0x47])).toBe(0)

    expect(stripMetadata(original).length).toBe(cleaned.length)
    expect(() => stripPngMetadata(buildSyntheticJpeg())).toThrow(/PNG/)
  })

  it('格式化拍摄参数与 GPS', () => {
    expect(formatExposureTime(0.008)).toBe('1/125 秒')
    expect(formatExposureTime(2)).toBe('2 秒')
    expect(formatExposureTime(0.0166666)).toBe('1/60 秒')
    expect(formatExifDate(new Date(2024, 1, 10, 9, 5, 3))).toBe('2024-02-10 09:05:03')
    expect(formatExifDate(undefined)).toBe('')
    expect(decimalToDms(39.9075, true)).toBe('39°54\'27.00"N')
    expect(decimalToDms(-116.39723, false)).toBe('116°23\'50.03"W')
    expect(decimalToDms('abc')).toBe('')
  })

  it('分组输出元数据', () => {
    const groups = groupMetadata({
      Make: 'Canon',
      Model: 'EOS R5',
      ExposureTime: 0.008,
      FNumber: 2.8,
      ISO: 400,
      FocalLength: 50,
      DateTimeOriginal: new Date(2024, 1, 10, 9, 5, 3),
      ImageWidth: 8192,
      ImageHeight: 5464,
      Orientation: 'Horizontal (normal)',
      Software: 'Firmware 1.0',
      latitude: 39.9075,
      longitude: -116.39723
    })
    const titles = groups.map(group => group.title)
    expect(titles).toEqual(['相机', '曝光', '时间', '图像', '软件', 'GPS'])

    const exposure = groups.find(group => group.title === '曝光').rows
    expect(exposure.find(row => row.key === 'ExposureTime').value).toBe('1/125 秒')
    expect(exposure.find(row => row.key === 'FNumber').value).toBe('f/2.8')
    expect(exposure.find(row => row.key === 'FocalLength').value).toBe('50 mm')

    const gps = groups.find(group => group.title === 'GPS').rows
    expect(gps.find(row => row.key === 'latitude').value).toContain('39.907500')
    expect(gps.find(row => row.key === 'latitude').value).toContain('N')

    expect(groupMetadata(null)).toEqual([])
    expect(groupMetadata({})).toEqual([])
    expect(METADATA_GROUPS.map(group => group.title)).toContain('GPS')
  })

  it('界面：渲染表格与拖放区，未选文件时不触碰画布', () => {
    expect(() => exifTool.render(root)).not.toThrow()
    expect(root.querySelector('.drop-area')).not.toBeNull()
    const table = root.querySelector('table.result-table')
    expect(table.parentElement.classList.contains('table-scroll')).toBe(true)
    expect(root.querySelector('button.btn-danger').disabled).toBe(true)
    expect(() => root.querySelector('button.btn-danger').click()).not.toThrow()
  })
})
