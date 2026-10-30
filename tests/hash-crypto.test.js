import { beforeAll, describe, expect, it } from 'vitest'
import { createHasher, digestFile, fromBase64, hashText, toBase64, toHex } from '../src/utils/hash.js'
import { aesCrypt, decodeCiphertext, deriveAesKey, encodeCiphertext, parseAesIv } from '../src/utils/aes.js'
import { desCrypt } from '../src/utils/des.js'
import { decryptPassphrase, encryptPassphrase } from '../src/utils/openssl-aes.js'

const hex = bytes => toHex(bytes)

beforeAll(() => {
  // jsdom 26 still lacks Blob.arrayBuffer(); digestFile falls back to FileReader
  // but the chunked path should be exercised with the standard API.
  if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function arrayBuffer() {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(this)
      })
    }
  }
})

describe('hash helpers', () => {
  it('matches published test vectors', () => {
    expect(hashText('MD5', 'abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(hashText('SHA-1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(hashText('SHA-256', 'abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(hashText('SHA-512', 'abc')).toBe('ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f')
  })

  it('supports incremental hashing across chunks', () => {
    const hasher = createHasher('SHA-256')
    hasher.update(new TextEncoder().encode('a'))
    hasher.update(new TextEncoder().encode('bc'))
    expect(toHex(hasher.digest())).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('hashes files chunk by chunk and reports progress', async () => {
    const file = new File([new Uint8Array([104, 101, 108, 108, 111])], 'hello.txt', { type: 'text/plain' })
    const progress = []
    const digest = await digestFile(file, 'SHA-256', { chunkSize: 2, onProgress: (loaded, total) => progress.push([loaded, total]) })
    expect(digest).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    expect(progress).toEqual([[2, 5], [4, 5], [5, 5]])
  })

  it('handles empty files and base64 round trips', async () => {
    expect(await digestFile(new File([], 'empty.txt'), 'MD5')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(toBase64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=')
    expect(new TextDecoder().decode(fromBase64('aGVsbG8='))).toBe('hello')
  })
})

describe('AES helpers', () => {
  it('matches a known AES-256-ECB vector with NoPadding', () => {
    const cipher = aesCrypt(new Uint8Array(16), new Uint8Array(32), { mode: 'ECB', padding: 'NoPadding' })
    expect(hex(cipher)).toBe('dc95c078a2408989ad48a21492842087')
  })

  it('round-trips CBC, ECB, CTR and zero padding', () => {
    const key = deriveAesKey('my secret')
    const iv = parseAesIv('00112233445566778899aabbccddeeff')
    const text = new TextEncoder().encode('hello 世界')
    for (const mode of ['CBC', 'ECB', 'CTR']) {
      const cipher = aesCrypt(text, key, { mode, iv, padding: mode === 'CTR' ? 'NoPadding' : 'Pkcs7' })
      const plain = aesCrypt(cipher, key, { decrypt: true, mode, iv, padding: mode === 'CTR' ? 'NoPadding' : 'Pkcs7' })
      expect(new TextDecoder().decode(plain)).toBe('hello 世界')
    }
    const zero = new TextEncoder().encode('1234567890123456')
    expect(aesCrypt(zero, key, { mode: 'CBC', iv, padding: 'ZeroPadding' }).length).toBe(16)
    expect(aesCrypt(aesCrypt(zero, key, { mode: 'CBC', iv, padding: 'ZeroPadding' }), key, { decrypt: true, mode: 'CBC', iv, padding: 'ZeroPadding' }).length).toBe(16)
  })

  it('encodes ciphertext as base64 and accepts hex on input', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    expect(decodeCiphertext(encodeCiphertext(bytes))).toEqual(bytes)
    expect(decodeCiphertext('01020304')).toEqual(bytes)
    expect(() => decodeCiphertext('')).toThrow(/请输入密文/)
    expect(() => parseAesIv('short')).toThrow(/16 字节/)
  })

  it('rejects invalid key sizes and padding', () => {
    expect(() => aesCrypt(new Uint8Array(16), new Uint8Array(5), {})).toThrow(/密钥/)
    expect(() => aesCrypt(new Uint8Array(15), new Uint8Array(32), { mode: 'ECB', padding: 'NoPadding' })).toThrow(/16 的倍数/)
  })
})

describe('DES helpers', () => {
  it('matches the canonical zero-key vector', () => {
    expect(hex(desCrypt(new Uint8Array(8), new Uint8Array(8), { mode: 'ECB', padding: 'NoPadding' }))).toBe('8ca64de9c1b123a7')
  })

  it('round-trips DES and 3DES with CBC', () => {
    const text = new TextEncoder().encode('hello 世界')
    const iv = new TextEncoder().encode('12345678')
    for (const [triple, key] of [[false, new TextEncoder().encode('8bytekey')], [true, new TextEncoder().encode('0123456789abcdefghijklmn')]]) {
      const cipher = desCrypt(text, key, { mode: 'CBC', iv, triple })
      const plain = desCrypt(cipher, key, { decrypt: true, mode: 'CBC', iv, triple })
      expect(new TextDecoder().decode(plain)).toBe('hello 世界')
    }
  })

  it('rejects bad keys, IVs and padding', () => {
    expect(() => desCrypt(new Uint8Array(8), new Uint8Array(4))).toThrow(/密钥/)
    expect(() => desCrypt(new Uint8Array(8), new Uint8Array(8), { mode: 'CBC' })).toThrow(/IV/)
    expect(() => desCrypt(new Uint8Array(7), new Uint8Array(8), { mode: 'ECB', padding: 'NoPadding' })).toThrow(/8 的倍数/)
  })
})

describe('OpenSSL-compatible passphrase AES', () => {
  it('decrypts a fixture produced by openssl enc -aes-256-cbc -md md5', () => {
    expect(decryptPassphrase('U2FsdGVkX195V7haHCXfVRHRWJWoHRS8jenCSFYxNTo=', 'my-pass')).toBe('hello 世界')
  })

  it('round-trips its own output and rejects a wrong password', () => {
    const payload = encryptPassphrase('secret text', 'correct horse')
    expect(decryptPassphrase(payload, 'correct horse')).toBe('secret text')
    expect(() => decryptPassphrase(payload, 'wrong')).toThrow(/解密失败/)
  })
})

describe('hash error paths', () => {
  it('rejects unknown algorithms and accepts blob-like inputs without slice', async () => {
    expect(() => hashText('SHA-3', 'x')).toThrow(/不支持的哈希算法/)
    expect(() => createHasher('nope')).toThrow(/不支持的哈希算法/)
    const blobLike = { size: 3, arrayBuffer: async () => new Uint8Array([97, 98, 99]).buffer }
    expect(await digestFile(blobLike, 'MD5')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(() => fromBase64('***')).toThrow()
  })
})
