import { createElement, createSection } from '../../utils/dom.js'

// IBAN (ISO 13616) validation: structure check against the official per-country
// length table plus the mod-97 check digit test.

// Country code → { length, name }. Lengths follow the ISO 13616 IBAN registry.
export const IBAN_COUNTRIES = {
  AD: [24, '安道尔'],
  AE: [23, '阿联酋'],
  AL: [28, '阿尔巴尼亚'],
  AO: [25, '安哥拉'],
  AT: [20, '奥地利'],
  AZ: [28, '阿塞拜疆'],
  BA: [20, '波黑'],
  BE: [16, '比利时'],
  BF: [28, '布基纳法索'],
  BG: [22, '保加利亚'],
  BH: [22, '巴林'],
  BI: [27, '布隆迪'],
  BJ: [28, '贝宁'],
  BR: [29, '巴西'],
  BY: [28, '白俄罗斯'],
  CF: [27, '中非共和国'],
  CG: [27, '刚果（布）'],
  CH: [21, '瑞士'],
  CI: [28, '科特迪瓦'],
  CM: [27, '喀麦隆'],
  CR: [22, '哥斯达黎加'],
  CV: [25, '佛得角'],
  CY: [28, '塞浦路斯'],
  CZ: [24, '捷克'],
  DE: [22, '德国'],
  DJ: [27, '吉布提'],
  DK: [18, '丹麦'],
  DO: [28, '多米尼加'],
  DZ: [26, '阿尔及利亚'],
  EE: [20, '爱沙尼亚'],
  EG: [29, '埃及'],
  ES: [24, '西班牙'],
  FI: [18, '芬兰'],
  FK: [18, '福克兰群岛'],
  FO: [18, '法罗群岛'],
  FR: [27, '法国'],
  GA: [27, '加蓬'],
  GB: [22, '英国'],
  GE: [22, '格鲁吉亚'],
  GI: [23, '直布罗陀'],
  GL: [18, '格陵兰'],
  GQ: [27, '赤道几内亚'],
  GR: [27, '希腊'],
  GT: [28, '危地马拉'],
  GW: [25, '几内亚比绍'],
  HN: [28, '洪都拉斯'],
  HR: [21, '克罗地亚'],
  HU: [28, '匈牙利'],
  IE: [22, '爱尔兰'],
  IL: [23, '以色列'],
  IQ: [23, '伊拉克'],
  IR: [26, '伊朗'],
  IS: [26, '冰岛'],
  IT: [27, '意大利'],
  JO: [30, '约旦'],
  KM: [27, '科摩罗'],
  KW: [30, '科威特'],
  KZ: [20, '哈萨克斯坦'],
  LB: [28, '黎巴嫩'],
  LC: [32, '圣卢西亚'],
  LI: [21, '列支敦士登'],
  LT: [20, '立陶宛'],
  LU: [20, '卢森堡'],
  LV: [21, '拉脱维亚'],
  LY: [25, '利比亚'],
  MA: [28, '摩洛哥'],
  MC: [27, '摩纳哥'],
  MD: [24, '摩尔多瓦'],
  ME: [22, '黑山'],
  MG: [27, '马达加斯加'],
  MK: [19, '北马其顿'],
  ML: [28, '马里'],
  MN: [20, '蒙古'],
  MR: [27, '毛里塔尼亚'],
  MT: [31, '马耳他'],
  MU: [30, '毛里求斯'],
  MZ: [25, '莫桑比克'],
  NE: [28, '尼日尔'],
  NI: [28, '尼加拉瓜'],
  NL: [18, '荷兰'],
  NO: [15, '挪威'],
  OM: [23, '阿曼'],
  PK: [24, '巴基斯坦'],
  PL: [28, '波兰'],
  PS: [29, '巴勒斯坦'],
  PT: [25, '葡萄牙'],
  QA: [29, '卡塔尔'],
  RO: [24, '罗马尼亚'],
  RS: [22, '塞尔维亚'],
  RU: [33, '俄罗斯'],
  SA: [24, '沙特阿拉伯'],
  SC: [31, '塞舌尔'],
  SD: [18, '苏丹'],
  SE: [24, '瑞典'],
  SI: [19, '斯洛文尼亚'],
  SK: [24, '斯洛伐克'],
  SM: [27, '圣马力诺'],
  SN: [28, '塞内加尔'],
  SO: [23, '索马里'],
  ST: [25, '圣多美和普林西比'],
  SV: [28, '萨尔瓦多'],
  TD: [27, '乍得'],
  TG: [28, '多哥'],
  TL: [23, '东帝汶'],
  TN: [24, '突尼斯'],
  TR: [26, '土耳其'],
  UA: [29, '乌克兰'],
  VA: [22, '梵蒂冈'],
  VG: [24, '英属维尔京群岛'],
  XK: [20, '科索沃'],
  YE: [30, '也门']
}

export function compactIban(raw) {
  return String(raw ?? '').replace(/[\s-]/g, '').toUpperCase()
}

export function formatIban(value) {
  return String(value ?? '').replace(/(.{4})/g, '$1 ').trim()
}

// Letters become A=10 … Z=35; the running remainder keeps numbers small.
export function mod97(value) {
  let remainder = 0
  for (const character of String(value)) {
    const code = character.charCodeAt(0)
    let digits
    if (code >= 48 && code <= 57) digits = character
    else if (code >= 65 && code <= 90) digits = String(code - 55)
    else throw new Error(`IBAN 中包含非法字符：${character}`)
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder
}

export function validateIban(raw) {
  const result = {
    valid: false,
    reason: '',
    countryCode: '',
    countryName: '',
    checkDigits: '',
    bban: '',
    formatted: ''
  }

  const compact = compactIban(raw)
  result.formatted = formatIban(compact)
  if (!compact) {
    result.reason = '请输入 IBAN'
    return result
  }
  if (!/^[A-Z0-9]+$/.test(compact)) {
    result.reason = 'IBAN 只能包含字母和数字'
    return result
  }
  if (compact.length < 4) {
    result.reason = 'IBAN 至少需要 4 位（2 位国家代码 + 2 位校验位）'
    return result
  }

  result.countryCode = compact.slice(0, 2)
  result.checkDigits = compact.slice(2, 4)
  result.bban = compact.slice(4)

  if (!/^[A-Z]{2}$/.test(result.countryCode)) {
    result.reason = '前 2 位必须是国家/地区代码（英文字母）'
    return result
  }
  const entry = IBAN_COUNTRIES[result.countryCode]
  if (!entry) {
    result.reason = `不支持的国家/地区代码：${result.countryCode}`
    return result
  }
  const [expectedLength, countryName] = entry
  result.countryName = countryName

  if (!/^\d{2}$/.test(result.checkDigits)) {
    result.reason = '第 3-4 位必须是数字校验位'
    return result
  }
  if (compact.length !== expectedLength) {
    result.reason = `${countryName}（${result.countryCode}）的 IBAN 应为 ${expectedLength} 位，当前为 ${compact.length} 位`
    return result
  }

  const remainder = mod97(compact.slice(4) + compact.slice(0, 4))
  if (remainder !== 1) {
    result.reason = `mod-97 校验失败（余数为 ${remainder}，应为 1），校验位或账号有误`
    return result
  }

  result.valid = true
  return result
}

export const SAMPLE_IBAN = 'DE89370400440532013000'

function statItem(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('span', { className: 'stat-label', textContent: label }),
    createElement('span', { className: 'stat-value', textContent: value })
  ])
}

export default {
  id: 'iban-validator',
  name: 'IBAN 校验',
  description: '校验国际银行账号（IBAN）并解析国家、校验位与账号结构',
  category: 'devtool',
  icon: 'search',
  keywords: ['iban', '银行账号', 'mod97', 'iso13616', '校验'],
  render(container) {
    const ibanInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '例如 DE89 3704 0044 0532 0130 00',
      autocomplete: 'off',
      spellcheck: 'false'
    })

    const verdict = createElement('div', { className: 'inline-result' })
    const errorEl = createElement('div', { className: 'error-text' })
    const statsRow = createElement('div', { className: 'stats-row' })
    const formattedOutput = createElement('textarea', {
      className: 'textarea',
      rows: 2,
      readOnly: true,
      placeholder: '格式化结果将显示在此…'
    })

    const statsSection = createSection('解析结果', statsRow)
    statsSection.hidden = true

    function clear() {
      verdict.replaceChildren()
      statsRow.replaceChildren()
      statsSection.hidden = true
      errorEl.textContent = ''
    }

    function run({ force = false } = {}) {
      clear()
      const raw = ibanInput.value.trim()
      if (!raw) {
        formattedOutput.value = ''
        return
      }
      const result = validateIban(raw)
      // While typing, stay quiet until enough characters are in.
      if (!force && compactIban(raw).length < 5) {
        formattedOutput.value = result.formatted
        return
      }

      verdict.replaceChildren(createElement('span', {
        className: 'result-value',
        textContent: result.valid ? '✓ IBAN 有效' : '✗ IBAN 无效'
      }))
      formattedOutput.value = result.formatted
      if (!result.valid) errorEl.textContent = result.reason

      statsSection.hidden = false
      statsRow.replaceChildren(
        statItem('校验结果', result.valid ? '通过' : '未通过'),
        statItem('国家/地区', result.countryName || '未知'),
        statItem('国家代码', result.countryCode || '——'),
        statItem('校验位', result.checkDigits || '——'),
        statItem('账号部分 BBAN', result.bban || '——'),
        statItem('长度', `${compactIban(raw).length} 位`)
      )
    }

    ibanInput.addEventListener('input', () => run())

    container.append(
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: 'IBAN' }),
        ibanInput
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '校验',
          onClick: () => run({ force: true })
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            ibanInput.value = SAMPLE_IBAN
            run({ force: true })
          }
        })
      ]),
      verdict,
      errorEl,
      statsSection,
      createSection('格式化 IBAN（每 4 位一组）', formattedOutput)
    )
  }
}
