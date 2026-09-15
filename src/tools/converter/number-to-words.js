import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'

// Number → English / Chinese reading. Everything works on the decimal digit
// string rather than on a float, so 1e21 and long currency values stay exact.

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen'
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion',
  'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion'
]

const ORDINAL_IRREGULAR = {
  zero: 'zeroth',
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
  twenty: 'twentieth',
  thirty: 'thirtieth',
  forty: 'fortieth',
  fifty: 'fiftieth',
  sixty: 'sixtieth',
  seventy: 'seventieth',
  eighty: 'eightieth',
  ninety: 'ninetieth'
}
for (const scale of SCALES) {
  if (scale) ORDINAL_IRREGULAR[scale] = `${scale}th`
}

export const CURRENCIES = {
  USD: { label: '美元 USD', unit: ['dollar', 'dollars'], cent: ['cent', 'cents'] },
  EUR: { label: '欧元 EUR', unit: ['euro', 'euros'], cent: ['cent', 'cents'] },
  GBP: { label: '英镑 GBP', unit: ['pound', 'pounds'], cent: ['penny', 'pence'] },
  CNY: { label: '人民币 CNY', unit: ['yuan', 'yuan'], cent: ['fen', 'fen'] },
  JPY: { label: '日元 JPY', unit: ['yen', 'yen'], cent: null }
}

// "1.5e-7" is expanded to plain digits so the rest of the code only ever sees
// an optional sign, an integer part and a fraction part.
function expandExponent(text) {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(text)
  if (!match) return text
  const [, sign, intDigits, fracDigits = '', exponentText] = match
  const digits = `${intDigits}${fracDigits}`
  if (!digits) throw new Error('请输入有效的数字')
  const point = intDigits.length + Number(exponentText)
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`
  if (point >= digits.length) return `${sign}${digits}${'0'.repeat(point - digits.length)}`
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`
}

function parseNumeric(input) {
  let text = typeof input === 'string' ? input.trim() : String(input)
  if (!text) throw new Error('请输入数字')
  text = text.replace(/,/g, '')
  if (/[eE]/.test(text)) text = expandExponent(text)
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (!match[2] && !match[3])) throw new Error(`无法识别的数字：${input}`)
  return {
    negative: match[1] === '-',
    intDigits: (match[2] || '0').replace(/^0+(?=\d)/, ''),
    fracDigits: match[3] || ''
  }
}

function isZero(intDigits, fracDigits) {
  return !/[1-9]/.test(`${intDigits}${fracDigits}`)
}

function threeDigitWords(value, britishAnd) {
  const parts = []
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  if (hundreds) parts.push(britishAnd && rest ? `${ONES[hundreds]} hundred and` : `${ONES[hundreds]} hundred`)
  if (rest) {
    if (rest < 20) parts.push(ONES[rest])
    else {
      const tens = Math.floor(rest / 10)
      const ones = rest % 10
      parts.push(ones ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens])
    }
  }
  return parts.join(' ')
}

function integerWords(digits, britishAnd = false) {
  const trimmed = String(digits).replace(/^0+/, '') || '0'
  if (trimmed === '0') return 'zero'
  const groups = []
  let rest = BigInt(trimmed)
  while (rest > 0n) {
    groups.push(Number(rest % 1000n))
    rest /= 1000n
  }
  if (groups.length > SCALES.length) throw new Error('数字过大，超出支持范围')
  const chunks = []
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index]
    if (!group) continue
    const words = threeDigitWords(group, britishAnd)
    chunks.push(SCALES[index] ? `${words} ${SCALES[index]}` : words)
  }
  let words = chunks.join(' ')
  // British style also glues the trailing sub-hundred group with "and":
  // "one thousand and five", but "one thousand one hundred".
  if (britishAnd && groups.length > 1 && groups[0] > 0 && groups[0] < 100) {
    words = words.replace(/(\S+)$/, 'and $1')
  }
  return words
}

export function numberToWords(input, options = {}) {
  const britishAnd = Boolean(options.britishAnd)
  const { negative, intDigits, fracDigits } = parseNumeric(input)
  let words = integerWords(intDigits, britishAnd)
  if (fracDigits) {
    words += ` point ${[...fracDigits].map(digit => ONES[Number(digit)]).join(' ')}`
  }
  if (negative && !isZero(intDigits, fracDigits)) words = `minus ${words}`
  return words
}

function ordinalizeWord(word) {
  if (ORDINAL_IRREGULAR[word]) return ORDINAL_IRREGULAR[word]
  if (/y$/.test(word)) return `${word.slice(0, -1)}ieth`
  return `${word}th`
}

export function numberToOrdinal(input, options = {}) {
  const britishAnd = Boolean(options.britishAnd)
  const { negative, intDigits, fracDigits } = parseNumeric(input)
  if (/[1-9]/.test(fracDigits)) throw new Error('序数词只支持整数')
  const tokens = integerWords(intDigits, britishAnd).split(' ')
  const last = tokens[tokens.length - 1].split('-')
  last[last.length - 1] = ordinalizeWord(last[last.length - 1])
  tokens[tokens.length - 1] = last.join('-')
  const words = tokens.join(' ')
  return negative && !isZero(intDigits, '') ? `minus ${words}` : words
}

export function numberToCurrency(input, options = {}) {
  const code = String(options.currency || 'USD').toUpperCase()
  const currency = CURRENCIES[code] || CURRENCIES.USD
  const britishAnd = Boolean(options.britishAnd)
  const { negative, intDigits, fracDigits } = parseNumeric(input)
  let total = BigInt(intDigits) * 100n + BigInt(`${fracDigits}00`.slice(0, 2))
  if (Number(fracDigits[2] ?? '0') >= 5) total += 1n
  const units = total / 100n
  const cents = total % 100n
  const parts = []
  if (units > 0n || cents === 0n) {
    parts.push(`${integerWords(units.toString(), britishAnd)} ${units === 1n ? currency.unit[0] : currency.unit[1]}`)
  }
  if (currency.cent && cents > 0n) {
    parts.push(`${integerWords(cents.toString(), britishAnd)} ${cents === 1n ? currency.cent[0] : currency.cent[1]}`)
  }
  // A sub-unit-only amount in a currency without a minor unit still needs a name.
  if (!parts.length) parts.push(`${integerWords('0', britishAnd)} ${currency.unit[1]}`)
  const words = parts.join(' and ')
  return negative && total > 0n ? `minus ${words}` : words
}

const CN_DIGITS_LOWER = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const CN_DIGITS_UPPER = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const CN_UNITS_LOWER = ['', '十', '百', '千']
const CN_UNITS_UPPER = ['', '拾', '佰', '仟']
const CN_GROUP_UNITS = ['', '万', '亿', '万亿', '亿亿']
const CN_ZERO = '零'

function chineseGroup(group, uppercase) {
  const digits = uppercase ? CN_DIGITS_UPPER : CN_DIGITS_LOWER
  const units = uppercase ? CN_UNITS_UPPER : CN_UNITS_LOWER
  let out = ''
  let pendingZero = false
  for (let index = 0; index < group.length; index++) {
    const digit = Number(group[index])
    if (digit === 0) {
      pendingZero = true
      continue
    }
    if (pendingZero && out) out += digits[0]
    pendingZero = false
    out += digits[digit] + units[group.length - 1 - index]
  }
  return out
}

export function chineseIntegerWords(digits, uppercase = false) {
  const trimmed = String(digits).replace(/^0+/, '') || '0'
  if (trimmed === '0') return CN_ZERO
  const groups = []
  for (let end = trimmed.length; end > 0; end -= 4) {
    groups.unshift(trimmed.slice(Math.max(0, end - 4), end))
  }
  if (groups.length > CN_GROUP_UNITS.length) throw new Error('数字过大，超出支持范围')
  let out = ''
  const start = groups.findIndex(group => Number(group) !== 0)
  for (let index = start; index < groups.length; index++) {
    const group = groups[index]
    const value = Number(group)
    const unitIndex = groups.length - 1 - index
    if (value === 0) {
      // A whole empty group only needs one 零, and only if something follows.
      if (out && !out.endsWith(CN_ZERO) && groups.slice(index + 1).some(item => Number(item) !== 0)) out += CN_ZERO
      continue
    }
    if (out && value < 1000 && !out.endsWith(CN_ZERO)) out += CN_ZERO
    out += chineseGroup(group, uppercase) + CN_GROUP_UNITS[unitIndex]
  }
  // 十二 reads better than 一十二; 一百一十二 keeps its leading 一.
  if (!uppercase && out.startsWith('一十')) out = out.slice(1)
  return out
}

export function numberToChinese(input, options = {}) {
  const uppercase = Boolean(options.uppercase)
  const { negative, intDigits, fracDigits } = parseNumeric(input)
  const digits = uppercase ? CN_DIGITS_UPPER : CN_DIGITS_LOWER
  let out = chineseIntegerWords(intDigits, uppercase)
  if (fracDigits) out += `点${[...fracDigits].map(digit => digits[Number(digit)]).join('')}`
  if (negative && !isZero(intDigits, fracDigits)) out = `负${out}`
  return out
}

const SAMPLE_SINGLE = '1234567.89'
const SAMPLE_BATCH = '21\n1234.56\n-9000000\n0.05'

export default {
  id: 'number-to-words',
  name: '数字转英文',
  description: '将数字转换为英文单词、序数词与货币读法',
  category: 'converter',
  icon: 'radix',
  keywords: ['number', 'words', '英文', '序数词', 'spell', '货币读法', '中文读法'],
  render(container) {
    const mode = createSegmentedGroup([
      { value: 'cardinal', label: '基数词' },
      { value: 'ordinal', label: '序数词' },
      { value: 'currency', label: '货币' },
      { value: 'chinese', label: '中文' }
    ], () => {
      syncMode()
      run()
    }, { label: '转换模式' })

    const numberInput = createElement('input', {
      className: 'input',
      type: 'number',
      step: 'any',
      placeholder: '例如 1234.56'
    })
    const batchInput = createElement('textarea', {
      className: 'textarea',
      rows: 6,
      placeholder: '每行一个数字，例如\n21\n1234.56'
    })
    const output = createElement('textarea', {
      className: 'textarea',
      readOnly: true,
      placeholder: '转换结果将显示在此…'
    })
    const errorEl = createElement('div', { className: 'error-text' })

    const currencySelect = createElement('select', { className: 'select' }, Object.entries(CURRENCIES)
      .map(([code, item]) => createElement('option', { value: code, textContent: item.label })))

    const britishCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    const chineseUpperCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    const batchCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })

    const currencyGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: '货币种类' }),
      currencySelect
    ])
    const britishGroup = createElement('div', { className: 'form-group option-control-group' }, [
      createElement('label', { className: 'option-item' }, [britishCheckbox, createElement('span', { textContent: '英式读法（加 and）' })])
    ])
    const chineseUpperGroup = createElement('div', { className: 'form-group option-control-group' }, [
      createElement('label', { className: 'option-item' }, [chineseUpperCheckbox, createElement('span', { textContent: '中文大写（壹贰叁）' })])
    ])
    const batchGroup = createElement('div', { className: 'form-group option-control-group' }, [
      createElement('label', { className: 'option-item' }, [batchCheckbox, createElement('span', { textContent: '批量（每行一个）' })])
    ])

    const numberGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: '数字' }),
      numberInput
    ])
    const batchInputGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: '数字列表（每行一个）' }),
      batchInput
    ])

    function convertOne(text) {
      const current = mode.getValue()
      const britishAnd = britishCheckbox.checked
      if (current === 'ordinal') return numberToOrdinal(text, { britishAnd })
      if (current === 'currency') return numberToCurrency(text, { currency: currencySelect.value, britishAnd })
      if (current === 'chinese') return numberToChinese(text, { uppercase: chineseUpperCheckbox.checked })
      return numberToWords(text, { britishAnd })
    }

    function run() {
      errorEl.textContent = ''
      const batch = batchCheckbox.checked
      const source = batch ? batchInput.value : numberInput.value
      if (!String(source).trim()) {
        output.value = ''
        return
      }
      try {
        if (!batch) {
          output.value = convertOne(source)
          return
        }
        const lines = String(source).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
        output.value = lines.map((line, index) => {
          try {
            return convertOne(line)
          } catch (cause) {
            return `第 ${index + 1} 行错误：${cause instanceof Error ? cause.message : String(cause)}`
          }
        }).join('\n')
      } catch (cause) {
        output.value = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    function syncMode() {
      const current = mode.getValue()
      currencyGroup.hidden = current !== 'currency'
      britishGroup.hidden = current === 'chinese'
      chineseUpperGroup.hidden = current !== 'chinese'
      const batch = batchCheckbox.checked
      numberGroup.hidden = batch
      batchInputGroup.hidden = !batch
    }

    batchCheckbox.addEventListener('change', () => {
      syncMode()
      run()
    })
    numberInput.addEventListener('input', run)
    batchInput.addEventListener('input', run)

    const inputStack = createElement('div', { className: 'tool-stack' }, [numberGroup, batchInputGroup])

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '转换模式' }),
          mode
        ]),
        currencyGroup,
        britishGroup,
        chineseUpperGroup,
        batchGroup
      ]),
      createElement('div', { className: 'btn-group' }, [
        createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '转换', onClick: () => run() }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            if (batchCheckbox.checked) batchInput.value = SAMPLE_BATCH
            else numberInput.value = SAMPLE_SINGLE
            run()
          }
        })
      ]),
      errorEl,
      createSection('输入', inputStack),
      createSection('英文读法', output)
    )

    syncMode()
  }
}
