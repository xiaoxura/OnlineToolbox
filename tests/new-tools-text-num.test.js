import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyTwoColumnLayout, enhanceFormAccessibility, enhanceResultSections } from '../src/utils/dom.js'
import hiddenChars, {
  annotateHiddenChars,
  detectHiddenChars,
  stripHiddenChars,
  summarizeChars
} from '../src/tools/text/hidden-chars.js'
import textMask, {
  MASK_RULES,
  maskBankCards,
  maskEmails,
  maskIdCards,
  maskIpAddresses,
  maskKeys,
  maskPhones,
  maskText
} from '../src/tools/text/text-mask.js'
import listTools, {
  applyListOperation,
  groupLines,
  joinLines,
  numberLines,
  reverseEachLine,
  reverseLines,
  rotateLines,
  shuffleLines,
  truncateLines,
  uniqueLines,
  wrapLines
} from '../src/tools/text/list-tools.js'
import ieee754, {
  decodeFloat,
  describeBits,
  encodeFloat,
  groupBits,
  parseBits,
  roundTrip,
  splitBits
} from '../src/tools/converter/ieee754.js'
import statisticsTool, {
  computeStatistics,
  parseNumbers,
  quantile
} from '../src/tools/math/statistics.js'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  document.body.replaceChildren()
})

function editableTextarea() {
  return root.querySelector('textarea:not([readonly])')
}

function outputTextarea() {
  return root.querySelector('textarea[readonly]')
}

function runPrimaryAction() {
  root.querySelector('.btn-primary').click()
}

function rowLabels(tableSelector = 'tbody') {
  return [...root.querySelectorAll(`${tableSelector} th`)].map(cell => cell.textContent)
}

const ALL_TOOLS = [hiddenChars, textMask, listTools, ieee754, statisticsTool]

const METADATA = [
  [hiddenChars, 'hidden-chars', '隐藏字符检测', '检测并清除零宽字符、BOM、控制符与易混淆字符', 'text'],
  [textMask, 'text-mask', '文本脱敏', '对邮箱、手机号、身份证、银行卡与密钥进行掩码脱敏', 'text'],
  [listTools, 'list-tools', '列表工具', '对文本行进行反转、打乱、分组、轮转、编号与包装', 'text'],
  [ieee754, 'ieee754', 'IEEE 754 浮点数', '在十进制浮点数与 IEEE 754 二进制、十六进制表示之间转换', 'converter'],
  [statisticsTool, 'statistics', '统计计算器', '计算均值、中位数、众数、方差、标准差、分位数与离群值', 'math']
]

describe('new tool metadata', () => {
  for (const [tool, id, name, description, category] of METADATA) {
    it(`describes ${id} the way the registry expects`, () => {
      expect(tool.id).toBe(id)
      expect(tool.name).toBe(name)
      expect(tool.description).toBe(description)
      expect(tool.category).toBe(category)
      expect(typeof tool.icon).toBe('string')
      expect(typeof tool.render).toBe('function')
      expect(tool.render.length).toBe(1)
    })
  }
})

describe('tool page integration', () => {
  for (const tool of ALL_TOOLS) {
    it(`survives the shared layout and result toolbar for ${tool.id}`, () => {
      tool.render(root)
      enhanceFormAccessibility(root)
      expect(() => applyTwoColumnLayout(root)).not.toThrow()
      expect(() => enhanceResultSections(root, { toolName: tool.id })).not.toThrow()

      // Every tool here is an input → output tool, so the shared heuristic must
      // split it into two columns with the input on the left.
      const grid = root.querySelector('.tool-io-grid')
      expect(grid, `${tool.id}: no two-column split`).not.toBeNull()
      expect(grid.querySelector('.tool-io-input .tool-section')).not.toBeNull()
      expect(grid.querySelector('.tool-io-output .tool-section')).not.toBeNull()

      for (const table of root.querySelectorAll('table.result-table')) {
        expect(table.parentElement?.classList.contains('table-scroll')).toBe(true)
      }
      for (const button of root.querySelectorAll('.btn-icon')) {
        expect(button.getAttribute('aria-label'), `${tool.id}: icon button without a label`).toBeTruthy()
      }
      expect(root.querySelector('.tool-section .tool-section')).toBeNull()
    })
  }
})

describe('new tool UI conventions', () => {
  for (const tool of ALL_TOOLS) {
    it(`renders ${tool.id} following the shared UI contract`, () => {
      expect(() => tool.render(root)).not.toThrow()
      enhanceFormAccessibility(root)
      expect(root.childElementCount).toBeGreaterThan(0)

      for (const control of root.querySelectorAll('input, textarea, select')) {
        const hasName = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
        expect(Boolean(hasName), `${tool.id}: unnamed ${control.tagName}`).toBe(true)
      }
      expect(root.querySelector('select.input'), `${tool.id}: select uses text-input styling`).toBeNull()
      expect(root.querySelector('button[class="btn"]'), `${tool.id}: button has no variant`).toBeNull()
      for (const choice of root.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
        expect(choice.closest('label'), `${tool.id}: choice not wrapped in a label`).not.toBeNull()
      }
      expect(root.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box')).toBeNull()
      for (const table of root.querySelectorAll('table.result-table')) {
        expect(table.parentElement?.classList.contains('table-scroll'), `${tool.id}: result table not scrollable`).toBe(true)
      }
      for (const group of root.querySelectorAll('[role="radiogroup"]')) {
        expect(group.querySelectorAll('[role="radio"][aria-checked="true"]'), `${tool.id}: invalid segmented state`).toHaveLength(1)
      }
      for (const button of root.querySelectorAll('.form-action-row .btn-secondary')) {
        expect(button.textContent).toBe('示例数据')
      }
    })
  }
})

describe('hidden character detection', () => {
  const sample = 'a\u200Bb\u00A0c\u0007d\u0410e'

  it('reports every suspicious character with index, code point and category', () => {
    const findings = detectHiddenChars(sample)
    expect(findings.map(finding => finding.codePoint)).toEqual(['U+200B', 'U+00A0', 'U+0007', 'U+0410'])
    expect(findings.map(finding => finding.index)).toEqual([1, 3, 5, 7])
    expect(findings[0]).toMatchObject({ category: 'zeroWidth', strippable: true, token: 'ZWSP' })
    expect(findings[1]).toMatchObject({ category: 'space', name: '不换行空格' })
    expect(findings[2]).toMatchObject({ category: 'control', strippable: true })
    expect(findings[3]).toMatchObject({ category: 'confusable', strippable: false })
    expect(findings[3].name).toContain('西里尔')
  })

  it('leaves ordinary whitespace and text alone', () => {
    expect(detectHiddenChars('a\nb\tc\rd e')).toEqual([])
    expect(detectHiddenChars('')).toEqual([])
  })

  it('covers BOM, bidi marks, full-width space and confusables', () => {
    expect(detectHiddenChars('\uFEFF')[0]).toMatchObject({ category: 'bom' })
    expect(detectHiddenChars('\u202E')[0]).toMatchObject({ category: 'invisible', token: 'RLO' })
    expect(detectHiddenChars('\u200E')[0]).toMatchObject({ category: 'invisible', token: 'LRM' })
    expect(detectHiddenChars('\u3000')[0]).toMatchObject({ category: 'space', token: 'IDSP' })
    expect(detectHiddenChars('\u0391')[0]).toMatchObject({ category: 'confusable' })
  })

  it('summarizes findings per category', () => {
    const summary = summarizeChars('a\u200B\u200B\u00A0\u0410')
    expect(summary.total).toBe(4)
    expect(summary.categories).toEqual([
      { id: 'zeroWidth', label: '零宽字符', count: 2, strippable: true },
      { id: 'space', label: '异常空格', count: 1, strippable: true },
      { id: 'confusable', label: '易混淆字符', count: 1, strippable: false }
    ])
  })

  it('strips the selected categories and never touches confusables', () => {
    expect(stripHiddenChars('a\u200Bb\uFEFFc')).toBe('abc')
    expect(stripHiddenChars('a\u00A0b\u3000c')).toBe('a b c')
    expect(stripHiddenChars('a\u0410b')).toBe('a\u0410b')
    expect(stripHiddenChars('a\u200Bb', { categories: ['space'] })).toBe('a\u200Bb')
    expect(stripHiddenChars('a\u0007b', { categories: ['control'] })).toBe('ab')
    expect(stripHiddenChars('a\u00A0b', { categories: ['space'], spaceReplacement: '_' })).toBe('a_b')
  })

  it('annotates invisible characters so the report stays readable', () => {
    expect(annotateHiddenChars('a\u200Bb')).toBe('a⟨ZWSP⟩b')
    expect(annotateHiddenChars('a\u0410b')).toContain('U+0410')
  })

  it('renders the detect view with a findings table and a category breakdown', () => {
    hiddenChars.render(root)
    const input = editableTextarea()
    input.value = sample
    runPrimaryAction()

    expect(outputTextarea().value).toBe('a⟨ZWSP⟩b⟨NBSP⟩c⟨U+0007⟩d\u0410⟨U+0410⟩e')
    expect([...root.querySelectorAll('thead th')].map(cell => cell.textContent)).toEqual(['位置', '字符', '码点', '说明'])
    const rows = [...root.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(4)
    expect(rows[0].querySelector('td').textContent).toBe('⟨ZWSP⟩')
    expect(rows[0].querySelectorAll('td')[1].textContent).toBe('U+200B')
    const stats = [...root.querySelectorAll('.stats-row .stat-item')].map(item => item.textContent)
    expect(stats.some(text => text.includes('零宽字符') && text.includes('1'))).toBe(true)
    expect(stats.some(text => text.includes('易混淆字符（不自动清除）'))).toBe(true)
  })

  it('switches to clear mode and reports what was removed', () => {
    hiddenChars.render(root)
    editableTextarea().value = sample
    root.querySelector('[data-value="clear"]').click()
    runPrimaryAction()

    expect(outputTextarea().value).toBe('ab cd\u0410e')
    expect(root.textContent).toContain('已清除字符数')
    expect([...root.querySelectorAll('tbody tr')]).toHaveLength(3)
  })
})

describe('text masking', () => {
  it('masks emails while keeping the domain', () => {
    expect(maskEmails('zhangsan@example.com')).toBe('zh******@example.com')
    expect(maskEmails('ab@example.com')).toBe('a***@example.com')
    expect(maskEmails('mail: li.si@sub.example.com;')).toBe('mail: li***@sub.example.com;')
  })

  it('masks phone, ID card and bank card numbers', () => {
    expect(maskPhones('手机 13812348888')).toBe('手机 138****8888')
    expect(maskPhones('订单 13812345678901')).toBe('订单 13812345678901')
    expect(maskIdCards('110101199003071234')).toBe('110101********1234')
    expect(maskIdCards('11010119900307123X')).toBe('110101********123X')
    expect(maskBankCards('6222020200112233')).toBe('************2233')
    expect(maskBankCards('6222 0202 0011 3456')).toBe('**** **** **** 3456')
  })

  it('masks long secrets and IP addresses', () => {
    expect(maskKeys('a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBe('a1b2************************8f90')
    expect(maskKeys('internationalization1998')).toBe('inte****************1998')
    expect(maskKeys('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnopqrstuvwxyz')
    expect(maskIpAddresses('192.168.1.100')).toBe('192.168.***.***')
    expect(maskIpAddresses('999.1.1.1')).toBe('999.1.1.1')
  })

  it('honours the mask character and keep level', () => {
    expect(maskPhones('13812348888', { maskChar: '#', keepLevel: 'none' })).toBe('###########')
    expect(maskPhones('13812348888', { maskChar: 'x', keepLevel: 'less' })).toBe('13xxxxx8888')
    expect(maskEmails('zhangsan@example.com', { maskChar: '•' })).toBe('zh••••••@example.com')
  })

  it('applies only the selected kinds and documents every rule', () => {
    const source = 'zhangsan@example.com 13812348888'
    expect(maskText(source, { kinds: ['email'] })).toBe('zh******@example.com 13812348888')
    expect(maskText(source, { kinds: [] })).toBe(source)
    expect(Object.keys(MASK_RULES)).toEqual(['email', 'phone', 'idCard', 'bankCard', 'secret', 'ip'])
    for (const rule of Object.values(MASK_RULES)) {
      expect(rule.label).toBeTruthy()
      expect(rule.note).toBeTruthy()
    }
  })

  it('removes every sensitive pattern from the masked output', () => {
    const source = [
      'zhangsan@example.com',
      '13812348888',
      '110101199003071234',
      '6222020200112233',
      '192.168.1.100',
      'sk-a1b2c3d4e5f60718293a4b5c6d7e8f90'
    ].join(' ')
    const masked = maskText(source)

    expect(masked).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
    expect(masked).not.toMatch(/(?<!\d)1[3-9]\d{9}(?!\d)/)
    expect(masked).not.toMatch(/(?<!\d)\d{16,19}(?!\d)/)
    expect(masked).not.toMatch(/(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/)
    expect(masked).not.toContain('a1b2c3d4e5f60718293a4b5c6d7e8f90')
    expect(masked).toContain('@example.com')
  })

  it('renders every kind as a checkbox and re-runs on option changes', () => {
    textMask.render(root)
    const input = editableTextarea()
    input.value = 'zhangsan@example.com 13812348888'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('zh******@example.com 138****8888')

    const boxes = [...root.querySelectorAll('input[type="checkbox"]')]
    expect(boxes).toHaveLength(6)
    expect(boxes.every(box => box.checked)).toBe(true)
    boxes[1].click()
    expect(outputTextarea().value).toBe('zh******@example.com 13812348888')

    const selects = [...root.querySelectorAll('select')]
    expect(selects).toHaveLength(2)
    selects[0].value = '#'
    selects[0].dispatchEvent(new Event('change', { bubbles: true }))
    expect(outputTextarea().value).toBe('zh######@example.com 13812348888')
  })
})

describe('list operations', () => {
  it('reverses line order and each line', () => {
    expect(reverseLines(['a', 'b', 'c'])).toEqual(['c', 'b', 'a'])
    expect(reverseEachLine(['abc', 'de'])).toEqual(['cba', 'ed'])
    expect(reverseLines(['a', 'b'])).not.toBe(reverseLines(['a', 'b']))
  })

  it('shuffles deterministically when a seed is given', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const first = shuffleLines(source, 42)
    const second = shuffleLines(source, 42)
    expect(first).toEqual(second)
    expect([...first].sort()).toEqual([...source].sort())
    expect(source).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    expect(shuffleLines(source, 7)).not.toEqual(first)
  })

  it('rotates, groups, joins, numbers and wraps lines', () => {
    expect(rotateLines(['a', 'b', 'c', 'd'], 1)).toEqual(['b', 'c', 'd', 'a'])
    expect(rotateLines(['a', 'b', 'c', 'd'], -1)).toEqual(['d', 'a', 'b', 'c'])
    expect(rotateLines(['a', 'b', 'c'], 4)).toEqual(['b', 'c', 'a'])
    expect(rotateLines([], 3)).toEqual([])
    expect(groupLines(['a', 'b', 'c', 'd', 'e'], 2)).toEqual(['a b', 'c d', 'e'])
    expect(groupLines(['a', 'b', 'c'], 3, { separator: '-' })).toEqual(['a-b-c'])
    expect(joinLines(['a', 'b'], '、')).toBe('a、b')
    expect(numberLines(['a', 'b'], { format: '[{n}/{total}] ' })).toEqual(['[1/2] a', '[2/2] b'])
    expect(wrapLines(['a'], { prefix: '- ', suffix: ' ;' })).toEqual(['- a ;'])
    expect(truncateLines(['abcdef', 'ab'], 3)).toEqual(['abc', 'ab'])
    expect(uniqueLines(['a', 'b', 'a'])).toEqual(['a', 'b'])
  })

  it('dispatches through applyListOperation', () => {
    const lines = ['b', 'a', '']
    expect(applyListOperation(lines, 'reverse')).toEqual(['', 'a', 'b'])
    expect(applyListOperation(lines, 'remove-empty')).toEqual(['b', 'a'])
    expect(applyListOperation(lines, 'join', { separator: '|' })).toEqual(['b|a|'])
    expect(applyListOperation(lines, 'rotate', { count: 1 })).toEqual(['a', '', 'b'])
    expect(applyListOperation(lines, 'group', { count: 2 })).toEqual(['b a', ''])
    expect(applyListOperation(lines, 'unknown')).toEqual(lines)
  })

  it('changes the output when another operation is selected', () => {
    listTools.render(root)
    editableTextarea().value = 'b\na\nc'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('c\na\nb')

    const operation = root.querySelector('select')
    operation.value = 'number'
    operation.dispatchEvent(new Event('change', { bubbles: true }))
    expect(outputTextarea().value).toBe('1. b\n2. a\n3. c')

    operation.value = 'join'
    operation.dispatchEvent(new Event('change', { bubbles: true }))
    const separator = [...root.querySelectorAll('input[type="text"]')].find(input => input.value === '、')
    separator.value = ' | '
    separator.dispatchEvent(new Event('input', { bubbles: true }))
    expect(outputTextarea().value).toBe('b | a | c')
  })

  it('shows only the option fields that belong to the current operation', () => {
    listTools.render(root)
    const numberFields = () => [...root.querySelectorAll('input[type="number"]')].filter(input => !input.closest('.form-group').hidden)
    const operation = root.querySelector('select')

    operation.value = 'rotate'
    operation.dispatchEvent(new Event('change', { bubbles: true }))
    expect(numberFields()).toHaveLength(1)
    expect(numberFields()[0].value).toBe('1')

    operation.value = 'group'
    operation.dispatchEvent(new Event('change', { bubbles: true }))
    expect(numberFields()[0].value).toBe('3')

    operation.value = 'sort'
    operation.dispatchEvent(new Event('change', { bubbles: true }))
    expect(numberFields()).toHaveLength(0)
  })
})

describe('IEEE 754 conversion', () => {
  it('decodes a decimal number into single precision fields', () => {
    const decoded = decodeFloat(1, 'single')
    expect(decoded.hex).toBe('0x3F800000')
    expect(decoded.binary).toBe('00111111100000000000000000000000')
    expect(decoded.signBit).toBe('0')
    expect(decoded.exponentField).toBe(127)
    expect(decoded.exponentBits).toBe('01111111')
    expect(decoded.mantissaBits).toBe('0'.repeat(23))
    expect(decoded.actualExponent).toBe(0)
    expect(decoded.value).toBe(1)
    expect(decoded.exact).toBe(true)
    expect(decoded.category).toBe('normal')
    expect(decoded.bias).toBe(127)
  })

  it('detects precision loss for 0.1 in float32 but not in float64', () => {
    const single = decodeFloat(0.1, 'single')
    expect(single.hex).toBe('0x3DCCCCCD')
    expect(single.exact).toBe(false)
    expect(single.value).toBe(0.10000000149011612)

    const double = decodeFloat(0.1, 'double')
    expect(double.hex).toBe('0x3FB999999999999A')
    expect(double.exact).toBe(true)
    expect(double.bias).toBe(1023)
    expect(double.mantissaBits).toHaveLength(52)

    const trip = roundTrip(0.1, 'single')
    expect(trip.exact).toBe(false)
    expect(Math.abs(trip.difference)).toBeGreaterThan(0)
    expect(trip.relativeError).toBeGreaterThan(0)
  })

  it('handles zero, negative zero, infinities, NaN and subnormals', () => {
    expect(decodeFloat(0, 'single')).toMatchObject({ hex: '0x00000000', category: 'zero', value: 0 })
    const negativeZero = decodeFloat(-0, 'single')
    expect(negativeZero.category).toBe('negative-zero')
    expect(negativeZero.signBit).toBe('1')
    expect(Object.is(negativeZero.value, -0)).toBe(true)
    expect(decodeFloat(Infinity, 'single')).toMatchObject({ hex: '0x7F800000', category: 'infinity', value: Infinity })
    expect(decodeFloat('-Infinity', 'single')).toMatchObject({ hex: '0xFF800000', category: 'negative-infinity' })
    expect(decodeFloat(NaN, 'single')).toMatchObject({ hex: '0x7FC00000', category: 'nan' })
    expect(Number.isNaN(decodeFloat('nan', 'double').value)).toBe(true)

    const smallest = describeBits('0x00000001', 'single')
    expect(smallest.category).toBe('subnormal')
    expect(smallest.isSubnormal).toBe(true)
    expect(smallest.actualExponent).toBe(-126)
    expect(smallest.value).toBe(2 ** -149)
    expect(Number.isFinite(smallest.value)).toBe(true)
  })

  it('encodes bit strings back to decimal values', () => {
    expect(encodeFloat('0x3F800000', 'single')).toBe(1)
    expect(encodeFloat('00111111100000000000000000000000', 'single')).toBe(1)
    expect(encodeFloat('0 01111111 00000000000000000000000', 'single')).toBe(1)
    expect(encodeFloat('0x3FF0000000000000', 'double')).toBe(1)
    expect(encodeFloat('0x3DCCCCCD', 'single')).toBe(0.10000000149011612)
    expect(encodeFloat('0x7F800000', 'single')).toBe(Infinity)
  })

  it('extracts sign, exponent and mantissa and groups the bit string', () => {
    const parts = splitBits('0xC1200000', 'single')
    expect(parts.sign).toBe(1)
    expect(parts.exponentField).toBe(130)
    expect(parts.mantissaField).toBe(2097152n)
    expect(groupBits(parts.binary, 'single')).toBe('1 10000010 01000000000000000000000')
    expect(encodeFloat('0xC1200000', 'single')).toBe(-10)
  })

  it('rejects malformed bit strings and unknown precisions', () => {
    expect(() => parseBits('0x3F800000', 'double')).not.toThrow()
    expect(() => parseBits('1'.repeat(33), 'single')).toThrow()
    expect(() => parseBits('12.5', 'single')).toThrow()
    expect(() => parseBits('0xGGGG', 'single')).toThrow()
    expect(() => parseBits('', 'single')).toThrow()
    expect(() => decodeFloat('abc', 'single')).toThrow()
    expect(() => decodeFloat(1, 'half')).toThrow()
  })

  it('renders the bit breakdown and flags precision loss in the UI', () => {
    ieee754.render(root)
    editableTextarea().value = '0.1'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('0 01111011 10011001100110011001101')
    expect(rowLabels()).toContain('十六进制')
    expect(root.textContent).toContain('无法被')

    root.querySelector('[data-value="double"]').click()
    expect(outputTextarea().value).toBe('0 01111111011 1001100110011001100110011001100110011001100110011010')
    expect(root.textContent).toContain('0x3FB999999999999A')
    expect(root.textContent).toContain('可以被')

    root.querySelector('[data-value="encode"]').click()
    root.querySelector('[data-value="single"]').click()
    editableTextarea().value = '0x3F800000'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('1')

    editableTextarea().value = '0xZZ'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('')
    expect(root.querySelector('.error-text').textContent).not.toBe('')
  })
})

describe('statistics calculator', () => {
  it('computes the central tendency indicators', () => {
    const stats = computeStatistics([1, 2, 3, 4])
    expect(stats).toMatchObject({ count: 4, sum: 10, min: 1, max: 4, range: 3, mean: 2.5, median: 2.5 })
    expect(stats.mode).toEqual([])
    expect(stats.geometricMean).toBeCloseTo(2.2133638394, 6)
    expect(stats.harmonicMean).toBeCloseTo(1.92, 6)
  })

  it('separates sample and population variance', () => {
    const stats = computeStatistics([1, 2, 3, 4])
    expect(stats.variance).toBeCloseTo(5 / 3, 10)
    expect(stats.variancePopulation).toBeCloseTo(1.25, 10)
    expect(stats.stdDev).toBeCloseTo(Math.sqrt(5 / 3), 10)
    expect(stats.stdDevPopulation).toBeCloseTo(Math.sqrt(1.25), 10)
    expect(stats.skewness).toBeCloseTo(0, 10)
    expect(Number.isNaN(computeStatistics([7]).variance)).toBe(true)
    expect(computeStatistics([7]).variancePopulation).toBe(0)
  })

  it('reports quartiles, modes and IQR outliers', () => {
    const stats = computeStatistics([1, 2, 3, 4])
    expect(stats.q1).toBeCloseTo(1.75, 10)
    expect(stats.q2).toBeCloseTo(2.5, 10)
    expect(stats.q3).toBeCloseTo(3.25, 10)
    expect(stats.iqr).toBeCloseTo(1.5, 10)
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)

    expect(computeStatistics([1, 1, 2, 2, 3]).mode).toEqual([1, 2])
    expect(computeStatistics([5]).mode).toEqual([])

    const withOutlier = computeStatistics([1, 2, 3, 4, 5, 6, 7, 8, 9, 1000])
    expect(withOutlier.outliers).toEqual([1000])
    expect(withOutlier.upperFence).toBeLessThan(1000)
    expect(computeStatistics([1, 2, 3, 4, 5]).outliers).toEqual([])
  })

  it('returns NaN for means that are undefined for the data', () => {
    expect(Number.isNaN(computeStatistics([0, 1, 2]).geometricMean)).toBe(true)
    expect(Number.isNaN(computeStatistics([-1, 2]).harmonicMean)).toBe(true)
  })

  it('parses mixed separators and counts skipped tokens', () => {
    expect(parseNumbers('1, 2 3\n4;5、6')).toEqual({ numbers: [1, 2, 3, 4, 5, 6], skipped: 0 })
    expect(parseNumbers('1, x, 3\nN/A')).toEqual({ numbers: [1, 3], skipped: 2 })
    expect(parseNumbers('')).toEqual({ numbers: [], skipped: 0 })
    expect(() => computeStatistics([])).toThrow()
  })

  it('renders grouped indicator tables and explains the outliers', () => {
    statisticsTool.render(root)
    editableTextarea().value = '1, 2, 3, 4, 5, 6, 7, 8, 9, 1000'
    runPrimaryAction()

    const labels = rowLabels()
    expect(labels).toContain('集中趋势')
    expect(labels).toContain('离散程度')
    expect(labels).toContain('分布')
    expect(labels.some(label => label.includes('样本方差'))).toBe(true)
    expect(labels.some(label => label.includes('总体方差'))).toBe(true)
    expect(root.textContent).toContain('1.5×IQR')
    expect(root.textContent).toContain('1000')
  })

  it('reports skipped items and clears results on invalid input', () => {
    statisticsTool.render(root)
    editableTextarea().value = '1, 2, abc'
    runPrimaryAction()
    expect(rowLabels().some(label => label.includes('众数'))).toBe(true)
    expect(root.textContent).toContain('已跳过非数字项')

    editableTextarea().value = 'abc'
    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).toContain('未找到有效数字')
    expect(root.querySelectorAll('tbody tr')).toHaveLength(0)

    editableTextarea().value = ''
    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).toBe('')
  })
})
