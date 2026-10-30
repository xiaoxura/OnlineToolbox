// Minimal, dependency-free DES / 3DES implementation.
//
// Only used by the DES tool: it replaces crypto-js (unmaintained upstream) for
// the one algorithm WebCrypto does not provide. Blocks are processed as bit
// arrays, which keeps the table-driven implementation readable; the tool only
// ever encrypts short text, so throughput is not a concern.

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
]

const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
]

const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13,
  12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
]

const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
]

const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4
]

const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
]

const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1]

const SBOXES = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
]

const bytesToBits = bytes => {
  const bits = new Uint8Array(bytes.length * 8)
  for (let index = 0; index < bytes.length; index++) {
    for (let bit = 0; bit < 8; bit++) bits[index * 8 + bit] = (bytes[index] >> (7 - bit)) & 1
  }
  return bits
}

const bitsToBytes = bits => {
  const bytes = new Uint8Array(bits.length / 8)
  for (let index = 0; index < bytes.length; index++) {
    let value = 0
    for (let bit = 0; bit < 8; bit++) value = (value << 1) | bits[index * 8 + bit]
    bytes[index] = value
  }
  return bytes
}

const permute = (bits, table) => Uint8Array.from(table, position => bits[position - 1])

function subkeysOf(key) {
  if (!key || key.length !== 8) throw new Error('DES 密钥必须是 8 字节')
  const cd = permute(bytesToBits(key), PC1)
  const subkeys = []
  for (let round = 0; round < 16; round++) {
    const shift = SHIFTS[round]
    // Rotate the two 28-bit halves independently.
    const rotated = new Uint8Array(56)
    for (let index = 0; index < 28; index++) rotated[index] = cd[(index + shift) % 28]
    for (let index = 0; index < 28; index++) rotated[28 + index] = cd[28 + ((index + shift) % 28)]
    cd.set(rotated)
    subkeys.push(permute(cd, PC2))
  }
  return subkeys
}

function feistel(right, subkey) {
  const expanded = permute(right, E)
  const mixed = Uint8Array.from(expanded, (bit, index) => bit ^ subkey[index])
  const out = new Uint8Array(32)
  for (let box = 0; box < 8; box++) {
    const offset = box * 6
    const row = (mixed[offset] << 1) | mixed[offset + 5]
    const column = (mixed[offset + 1] << 3) | (mixed[offset + 2] << 2) | (mixed[offset + 3] << 1) | mixed[offset + 4]
    const value = SBOXES[box][row * 16 + column]
    out[box * 4] = (value >> 3) & 1
    out[box * 4 + 1] = (value >> 2) & 1
    out[box * 4 + 2] = (value >> 1) & 1
    out[box * 4 + 3] = value & 1
  }
  return permute(out, P)
}

function cryptBlock(block, subkeys) {
  const bits = permute(bytesToBits(block), IP)
  let left = bits.slice(0, 32)
  let right = bits.slice(32)
  for (const subkey of subkeys) {
    const nextRight = Uint8Array.from(left, (bit, index) => bit ^ feistel(right, subkey)[index])
    left = right
    right = nextRight
  }
  const joined = new Uint8Array(64)
  joined.set(right, 0)
  joined.set(left, 32)
  return bitsToBytes(permute(joined, FP))
}

export function desEncryptBlock(block, key) {
  return cryptBlock(block, subkeysOf(key))
}

export function desDecryptBlock(block, key) {
  return cryptBlock(block, subkeysOf(key).reverse())
}

function tripleDesEncryptBlock(block, keys) {
  return desEncryptBlock(desDecryptBlock(desEncryptBlock(block, keys[0]), keys[1]), keys[2])
}

function tripleDesDecryptBlock(block, keys) {
  return desDecryptBlock(desEncryptBlock(desDecryptBlock(block, keys[2]), keys[1]), keys[0])
}

export const PADDINGS = ['Pkcs7', 'ZeroPadding', 'NoPadding']
export const MODES = ['CBC', 'ECB']

export function pad(bytes, padding) {
  const remaining = bytes.length % 8
  if (padding === 'NoPadding') {
    if (remaining) throw new Error('NoPadding 要求数据长度是 8 的倍数')
    return bytes
  }
  if (padding === 'ZeroPadding') {
    if (!remaining) return bytes
    const padded = new Uint8Array(bytes.length + (8 - remaining))
    padded.set(bytes)
    return padded
  }
  const count = 8 - remaining
  const padded = new Uint8Array(bytes.length + count)
  padded.set(bytes)
  padded.fill(count, bytes.length)
  return padded
}

export function unpad(bytes, padding) {
  if (padding === 'NoPadding') return bytes
  if (padding === 'ZeroPadding') {
    let end = bytes.length
    while (end > 0 && bytes[end - 1] === 0) end--
    return bytes.slice(0, end)
  }
  if (!bytes.length) throw new Error('密文为空')
  const count = bytes[bytes.length - 1]
  if (count < 1 || count > 8) throw new Error('PKCS7 填充无效，密钥或 IV 可能不正确')
  for (let index = 0; index < count; index++) {
    if (bytes[bytes.length - 1 - index] !== count) throw new Error('PKCS7 填充无效，密钥或 IV 可能不正确')
  }
  return bytes.slice(0, bytes.length - count)
}

function normalizeKeys(key, triple) {
  if (triple) {
    if (!key || (key.length !== 16 && key.length !== 24)) throw new Error('3DES 密钥必须是 16 或 24 字节')
    return [key.slice(0, 8), key.slice(8, 16), key.length === 24 ? key.slice(16, 24) : key.slice(0, 8)]
  }
  if (!key || key.length !== 8) throw new Error('DES 密钥必须是 8 字节')
  return [key]
}

export function desCrypt(bytes, key, { decrypt = false, triple = false, mode = 'CBC', iv, padding = 'Pkcs7' } = {}) {
  const keys = normalizeKeys(key, triple)
  if (!MODES.includes(mode)) throw new Error(`不支持的模式：${mode}`)
  if (!PADDINGS.includes(padding)) throw new Error(`不支持的填充方式：${padding}`)
  const blockCipher = (block, encrypting) => {
    if (triple) return encrypting ? tripleDesEncryptBlock(block, keys) : tripleDesDecryptBlock(block, keys)
    return encrypting ? desEncryptBlock(block, keys[0]) : desDecryptBlock(block, keys[0])
  }

  if (decrypt) {
    if (!bytes.length || bytes.length % 8) throw new Error('密文长度不是 8 的倍数')
    const output = new Uint8Array(bytes.length)
    let previous = iv ? iv.slice() : null
    for (let offset = 0; offset < bytes.length; offset += 8) {
      const block = bytes.slice(offset, offset + 8)
      const plain = blockCipher(block, false)
      if (mode === 'CBC') {
        if (!previous) throw new Error('CBC 模式解密需要提供 IV')
        for (let index = 0; index < 8; index++) plain[index] ^= previous[index]
        previous = block
      }
      output.set(plain, offset)
    }
    return unpad(output, padding)
  }

  const padded = pad(bytes, padding)
  if (mode === 'CBC' && (!iv || iv.length !== 8)) throw new Error('CBC 模式需要 8 字节 IV')
  const output = new Uint8Array(padded.length)
  let previous = iv ? iv.slice() : null
  for (let offset = 0; offset < padded.length; offset += 8) {
    const block = padded.slice(offset, offset + 8)
    if (mode === 'CBC') for (let index = 0; index < 8; index++) block[index] ^= previous[index]
    const cipher = blockCipher(block, true)
    output.set(cipher, offset)
    if (mode === 'CBC') previous = cipher
  }
  return output
}
