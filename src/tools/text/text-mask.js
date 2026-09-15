import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// Masking of personal data (email, phone, ID card, bank card, secrets, IP).
// Every masker is a pure string → string function so tests can assert that the
// masked output no longer matches the original sensitive patterns.

export const MASK_RULES = {
  email: {
    label: '邮箱',
    keepStart: 2,
    keepEnd: 0,
    note: '保留前 2 位与完整域名，如 ab***@example.com'
  },
  phone: {
    label: '手机号',
    keepStart: 3,
    keepEnd: 4,
    note: '保留前 3 位与后 4 位，如 138****8888'
  },
  idCard: {
    label: '身份证',
    keepStart: 6,
    keepEnd: 4,
    note: '保留前 6 位（地区码）与后 4 位，如 110101********1234'
  },
  bankCard: {
    label: '银行卡',
    keepStart: 0,
    keepEnd: 4,
    note: '仅保留后 4 位，支持空格 / 短横线分组写法，如 ************3456、**** **** **** 3456'
  },
  secret: {
    label: '密钥',
    keepStart: 4,
    keepEnd: 4,
    note: '长度 ≥ 20 且同时含字母与数字的十六进制 / Base64 串，保留前 4 位与后 4 位'
  },
  ip: {
    label: 'IP 地址',
    keepStart: 0,
    keepEnd: 0,
    ipOctets: 2,
    note: '保留前两段，如 192.168.***.***'
  }
}

export const KIND_IDS = ['email', 'phone', 'idCard', 'bankCard', 'secret', 'ip']

export const MASK_CHARS = ['*', '•', 'x', '#']

export const KEEP_LEVELS = [
  { value: 'default', label: '默认（推荐）' },
  { value: 'less', label: '少保留一位' },
  { value: 'more', label: '多保留几位' },
  { value: 'none', label: '全部隐藏' }
]

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
// Mainland China mobile numbers, with boundaries so the 11 digits inside a
// longer digit run (an ID or card number) are never matched on their own.
const PHONE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/g
const ID_CARD_PATTERN = /(?<![\dXx])[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?![\dXx])/g
// 16–19 digits, optionally written in groups ("6222 0202 0011 3456").
const BANK_CARD_PATTERN = /(?<![\d-])\d(?:[ -]?\d){15,18}(?![\d-])/g
const SECRET_PATTERN = /(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{20,}={0,2}(?![A-Za-z0-9+/=])/g
const IPV4_PATTERN = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g

// The minimum width of a mask run: the run does not shrink below this, so a
// short secret does not leak its exact length.
const MIN_MASK_RUN = 3

function maskCharOf(options = {}) {
  return MASK_CHARS.includes(options.maskChar) ? options.maskChar : '*'
}

function enabledKinds(kinds) {
  if (!kinds) return new Set(KIND_IDS)
  if (Array.isArray(kinds)) return new Set(kinds.filter(id => KIND_IDS.includes(id)))
  return new Set(KIND_IDS.filter(id => kinds[id]))
}

// keepLevel adjusts every rule at once: 少/多 shift the visible head (and tail
// for the fixed-length rules), 全部隐藏 leaves nothing visible.
export function resolveKeep(ruleId, options = {}) {
  const rule = MASK_RULES[ruleId]
  const level = options.keepLevel ?? 'default'
  const octets = rule.ipOctets ?? null
  if (level === 'none') return { keepStart: 0, keepEnd: 0, octets: octets == null ? null : 0 }
  const more = octets == null ? 2 : 1
  const delta = level === 'less' ? -1 : level === 'more' ? more : 0
  const tailDelta = level === 'more' && octets == null ? 1 : 0
  return {
    keepStart: Math.max(0, rule.keepStart + delta),
    keepEnd: Math.max(0, rule.keepEnd + tailDelta),
    octets: octets == null ? null : Math.min(4, Math.max(0, octets + delta))
  }
}

// Keep `keepStart` leading and `keepEnd` trailing characters, and replace
// everything between with the mask character. At least one character always
// stays hidden.
export function maskToken(token, keepStart, keepEnd, maskChar) {
  const length = token.length
  if (!length) return token
  let start = Math.max(0, Math.min(keepStart, length))
  let end = Math.max(0, Math.min(keepEnd, length - start))
  if (start + end >= length) {
    if (end >= length) {
      start = 0
      end = Math.max(0, length - 1)
    } else {
      start = Math.max(0, length - 1 - end)
    }
  }
  const run = Math.max(MIN_MASK_RUN, length - start - end)
  return token.slice(0, start) + maskChar.repeat(run) + (end ? token.slice(length - end) : '')
}

export function maskEmails(text, options = {}) {
  const maskChar = maskCharOf(options)
  const { keepStart, keepEnd } = resolveKeep('email', options)
  return String(text ?? '').replace(EMAIL_PATTERN, match => {
    const at = match.indexOf('@')
    return maskToken(match.slice(0, at), keepStart, keepEnd, maskChar) + match.slice(at)
  })
}

export function maskPhones(text, options = {}) {
  const maskChar = maskCharOf(options)
  const { keepStart, keepEnd } = resolveKeep('phone', options)
  return String(text ?? '').replace(PHONE_PATTERN, match => maskToken(match, keepStart, keepEnd, maskChar))
}

export function maskIdCards(text, options = {}) {
  const maskChar = maskCharOf(options)
  const { keepStart, keepEnd } = resolveKeep('idCard', options)
  return String(text ?? '').replace(ID_CARD_PATTERN, match => maskToken(match, keepStart, keepEnd, maskChar))
}

// Card numbers keep their original grouping: only the digits are replaced, so
// "6222 0202 0011 3456" becomes "**** **** **** 3456".
function maskCardNumber(match, keepStart, keepEnd, maskChar) {
  const length = match.replace(/\D/g, '').length
  if (length < 12) return match
  const start = Math.min(keepStart, Math.max(0, length - keepEnd - 1))
  const hiddenTo = length - keepEnd
  let position = 0
  return match.replace(/\d/g, digit => {
    const current = position++
    return current >= start && current < hiddenTo ? maskChar : digit
  })
}

export function maskBankCards(text, options = {}) {
  const maskChar = maskCharOf(options)
  const { keepStart, keepEnd } = resolveKeep('bankCard', options)
  return String(text ?? '').replace(BANK_CARD_PATTERN, match => maskCardNumber(match, keepStart, keepEnd, maskChar))
}

export function maskKeys(text, options = {}) {
  const maskChar = maskCharOf(options)
  const { keepStart, keepEnd } = resolveKeep('secret', options)
  return String(text ?? '').replace(SECRET_PATTERN, match => {
    // A long run of pure digits (an ID or card number) or a plain long word is
    // not a credential — require a mix of letters and digits.
    if (!/[0-9]/.test(match) || !/[A-Za-z]/.test(match)) return match
    return maskToken(match, keepStart, keepEnd, maskChar)
  })
}

export function maskIpAddresses(text, options = {}) {
  const maskChar = maskCharOf(options)
  const { octets } = resolveKeep('ip', options)
  const visible = octets ?? 2
  return String(text ?? '').replace(IPV4_PATTERN, match => {
    const parts = match.split('.')
    if (parts.some(part => Number(part) > 255 || part.length > 3)) return match
    return parts.map((part, index) => (index < visible ? part : maskChar.repeat(3))).join('.')
  })
}

const MASKERS = {
  email: maskEmails,
  phone: maskPhones,
  idCard: maskIdCards,
  bankCard: maskBankCards,
  secret: maskKeys,
  ip: maskIpAddresses
}

// Longest / most specific patterns first: an 18-digit ID must be masked before
// the card and phone patterns get a chance to match a substring of it.
const APPLY_ORDER = ['secret', 'idCard', 'bankCard', 'phone', 'email', 'ip']

export function maskText(text, options = {}) {
  const kinds = enabledKinds(options.kinds)
  return APPLY_ORDER.reduce((out, id) => (kinds.has(id) ? MASKERS[id](out, options) : out), String(text ?? ''))
}

const SAMPLE_TEXT = [
  '联系人：张三 <zhangsan@example.com>',
  '手机：13812348888  身份证：110101199003071234',
  '银行卡：6222020200112233',
  'API Key：sk-a1b2c3d4e5f60718293a4b5c6d7e8f90',
  '服务器：192.168.1.100'
].join('\n')

export default {
  id: 'text-mask',
  name: '文本脱敏',
  description: '对邮箱、手机号、身份证、银行卡与密钥进行掩码脱敏',
  category: 'text',
  icon: 'shield-link',
  keywords: ['脱敏', '掩码', 'mask', '隐私', '手机号', '身份证', '打码'],
  render(container) {
    const kindBoxes = new Map()
    const kindsGrid = createElement('div', { className: 'grid-3' })
    for (const id of KIND_IDS) {
      const box = createElement('input', { className: 'checkbox', type: 'checkbox', checked: true })
      kindBoxes.set(id, box)
      kindsGrid.appendChild(createElement('label', { className: 'option-item' }, [
        box,
        createElement('span', { textContent: MASK_RULES[id].label })
      ]))
    }

    const maskChar = createElement('select', { className: 'select', 'aria-label': '掩码字符' })
    for (const char of MASK_CHARS) {
      maskChar.appendChild(createElement('option', { value: char, textContent: `${char} （${char === 'x' ? '小写字母 x' : '符号'}）` }))
    }

    const keepLevel = createElement('select', { className: 'select', 'aria-label': '保留首尾位数' })
    for (const level of KEEP_LEVELS) {
      keepLevel.appendChild(createElement('option', { value: level.value, textContent: level.label }))
    }

    const state = renderTextTransform(container, {
      inputTitle: '原始文本',
      outputTitle: '脱敏结果',
      inputPlaceholder: '粘贴包含邮箱、手机号、身份证、银行卡或密钥的文本…',
      outputPlaceholder: '脱敏结果将显示在此…',
      actionLabel: '开始脱敏',
      sample: SAMPLE_TEXT,
      rows: 10,
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: '脱敏类型' }),
            kindsGrid
          ])
        ]),
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', textContent: '掩码字符' }),
            maskChar
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', textContent: '保留首尾位数' }),
            keepLevel
          ])
        ]),
        createElement('div', { className: 'form-hint' }, [
          ...KIND_IDS.map(id => createElement('div', { textContent: `${MASK_RULES[id].label}：${MASK_RULES[id].note}` })),
          createElement('div', { textContent: '以上为默认保留位数；切换“保留首尾位数”会在默认值基础上统一增减，掩码段始终至少保留 3 个掩码字符。' })
        ])
      ],
      transform(text) {
        if (!text) return ''
        return maskText(text, {
          kinds: [...kindBoxes.entries()].filter(([, box]) => box.checked).map(([id]) => id),
          maskChar: maskChar.value,
          keepLevel: keepLevel.value
        })
      }
    })

    for (const box of kindBoxes.values()) box.addEventListener('change', state.run)
    maskChar.addEventListener('change', state.run)
    keepLevel.addEventListener('change', state.run)
  }
}
