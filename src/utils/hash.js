// Shared hashing helpers built on @noble/hashes.
//
// Keeping one place for algorithm lookup means the hash tools, the file digger,
// UUID v3/v5 and htpasswd all agree on names and hex formatting, and the old
// crypto-js dependency (unmaintained upstream) is no longer needed.
import { md5, sha1 } from '@noble/hashes/legacy.js'
import { sha256, sha512 } from '@noble/hashes/sha2.js'

export const HASH_ALGORITHMS = {
  MD5: { label: 'MD5', hash: md5 },
  'SHA-1': { label: 'SHA-1', hash: sha1 },
  'SHA-256': { label: 'SHA-256', hash: sha256 },
  'SHA-512': { label: 'SHA-512', hash: sha512 }
}

export const HASH_ALGORITHM_NAMES = Object.keys(HASH_ALGORITHMS)

export function toHex(bytes) {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

export function toBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function resolve(name) {
  const entry = HASH_ALGORITHMS[String(name).toUpperCase()] || HASH_ALGORITHMS[String(name)]
  if (!entry) throw new Error(`不支持的哈希算法：${name}`)
  return entry
}

export function createHasher(name) {
  return resolve(name).hash.create()
}

export function hashBytes(name, bytes) {
  return resolve(name).hash(bytes)
}

export function hashText(name, text) {
  return toHex(hashBytes(name, new TextEncoder().encode(String(text ?? ''))))
}

/**
 * Hash a File/Blob incrementally so a multi-gigabyte file never has to be held
 * in memory as one ArrayBuffer. Progress is reported after every chunk.
 */
export async function digestFile(file, algorithm = 'SHA-256', { onProgress, chunkSize = 4 * 1024 * 1024 } = {}) {
  const hasher = createHasher(algorithm)
  const total = Number(file?.size) || 0
  const canSlice = typeof file?.slice === 'function'
  const bufferOf = chunk => (typeof chunk.arrayBuffer === 'function'
    ? chunk.arrayBuffer()
    : new Promise((done, fail) => {
      const reader = new FileReader()
      reader.onload = () => done(reader.result)
      reader.onerror = () => fail(reader.error)
      reader.readAsArrayBuffer(chunk)
    }))

  if (!canSlice) {
    hasher.update(new Uint8Array(await bufferOf(file)))
    onProgress?.(total, total)
    return toHex(hasher.digest())
  }

  let loaded = 0
  while (loaded < total) {
    const end = Math.min(total, loaded + chunkSize)
    const buffer = await bufferOf(file.slice(loaded, end))
    hasher.update(new Uint8Array(buffer))
    loaded = end
    onProgress?.(loaded, total)
  }
  if (total === 0) onProgress?.(0, 0)
  return toHex(hasher.digest())
}
