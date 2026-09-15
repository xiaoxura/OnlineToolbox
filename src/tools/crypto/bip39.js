import CryptoJS from 'crypto-js'
import { createElement, createSection } from '../../utils/dom.js'
import { WORDLIST } from './bip39-wordlist.js'

// BIP-39 mnemonic generation, checksum validation and seed derivation.
// The English wordlist is bundled locally so the tool works fully offline.

export const VALID_STRENGTHS = [128, 160, 192, 224, 256]
export const VALID_WORD_COUNTS = [12, 15, 18, 21, 24]

const WORD_INDEX = new Map(WORDLIST.map((word, index) => [word, index]))

export function bytesToHex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToWordArray(bytes) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return CryptoJS.enc.Latin1.parse(text)
}

function wordArrayToBytes(wordArray) {
  const bytes = new Uint8Array(wordArray.sigBytes)
  for (let i = 0; i < wordArray.sigBytes; i++) {
    bytes[i] = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  }
  return bytes
}

export function sha256Bytes(bytes) {
  return wordArrayToBytes(CryptoJS.SHA256(bytesToWordArray(bytes)))
}

export function bytesToBits(bytes) {
  let bits = ''
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0')
  return bits
}

export function bitsToBytes(bits) {
  const bytes = new Uint8Array(bits.length / 8)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  return bytes
}

export function normalizeMnemonic(mnemonic) {
  return String(mnemonic ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function entropyToMnemonic(entropy) {
  const bytes = entropy instanceof Uint8Array ? entropy : Uint8Array.from(entropy)
  const strength = bytes.length * 8
  if (!VALID_STRENGTHS.includes(strength)) {
    throw new Error('熵长度必须是 128、160、192、224 或 256 位')
  }
  const checksumBits = strength / 32
  const entropyBits = bytesToBits(bytes)
  const checksum = bytesToBits(sha256Bytes(bytes)).slice(0, checksumBits)
  const bits = entropyBits + checksum
  const words = []
  for (let i = 0; i < bits.length; i += 11) words.push(WORDLIST[parseInt(bits.slice(i, i + 11), 2)])
  return words.join(' ')
}

export function mnemonicToEntropy(mnemonic) {
  const words = normalizeMnemonic(mnemonic).split(' ').filter(Boolean)
  if (!words.length) throw new Error('请输入助记词')
  if (!VALID_WORD_COUNTS.includes(words.length)) {
    throw new Error(`助记词数量必须是 ${VALID_WORD_COUNTS.join('、')} 个，当前为 ${words.length} 个`)
  }
  const bits = words.map(word => {
    const index = WORD_INDEX.get(word)
    if (index === undefined) throw new Error(`不是 BIP39 英文词表中的单词：${word}`)
    return index.toString(2).padStart(11, '0')
  }).join('')

  const totalBits = words.length * 11
  const entropyBits = (totalBits * 32) / 33
  const entropy = bitsToBytes(bits.slice(0, entropyBits))
  const expected = bytesToBits(sha256Bytes(entropy)).slice(0, totalBits - entropyBits)
  if (expected !== bits.slice(entropyBits)) throw new Error('校验和无效，助记词可能抄写有误')
  return entropy
}

// Non-throwing inspection used by the 校验 UI.
export function inspectMnemonic(mnemonic) {
  const words = normalizeMnemonic(mnemonic).split(' ').filter(Boolean)
  const invalidWords = words.filter(word => !WORD_INDEX.has(word))
  const countValid = VALID_WORD_COUNTS.includes(words.length) && invalidWords.length === 0
  let entropy = null
  let checksumValid = false
  let error = ''

  if (!words.length) {
    error = '请输入助记词'
  } else if (!VALID_WORD_COUNTS.includes(words.length)) {
    error = `助记词数量必须是 ${VALID_WORD_COUNTS.join('、')} 个，当前为 ${words.length} 个`
  } else if (invalidWords.length) {
    error = `不是 BIP39 英文词表中的单词：${invalidWords.join('、')}`
  } else {
    try {
      entropy = mnemonicToEntropy(words.join(' '))
      checksumValid = true
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }
  }

  return {
    words,
    wordCount: words.length,
    invalidWords,
    countValid,
    checksumValid,
    valid: countValid && checksumValid,
    strengthBits: entropy ? entropy.length * 8 : 0,
    entropy,
    error
  }
}

export function validateMnemonic(mnemonic) {
  try {
    mnemonicToEntropy(mnemonic)
    return true
  } catch {
    return false
  }
}

export function generateMnemonic(strengthBits = 128) {
  const strength = Number(strengthBits)
  if (!VALID_STRENGTHS.includes(strength)) {
    throw new Error('熵长度必须是 128、160、192、224 或 256 位')
  }
  const entropy = new Uint8Array(strength / 8)
  crypto.getRandomValues(entropy)
  return entropyToMnemonic(entropy)
}

// PBKDF2-HMAC-SHA512, 2048 iterations, salt = "mnemonic" + passphrase.
export async function mnemonicToSeed(mnemonic, passphrase = '') {
  const password = normalizeMnemonic(mnemonic)
  if (!password) throw new Error('请输入助记词')
  const salt = `mnemonic${String(passphrase ?? '').normalize('NFKD')}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: encoder.encode(salt),
    iterations: 2048,
    hash: 'SHA-512'
  }, key, 512)
  return new Uint8Array(bits)
}

function errorMessage(cause) {
  return cause instanceof Error ? cause.message : String(cause)
}

function statItem(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('span', { className: 'stat-label', textContent: label }),
    createElement('span', { className: 'stat-value', textContent: value })
  ])
}

// The all-"abandon" 12-word vector from the BIP-39 test suite.
export const SAMPLE_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

export default {
  id: 'bip39',
  name: 'BIP39 助记词',
  description: '生成与校验 BIP39 助记词，并推导种子',
  category: 'crypto',
  icon: 'random',
  keywords: ['bip39', '助记词', 'mnemonic', '钱包', 'seed', '种子', 'pbkdf2'],
  render(container) {
    const wordCountSelect = createElement('select', { className: 'select' }, VALID_WORD_COUNTS.map(count => createElement('option', {
      value: String(count),
      textContent: `${count} 个单词（${(count * 11 * 32) / 33} 位熵）`
    })))

    const mnemonicInput = createElement('textarea', {
      className: 'textarea',
      rows: 4,
      placeholder: '助记词将显示在此，也可以直接粘贴要校验的助记词…'
    })

    const verdict = createElement('div', { className: 'inline-result' })
    const mnemonicStats = createElement('div', { className: 'stats-row' })
    const errorEl = createElement('div', { className: 'error-text' })
    const resultStack = createElement('div', { className: 'tool-stack', hidden: true }, [
      createElement('div', { className: 'label', textContent: '校验结果' }),
      verdict,
      mnemonicStats
    ])

    const passphraseInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '可留空（BIP39 可选密码短语）',
      autocomplete: 'off'
    })
    const seedOutput = createElement('textarea', {
      className: 'textarea',
      rows: 4,
      readOnly: true,
      placeholder: '512 位种子（十六进制）将显示在此…'
    })
    const seedStats = createElement('div', { className: 'stats-row' })

    function runValidate() {
      const info = inspectMnemonic(mnemonicInput.value)
      if (!info.words.length) {
        verdict.replaceChildren()
        mnemonicStats.replaceChildren()
        resultStack.hidden = true
        errorEl.textContent = ''
        return
      }
      resultStack.hidden = false
      verdict.replaceChildren(createElement('span', {
        className: 'result-value',
        textContent: info.valid ? '✓ 助记词有效（校验和通过）' : '✗ 助记词无效'
      }))
      mnemonicStats.replaceChildren(
        statItem('单词数量', `${info.wordCount} 个`),
        statItem('熵强度', info.strengthBits ? `${info.strengthBits} 位` : '——'),
        statItem('校验和', info.checksumValid ? '通过' : '未通过'),
        statItem('无效单词', info.invalidWords.length ? String(info.invalidWords.length) : '无')
      )
      errorEl.textContent = info.valid ? '' : info.error
    }

    async function runDerive() {
      errorEl.textContent = ''
      try {
        const info = inspectMnemonic(mnemonicInput.value)
        if (!info.checksumValid) throw new Error(info.error || '请先输入有效的助记词')
        const seed = await mnemonicToSeed(mnemonicInput.value, passphraseInput.value)
        seedOutput.value = bytesToHex(seed)
        seedStats.replaceChildren(
          statItem('种子长度', `${seed.length * 8} 位 / ${seed.length} 字节`),
          statItem('PBKDF2 迭代', '2048 次'),
          statItem('哈希算法', 'HMAC-SHA512')
        )
      } catch (cause) {
        seedOutput.value = ''
        seedStats.replaceChildren()
        errorEl.textContent = errorMessage(cause)
      }
    }

    mnemonicInput.addEventListener('input', runValidate)

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '生成长度' }),
          wordCountSelect
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '生成助记词',
          onClick: () => {
            try {
              mnemonicInput.value = generateMnemonic(Number(wordCountSelect.value) * 11 * 32 / 33)
              runValidate()
            } catch (cause) {
              errorEl.textContent = errorMessage(cause)
            }
          }
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '校验助记词',
          onClick: runValidate
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            mnemonicInput.value = SAMPLE_MNEMONIC
            runValidate()
          }
        })
      ]),
      resultStack,
      errorEl,
      createSection('助记词', mnemonicInput),
      createSection('种子', createElement('div', { className: 'tool-stack' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '密码短语（可选）' }),
          passphraseInput
        ]),
        createElement('div', { className: 'btn-group form-action-row' }, [
          createElement('button', {
            className: 'btn btn-primary',
            type: 'button',
            textContent: '推导种子',
            onClick: runDerive
          }),
          createElement('button', {
            className: 'btn btn-secondary',
            type: 'button',
            textContent: '示例数据',
            onClick: () => {
              passphraseInput.value = 'TREZOR'
              runDerive()
            }
          })
        ]),
        seedOutput,
        seedStats
      ]))
    )
    runValidate()
  }
}
