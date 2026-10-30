// AES helpers shared by the AES and text-encryption tools.
//
// Built on @noble/ciphers (audited, pure JS) instead of crypto-js: the latter
// is unmaintained upstream. Padding is handled here because noble only exposes
// the raw block modes.
import { cbc, ctr, ecb } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { fromBase64, toBase64 } from './hash.js'

export const AES_MODES = ['CBC', 'ECB', 'CTR']
export const AES_PADDINGS = ['Pkcs7', 'ZeroPadding', 'NoPadding']

export function deriveAesKey(passphrase) {
  return sha256(new TextEncoder().encode(String(passphrase ?? '')))
}

// Accept a 32-char hex IV or a 16-character (UTF-8) text IV.
export function parseAesIv(value) {
  const text = String(value ?? '')
  if (/^[0-9a-fA-F]{32}$/.test(text)) {
    return Uint8Array.from(text.match(/../g), pair => parseInt(pair, 16))
  }
  const bytes = new TextEncoder().encode(text)
  if (bytes.length !== 16) throw new Error('IV 必须是 16 字节（16 个字符或 32 位十六进制）')
  return bytes
}

function padBytes(bytes, padding) {
  const remaining = bytes.length % 16
  if (padding === 'NoPadding') {
    if (remaining) throw new Error('NoPadding 要求数据长度是 16 的倍数')
    return bytes
  }
  // Zero padding only extends a partial final block.
  if (!remaining) return bytes
  const padded = new Uint8Array(bytes.length + (16 - remaining))
  padded.set(bytes)
  return padded
}

function unpadBytes(bytes, padding) {
  if (padding === 'NoPadding') return bytes
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  return bytes.slice(0, end)
}

export function aesCrypt(bytes, key, { decrypt = false, mode = 'CBC', iv, padding = 'Pkcs7' } = {}) {
  if (!AES_MODES.includes(mode)) throw new Error(`不支持的 AES 模式：${mode}`)
  if (!AES_PADDINGS.includes(padding)) throw new Error(`不支持的填充方式：${padding}`)
  if (!key || (key.length !== 16 && key.length !== 24 && key.length !== 32)) {
    throw new Error('AES 密钥必须是 16、24 或 32 字节')
  }

  if (mode === 'CTR') {
    if (!iv || iv.length !== 16) throw new Error('CTR 模式需要 16 字节 IV')
    const cipher = ctr(key, iv)
    return decrypt ? cipher.decrypt(bytes) : cipher.encrypt(bytes)
  }

  if (mode === 'CBC' && (!iv || iv.length !== 16)) throw new Error('CBC 模式需要 16 字节 IV')
  // noble applies PKCS#7 itself; Zero/NoPadding need the raw block mode.
  const options = padding === 'Pkcs7' ? {} : { disablePadding: true }
  const cipher = mode === 'ECB' ? ecb(key, options) : cbc(key, iv, options)
  if (decrypt) {
    const plaintext = cipher.decrypt(bytes)
    return padding === 'Pkcs7' ? plaintext : unpadBytes(plaintext, padding)
  }
  return cipher.encrypt(padding === 'Pkcs7' ? bytes : padBytes(bytes, padding))
}

// Ciphertext is base64 (the format the tool has always produced); hex is
// accepted on input so users can paste output from other tools.
export function encodeCiphertext(bytes) {
  return toBase64(bytes)
}

export function decodeCiphertext(text) {
  const value = String(text ?? '').trim()
  if (!value) throw new Error('请输入密文')
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    return Uint8Array.from(value.match(/../g), pair => parseInt(pair, 16))
  }
  try {
    return fromBase64(value)
  } catch {
    throw new Error('密文不是合法的 Base64 或十六进制')
  }
}
