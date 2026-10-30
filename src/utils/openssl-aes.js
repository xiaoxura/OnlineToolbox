// OpenSSL-compatible AES passphrase encryption ("Salted__" + base64), the
// format crypto-js produced. Implemented with @noble/hashes + @noble/ciphers so
// previously encrypted text can still be decrypted after dropping crypto-js.
import { cbc } from '@noble/ciphers/aes.js'
import { md5 } from '@noble/hashes/legacy.js'

const MAGIC = new TextEncoder().encode('Salted__')
const KEY_LENGTH = 32
const IV_LENGTH = 16

// OpenSSL EVP_BytesToKey with MD5 and one iteration (crypto-js's default).
export function evpBytesToKey(password, salt, keyLength = KEY_LENGTH, ivLength = IV_LENGTH) {
  const passwordBytes = typeof password === 'string' ? new TextEncoder().encode(password) : password
  const chunks = []
  let previous = new Uint8Array(0)
  let total = 0
  while (total < keyLength + ivLength) {
    const input = new Uint8Array(previous.length + passwordBytes.length + salt.length)
    input.set(previous, 0)
    input.set(passwordBytes, previous.length)
    input.set(salt, previous.length + passwordBytes.length)
    previous = md5(input)
    chunks.push(previous)
    total += previous.length
  }
  const derived = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    derived.set(chunk, offset)
    offset += chunk.length
  }
  return { key: derived.slice(0, keyLength), iv: derived.slice(keyLength, keyLength + ivLength) }
}

export function encryptPassphrase(text, password) {
  const salt = crypto.getRandomValues(new Uint8Array(8))
  const { key, iv } = evpBytesToKey(password, salt)
  // noble's CBC adds PKCS#7 padding by default, matching OpenSSL/crypto-js.
  const ciphertext = cbc(key, iv).encrypt(new TextEncoder().encode(String(text ?? '')))
  const output = new Uint8Array(MAGIC.length + salt.length + ciphertext.length)
  output.set(MAGIC, 0)
  output.set(salt, MAGIC.length)
  output.set(ciphertext, MAGIC.length + salt.length)
  let binary = ''
  for (const byte of output) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decryptPassphrase(payload, password) {
  let binary
  try {
    binary = atob(String(payload ?? '').trim())
  } catch {
    throw new Error('密文不是合法的 Base64')
  }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  let salt = new Uint8Array(0)
  let ciphertext = bytes
  if (bytes.length > MAGIC.length + 8 && MAGIC.every((byte, index) => bytes[index] === byte)) {
    salt = bytes.slice(MAGIC.length, MAGIC.length + 8)
    ciphertext = bytes.slice(MAGIC.length + 8)
  }
  if (!ciphertext.length || ciphertext.length % 16) throw new Error('密文长度无效')
  const { key, iv } = evpBytesToKey(password, salt)
  try {
    const plaintext = cbc(key, iv).decrypt(ciphertext)
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } catch {
    throw new Error('解密失败，请检查密钥')
  }
}
