import CryptoJS from 'crypto-js'
import bcrypt from 'bcryptjs'
import { createElement, createSection } from '../../utils/dom.js'

// Apache htpasswd / HTTP Basic Auth credential generator. bcrypt comes from
// bcryptjs, SHA1 from crypto-js, and the Apache "$apr1$" MD5 crypt variant is
// implemented locally (verified against `openssl passwd -apr1`).

export const FORMATS = [
  { value: 'bcrypt', label: 'bcrypt（-B）', hint: '以 $2b$ 开头，推荐用于新配置' },
  { value: 'sha1', label: 'SHA1（-s，{SHA}）', hint: '输出 {SHA} + Base64(SHA1(密码))' },
  { value: 'apr1', label: 'MD5（-m，$apr1$）', hint: 'Apache 专有 apr1 变体，每次生成随机盐' },
  { value: 'plain', label: '明文（-p）', hint: '仅用于调试，切勿用于生产' }
]

const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BCRYPT_COST = 10

export function generateApr1Salt(length = 8) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let salt = ''
  for (const byte of bytes) salt += ITOA64[byte % ITOA64.length]
  return salt
}

function toLatin1(value) {
  const bytes = new TextEncoder().encode(value)
  let out = ''
  for (const byte of bytes) out += String.fromCharCode(byte)
  return out
}

function bytesToWordArray(bytes) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return CryptoJS.enc.Latin1.parse(text)
}

function wordArrayToBytes(wordArray) {
  const bytes = []
  for (let i = 0; i < wordArray.sigBytes; i++) {
    bytes.push((wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff)
  }
  return bytes
}

function md5Bytes(bytes) {
  return wordArrayToBytes(CryptoJS.MD5(bytesToWordArray(bytes)))
}

// Apache's apr1 MD5 crypt (apr_md5.c) — the same scheme as BSD md5crypt with
// the "$apr1$" magic. Kept byte-exact so its output matches `htpasswd -m`.
export function apr1Crypt(password, salt) {
  const secret = String(password ?? '')
  const saltText = String(salt ?? '').slice(0, 8)
  const pw = wordArrayToBytes(CryptoJS.enc.Latin1.parse(toLatin1(secret)))
  const sa = wordArrayToBytes(CryptoJS.enc.Latin1.parse(toLatin1(saltText)))
  const magic = [0x24, 0x61, 0x70, 0x72, 0x31, 0x24] // "$apr1$"

  let context = [...pw, ...magic, ...sa]
  let digest = md5Bytes([...pw, ...sa, ...pw])
  for (let i = pw.length; i > 0; i -= 16) context.push(...digest.slice(0, Math.min(16, i)))
  for (let i = pw.length; i > 0; i >>= 1) context.push((i & 1) ? 0 : pw[0])
  digest = md5Bytes(context)

  for (let round = 0; round < 1000; round++) {
    const buffer = []
    if (round & 1) buffer.push(...pw)
    else buffer.push(...digest)
    if (round % 3) buffer.push(...sa)
    if (round % 7) buffer.push(...pw)
    if (round & 1) buffer.push(...digest)
    else buffer.push(...pw)
    digest = md5Bytes(buffer)
  }

  const encode = (value, count) => {
    let remaining = value
    let out = ''
    for (let i = 0; i < count; i++) {
      out += ITOA64[remaining & 0x3f]
      remaining >>>= 6
    }
    return out
  }
  const mix = (a, b, c) => (a << 16) | (b << 8) | c

  let hash = ''
  hash += encode(mix(digest[0], digest[6], digest[12]), 4)
  hash += encode(mix(digest[1], digest[7], digest[13]), 4)
  hash += encode(mix(digest[2], digest[8], digest[14]), 4)
  hash += encode(mix(digest[3], digest[9], digest[15]), 4)
  hash += encode(mix(digest[4], digest[10], digest[5]), 4)
  hash += encode(digest[11], 2)
  return `$apr1$${saltText}$${hash}`
}

export function sha1Htpasswd(password) {
  const digest = CryptoJS.SHA1(String(password ?? '')).toString(CryptoJS.enc.Base64)
  return `{SHA}${digest}`
}

export function bcryptHtpasswd(password, cost = BCRYPT_COST) {
  return bcrypt.hashSync(String(password ?? ''), bcrypt.genSaltSync(cost))
}

export function hashPassword(password, format, options = {}) {
  const value = String(password ?? '')
  if (!value) throw new Error('请输入密码')
  switch (format) {
    case 'bcrypt':
      return bcryptHtpasswd(value, options.cost ?? BCRYPT_COST)
    case 'sha1':
      return sha1Htpasswd(value)
    case 'apr1':
      return apr1Crypt(value, options.salt || generateApr1Salt())
    case 'plain':
      return value
    default:
      throw new Error(`不支持的格式：${format}`)
  }
}

export function buildHtpasswdLine(username, password, format, options = {}) {
  const user = String(username ?? '').trim()
  if (!user) throw new Error('请输入用户名')
  if (user.includes(':')) throw new Error('用户名不能包含冒号（会被 htpasswd 当作分隔符）')
  return `${user}:${hashPassword(password, format, options)}`
}

export function basicAuthHeader(username, password) {
  const credentials = `${String(username ?? '').trim()}:${String(password ?? '')}`
  const encoded = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(credentials))
  return `Authorization: Basic ${encoded}`
}

function errorMessage(cause) {
  return cause instanceof Error ? cause.message : String(cause)
}

const SAMPLE_USERNAME = 'admin'
const SAMPLE_PASSWORD = 'hunter2'

export default {
  id: 'htpasswd-generator',
  name: 'htpasswd 生成器',
  description: '生成 Apache htpasswd / HTTP Basic Auth 凭据，支持 bcrypt、SHA1、MD5 与明文格式',
  category: 'devtool',
  icon: 'jwt',
  keywords: ['htpasswd', 'apache', 'basic auth', 'bcrypt', 'apr1', 'sha1'],
  render(container) {
    const usernameInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '例如 admin',
      autocomplete: 'off'
    })
    const passwordInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '请输入密码…',
      autocomplete: 'off'
    })
    const formatSelect = createElement('select', { className: 'select' }, FORMATS.map(format => createElement('option', {
      value: format.value,
      textContent: format.label
    })))
    const formatHint = createElement('div', { className: 'form-hint' })
    const errorEl = createElement('div', { className: 'error-text' })
    const lineOutput = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      readOnly: true,
      placeholder: 'username:hash 将显示在此…'
    })
    const headerOutput = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      readOnly: true,
      placeholder: 'Authorization 请求头将显示在此…'
    })

    const syncHint = () => {
      const format = FORMATS.find(item => item.value === formatSelect.value)
      formatHint.textContent = format ? format.hint : ''
    }
    formatSelect.addEventListener('change', syncHint)
    syncHint()

    function run() {
      errorEl.textContent = ''
      try {
        lineOutput.value = buildHtpasswdLine(usernameInput.value, passwordInput.value, formatSelect.value)
        headerOutput.value = basicAuthHeader(usernameInput.value, passwordInput.value)
      } catch (cause) {
        lineOutput.value = ''
        headerOutput.value = ''
        errorEl.textContent = errorMessage(cause)
      }
    }

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '用户名' }),
          usernameInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '密码' }),
          passwordInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '格式' }),
          formatSelect
        ])
      ]),
      formatHint,
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '生成凭据',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            usernameInput.value = SAMPLE_USERNAME
            passwordInput.value = SAMPLE_PASSWORD
            run()
          }
        })
      ]),
      errorEl,
      createSection('htpasswd 文件内容', lineOutput),
      createSection('Authorization 请求头', headerOutput)
    )
  }
}
