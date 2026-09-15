import { createElement, createSegmentedGroup, showToast } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// International Morse code (ITU-R M.1677-1): letters, digits and the common
// punctuation marks. Encoding is case-insensitive.
//
// Unknown characters are DROPPED from the encoded output and reported back to
// the caller through findUnsupportedChars(), which the UI renders as a warning
// under the options row. The opposite direction maps an unrecognised Morse
// sequence to '?' so the failure stays visible inside the result.

export const MORSE_TABLE = Object.freeze({
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  0: '-----',
  1: '.----',
  2: '..---',
  3: '...--',
  4: '....-',
  5: '.....',
  6: '-....',
  7: '--...',
  8: '---..',
  9: '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.'
})

export const UNKNOWN_MORSE_CHAR = '?'

const MORSE_REVERSE_TABLE = Object.freeze(
  Object.fromEntries(Object.entries(MORSE_TABLE).map(([char, code]) => [code, char]))
)

export const DEFAULT_LETTER_SEPARATOR = ' '
export const DEFAULT_WORD_SEPARATOR = ' / '
export const DEFAULT_DECODE_WORD_SEPARATOR = '/'

// Morse playback rhythm, in units of the shortest element (a dot).
export const MORSE_TIMING = {
  unitMs: 80,
  dashUnits: 3,
  symbolGapUnits: 1,
  letterGapUnits: 3,
  wordGapUnits: 7
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findUnsupportedChars(text) {
  const unsupported = new Set()
  for (const char of String(text ?? '')) {
    if (/\s/.test(char)) continue
    if (MORSE_TABLE[char.toUpperCase()]) continue
    unsupported.add(char)
  }
  return [...unsupported]
}

export function textToMorse(text, options = {}) {
  const {
    letterSeparator = DEFAULT_LETTER_SEPARATOR,
    wordSeparator = DEFAULT_WORD_SEPARATOR,
    unknown = 'drop'
  } = options

  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const encodedWords = []
  for (const word of words) {
    const letters = []
    for (const char of [...word]) {
      const code = MORSE_TABLE[char.toUpperCase()]
      if (code) letters.push(code)
      else if (unknown === 'keep') letters.push(char)
    }
    if (letters.length) encodedWords.push(letters.join(letterSeparator))
  }
  return encodedWords.join(wordSeparator)
}

// Decoding always accepts "/" and a line break as a word break, and adds the
// configured separator on top of them, so a custom separator never makes
// standard input unreadable.
function splitMorseWords(value, wordSeparator) {
  const separator = String(wordSeparator ?? '').trim()
  const alternatives = new Set(['/', '\\n'])
  if (separator && separator !== DEFAULT_DECODE_WORD_SEPARATOR) alternatives.add(escapeRegExp(separator))
  return value.split(new RegExp(`\\s*(?:${[...alternatives].join('|')})\\s*`))
}

function splitMorseLetters(word, letterSeparator) {
  const separator = String(letterSeparator ?? '')
  const pattern = /^\s*$/.test(separator) ? /\s+/ : new RegExp(`\\s*${escapeRegExp(separator)}\\s*`)
  return word.split(pattern).filter(Boolean)
}

export function morseToText(code, options = {}) {
  const {
    letterSeparator = DEFAULT_LETTER_SEPARATOR,
    wordSeparator = DEFAULT_DECODE_WORD_SEPARATOR
  } = options

  const value = String(code ?? '').trim()
  if (!value) return ''

  return splitMorseWords(value, wordSeparator)
    .map(word => word.trim())
    .filter(Boolean)
    .map(word => splitMorseLetters(word, letterSeparator)
      .map(token => MORSE_REVERSE_TABLE[token] ?? UNKNOWN_MORSE_CHAR)
      .join(''))
    .join(' ')
}

// Counts the tokens the reverse table does not know. It cannot be derived from
// the decoded text, because '?' is also the (valid) decoding of '..--..'.
export function countUnknownMorseTokens(code, options = {}) {
  const {
    letterSeparator = DEFAULT_LETTER_SEPARATOR,
    wordSeparator = DEFAULT_DECODE_WORD_SEPARATOR
  } = options

  const value = String(code ?? '').trim()
  if (!value) return 0

  let count = 0
  for (const word of splitMorseWords(value, wordSeparator)) {
    for (const token of splitMorseLetters(word.trim(), letterSeparator)) {
      if (!MORSE_REVERSE_TABLE[token]) count++
    }
  }
  return count
}

// Flattened playback plan: one entry per tone or silence, positioned on a
// millisecond timeline. Pure, so the rhythm is unit-testable without audio.
export function buildMorseTimeline(code, options = {}) {
  const {
    unit = MORSE_TIMING.unitMs,
    letterSeparator = DEFAULT_LETTER_SEPARATOR,
    wordSeparator = DEFAULT_DECODE_WORD_SEPARATOR
  } = options

  const value = String(code ?? '').trim()
  if (!value) return []

  const words = splitMorseWords(value, wordSeparator)
    .map(word => splitMorseLetters(word.trim(), letterSeparator).map(token => [...token].filter(char => char === '.' || char === '-')).filter(symbols => symbols.length))
    .filter(word => word.length)
  if (!words.length) return []

  const timeline = []
  let cursor = 0
  const push = (tone, units) => {
    const duration = units * unit
    timeline.push({ tone, start: cursor, duration })
    cursor += duration
  }

  words.forEach((letters, wordIndex) => {
    letters.forEach((symbols, letterIndex) => {
      symbols.forEach((symbol, symbolIndex) => {
        push(true, symbol === '.' ? 1 : MORSE_TIMING.dashUnits)
        if (symbolIndex < symbols.length - 1) push(false, MORSE_TIMING.symbolGapUnits)
      })
      if (letterIndex < letters.length - 1) push(false, MORSE_TIMING.letterGapUnits)
    })
    if (wordIndex < words.length - 1) push(false, MORSE_TIMING.wordGapUnits)
  })

  return timeline
}

// Web Audio playback. Returns the AudioContext (or null when the environment
// has no Web Audio at all, e.g. jsdom), and never throws — the caller only
// needs to tell the user when nothing could be played.
export function playMorseTimeline(timeline, { frequency = 620, volume = 0.22 } = {}) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AudioContextClass || !Array.isArray(timeline) || !timeline.length) return null
  try {
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    gain.connect(context.destination)

    const startedAt = context.currentTime + 0.06
    const rampSeconds = 0.005
    gain.gain.setValueAtTime(0, startedAt)
    for (const entry of timeline) {
      if (!entry.tone) continue
      const from = startedAt + entry.start / 1000
      const to = from + entry.duration / 1000
      gain.gain.setValueAtTime(0, from)
      gain.gain.linearRampToValueAtTime(volume, from + rampSeconds)
      gain.gain.setValueAtTime(volume, Math.max(from + rampSeconds, to - rampSeconds))
      gain.gain.linearRampToValueAtTime(0, to)
    }

    const totalSeconds = (timeline.at(-1).start + timeline.at(-1).duration) / 1000
    oscillator.start(startedAt)
    oscillator.stop(startedAt + totalSeconds + 0.05)

    const resumed = context.resume?.()
    if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {})

    // Release the audio device once the last tone has finished.
    setTimeout(() => {
      try {
        context.close()
      } catch {
        // Context already closed — nothing to release.
      }
    }, (totalSeconds + 0.3) * 1000)

    return context
  } catch {
    return null
  }
}

const SAMPLE_TEXT = 'SOS HELLO WORLD 2026'

export default {
  id: 'morse-code',
  name: '摩尔斯电码',
  description: '文本与摩尔斯电码互转，支持音频播放与自定义分隔符',
  category: 'encoding',
  icon: 'unicode',
  keywords: ['morse', '摩尔斯', '摩斯', '电码', 'sos', '音频', 'cw'],
  render(container) {
    let state
    const mode = createSegmentedGroup([
      { value: 'encode', label: '文本→摩尔斯' },
      { value: 'decode', label: '摩尔斯→文本' }
    ], () => state.run())

    const isEncode = () => mode.getValue() === 'encode'

    const letterSeparatorInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '默认：空格',
      autocomplete: 'off'
    })
    const wordSeparatorInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '默认： / '
    })
    const warningEl = createElement('div', {
      className: 'form-hint form-hint-warn',
      role: 'status',
      'aria-live': 'polite'
    })

    // An empty separator input means "use the default".
    const currentSeparators = () => ({
      letterSeparator: letterSeparatorInput.value === '' ? DEFAULT_LETTER_SEPARATOR : letterSeparatorInput.value,
      wordSeparator: wordSeparatorInput.value === '' ? DEFAULT_WORD_SEPARATOR : wordSeparatorInput.value
    })

    const playButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '播放音频',
      onClick: () => {
        const code = (isEncode() ? state.output.value : state.input.value).trim()
        if (!code) {
          showToast('没有可播放的摩尔斯电码')
          return
        }
        const timeline = buildMorseTimeline(code, currentSeparators())
        if (!playMorseTimeline(timeline)) showToast('当前环境不支持音频播放')
      }
    })

    state = renderTextTransform(container, {
      inputTitle: '输入内容',
      outputTitle: '转换结果',
      inputPlaceholder: '输入文本或摩尔斯电码…',
      outputPlaceholder: '转换结果将显示在此…',
      actionLabel: '转换',
      sample: () => (isEncode() ? SAMPLE_TEXT : textToMorse(SAMPLE_TEXT, currentSeparators())),
      outputActions: [playButton],
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: '转换方向' }),
            mode
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', textContent: '字母分隔符' }),
            letterSeparatorInput
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', textContent: '单词分隔符' }),
            wordSeparatorInput
          ])
        ]),
        warningEl
      ],
      transform: text => {
        const separators = currentSeparators()
        if (isEncode()) {
          const unsupported = findUnsupportedChars(text)
          warningEl.textContent = unsupported.length
            ? `以下字符没有摩尔斯编码，已忽略：${unsupported.join(' ')}`
            : ''
          return textToMorse(text, { ...separators, unknown: 'drop' })
        }
        warningEl.textContent = ''
        const unknownCount = countUnknownMorseTokens(text, separators)
        if (unknownCount) warningEl.textContent = `有 ${unknownCount} 个摩尔斯码无法识别，已用 ${UNKNOWN_MORSE_CHAR} 代替`
        return morseToText(text, separators)
      }
    })
  }
}
