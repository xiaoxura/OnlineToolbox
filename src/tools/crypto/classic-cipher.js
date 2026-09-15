import { createElement, createSegmentedGroup } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// Classical substitution ciphers: Caesar (with brute force), ROT13, Vigenère
// and Atbash. Letter case is preserved and non-letters are left untouched.

const UPPER_A = 65
const LOWER_A = 97

export function normalizeShift(shift) {
  const value = Number(shift)
  if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error('位移必须是 0 到 25 之间的整数')
  return ((value % 26) + 26) % 26
}

function shiftLetters(text, offset) {
  return String(text ?? '').replace(/[a-zA-Z]/g, character => {
    const base = character.charCodeAt(0) >= LOWER_A ? LOWER_A : UPPER_A
    const position = character.charCodeAt(0) - base
    return String.fromCharCode(base + (((position + offset) % 26) + 26) % 26)
  })
}

export function caesar(text, shift, decode = false) {
  const offset = normalizeShift(shift)
  return shiftLetters(text, decode ? -offset : offset)
}

export function rot13(text) {
  return shiftLetters(text, 13)
}

export function vigenere(text, key, decode = false) {
  const letters = String(key ?? '').replace(/[^a-zA-Z]/g, '').toLowerCase()
  if (!letters) throw new Error('维吉尼亚密码需要一个只包含字母的关键词')
  const shifts = [...letters].map(character => character.charCodeAt(0) - LOWER_A)
  let index = 0
  return String(text ?? '').replace(/[a-zA-Z]/g, character => {
    const shift = shifts[index++ % shifts.length]
    return shiftLetters(character, decode ? -shift : shift)
  })
}

export function atbash(text) {
  return String(text ?? '').replace(/[a-zA-Z]/g, character => {
    const base = character.charCodeAt(0) >= LOWER_A ? LOWER_A : UPPER_A
    return String.fromCharCode(base + (25 - (character.charCodeAt(0) - base)))
  })
}

// Every Caesar decoding, so the user can eyeball the one that reads as text.
export function bruteForceCaesar(text) {
  return Array.from({ length: 25 }, (_, index) => {
    const shift = index + 1
    return { shift, text: caesar(text, shift, true) }
  })
}

export function formatBruteForce(text) {
  return bruteForceCaesar(text)
    .map(entry => `${String(entry.shift).padStart(2, ' ')} 位移: ${entry.text}`)
    .join('\n')
}

const CIPHER_TYPES = [
  { value: 'caesar', label: '凯撒密码' },
  { value: 'rot13', label: 'ROT13' },
  { value: 'vigenere', label: '维吉尼亚' },
  { value: 'atbash', label: 'Atbash' }
]

const SAMPLE_TEXT = 'Hello, World! Attack at dawn — 5201314'

export default {
  id: 'classic-cipher',
  name: '经典密码',
  description: 'ROT13、凯撒、维吉尼亚与 Atbash 古典密码加密解密',
  category: 'crypto',
  icon: 'escape',
  keywords: ['rot13', '凯撒', 'caesar', '维吉尼亚', 'vigenere', 'atbash', '古典密码'],
  render(container) {
    let state

    const mode = createSegmentedGroup([
      { value: 'encode', label: '加密' },
      { value: 'decode', label: '解密' }
    ], () => state?.run())

    const typeSelect = createElement('select', { className: 'select' }, CIPHER_TYPES.map(type => createElement('option', {
      value: type.value,
      textContent: type.label
    })))

    const shiftInput = createElement('input', {
      className: 'input',
      type: 'range',
      min: '1',
      max: '25',
      step: '1',
      value: '3'
    })
    const shiftValue = createElement('span', { className: 'sub-label', textContent: '3' })
    const shiftGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: '位移量（1-25）' }),
      createElement('div', { className: 'form-row' }, [shiftInput, shiftValue])
    ])

    const keyInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '例如 LEMON',
      autocomplete: 'off'
    })
    const keyGroup = createElement('div', { className: 'form-group', hidden: true }, [
      createElement('label', { className: 'label', textContent: '关键词' }),
      keyInput
    ])

    const bruteCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    const bruteOption = createElement('label', { className: 'option-item', hidden: true }, [
      bruteCheckbox,
      createElement('span', { textContent: '解密时列出全部 25 种位移（暴力枚举）' })
    ])

    const isDecode = () => mode.getValue() === 'decode'

    const syncVisibility = () => {
      const type = typeSelect.value
      shiftGroup.hidden = type !== 'caesar'
      keyGroup.hidden = type !== 'vigenere'
      bruteOption.hidden = type !== 'caesar' || !isDecode()
    }

    const buildSample = () => {
      if (!isDecode()) return SAMPLE_TEXT
      if (typeSelect.value === 'rot13') return rot13(SAMPLE_TEXT)
      if (typeSelect.value === 'atbash') return atbash(SAMPLE_TEXT)
      if (typeSelect.value === 'vigenere') return vigenere(SAMPLE_TEXT, keyInput.value || 'LEMON', false)
      return caesar(SAMPLE_TEXT, shiftInput.value, false)
    }

    typeSelect.addEventListener('change', () => {
      syncVisibility()
      state?.run()
    })
    shiftInput.addEventListener('input', () => {
      shiftValue.textContent = shiftInput.value
      state?.run()
    })
    keyInput.addEventListener('input', () => state?.run())
    bruteCheckbox.addEventListener('change', () => state?.run())

    state = renderTextTransform(container, {
      inputTitle: '输入',
      outputTitle: '输出',
      inputPlaceholder: '输入要处理的文本…',
      outputPlaceholder: '处理结果将显示在此…',
      actionLabel: '转换',
      live: true,
      sample: buildSample,
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: '模式' }),
            mode
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', textContent: '密码类型' }),
            typeSelect
          ])
        ]),
        createElement('div', { className: 'form-row' }, [shiftGroup, keyGroup, bruteOption])
      ],
      transform: text => {
        const decode = isDecode()
        switch (typeSelect.value) {
          case 'rot13':
            return rot13(text)
          case 'atbash':
            return atbash(text)
          case 'vigenere':
            return vigenere(text, keyInput.value, decode)
          default:
            if (decode && bruteCheckbox.checked) return formatBruteForce(text)
            return caesar(text, shiftInput.value, decode)
        }
      }
    })

    syncVisibility()
  }
}
