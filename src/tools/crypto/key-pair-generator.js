import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'

// Asymmetric key pair generation on top of WebCrypto. Everything happens in the
// browser: the private key never leaves the page.
//
// Export formats:
//   PEM  — SPKI (public) / PKCS#8 (private), base64 wrapped at 64 columns
//   JWK  — the raw JSON Web Key produced by WebCrypto

export const KEY_ALGORITHMS = [
  {
    id: 'RSA-2048',
    name: 'RSA 2048',
    generateAlgorithm: {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    hint: 'RSASSA-PKCS1-v1_5 + SHA-256（JWT RS256 通用），生成约需 1 秒。'
  },
  {
    id: 'RSA-4096',
    name: 'RSA 4096',
    generateAlgorithm: {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    hint: '密钥更长、生成更慢（可能数秒），安全性更高。'
  },
  {
    id: 'ECDSA-P256',
    name: 'ECDSA P-256',
    generateAlgorithm: { name: 'ECDSA', namedCurve: 'P-256' },
    hint: 'secp256r1 / prime256v1，密钥短、生成快，对应 JWT ES256。'
  },
  {
    id: 'ECDSA-P384',
    name: 'ECDSA P-384',
    generateAlgorithm: { name: 'ECDSA', namedCurve: 'P-384' },
    hint: 'secp384r1，安全强度高于 P-256，对应 JWT ES384。'
  },
  {
    id: 'ED25519',
    name: 'Ed25519',
    generateAlgorithm: { name: 'Ed25519' },
    hint: 'EdDSA（Ed25519），速度快、签名短；需要较新的浏览器内核支持。'
  }
]

export const DEFAULT_KEY_ALGORITHM = 'ECDSA-P256'

export const PEM_LABELS = {
  public: 'PUBLIC KEY',
  private: 'PRIVATE KEY'
}

const PEM_LINE_LENGTH = 64

export function findKeyAlgorithm(id) {
  const algorithm = KEY_ALGORITHMS.find(item => item.id === id)
  if (!algorithm) throw new Error(`不支持的密钥算法：${id ?? ''}`)
  return algorithm
}

// Uint8Array/ArrayBuffer → base64. Chunked so a 4096-bit key (or anything
// larger) never blows the argument limit of String.fromCharCode.
export function arrayBufferToBase64(buffer) {
  if (!buffer) throw new Error('缺少要编码的二进制数据')
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

// Wrap a base64 body at `lineLength` columns (PEM requirement).
export function formatPemBody(base64, lineLength = PEM_LINE_LENGTH) {
  if (!Number.isInteger(lineLength) || lineLength < 1) throw new Error('每行字符数必须是正整数')
  const value = String(base64 ?? '').replace(/\s+/g, '')
  const lines = []
  for (let offset = 0; offset < value.length; offset += lineLength) {
    lines.push(value.slice(offset, offset + lineLength))
  }
  return lines.join('\n')
}

export function toPem(buffer, label = PEM_LABELS.public) {
  const body = formatPemBody(arrayBufferToBase64(buffer))
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`
}

// JWK export is not implemented for every algorithm in every engine, so a
// failure here degrades to a readable note instead of failing the generation.
async function exportJwk(key, kind) {
  try {
    return JSON.stringify(await crypto.subtle.exportKey('jwk', key), null, 2)
  } catch {
    return `（当前环境不支持导出${kind} JWK）`
  }
}

export async function generateKeyPair(algorithmId = DEFAULT_KEY_ALGORITHM) {
  const algorithm = findKeyAlgorithm(algorithmId)
  let pair
  try {
    pair = await crypto.subtle.generateKey(algorithm.generateAlgorithm, true, ['sign', 'verify'])
  } catch (cause) {
    throw new Error(`当前环境无法生成 ${algorithm.name} 密钥：${cause instanceof Error ? cause.message : cause}`)
  }

  const [publicDer, privateDer, publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
    exportJwk(pair.publicKey, '公钥'),
    exportJwk(pair.privateKey, '私钥')
  ])

  return {
    id: algorithm.id,
    name: algorithm.name,
    publicKey: {
      pem: toPem(publicDer, PEM_LABELS.public),
      jwk: publicJwk
    },
    privateKey: {
      pem: toPem(privateDer, PEM_LABELS.private),
      jwk: privateJwk
    }
  }
}

export default {
  id: 'key-pair-generator',
  name: '密钥对生成',
  description: '生成 RSA、ECDSA 与 Ed25519 密钥对，导出 PEM 与 JWK',
  category: 'crypto',
  icon: 'password',
  keywords: ['rsa', 'ecdsa', 'ed25519', 'keypair', '密钥', 'pem', 'jwk', 'openssl'],
  render(container) {
    let current = null
    let busy = false

    const algorithmLabel = createElement('label', { className: 'label', textContent: '密钥算法' })
    const algorithmSelect = createElement('select', {
      className: 'select',
      onChange: () => updateAlgorithmHint()
    }, KEY_ALGORITHMS.map(item => createElement('option', { value: item.id, textContent: item.name })))
    algorithmSelect.value = DEFAULT_KEY_ALGORITHM

    const algorithmHint = createElement('div', { className: 'form-hint' })

    const formatGroup = createSegmentedGroup([
      { value: 'pem', label: 'PEM' },
      { value: 'jwk', label: 'JWK' }
    ], () => showKeys())

    const generateButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '生成密钥对',
      onClick: () => run()
    })

    const statusEl = createElement('div', {
      className: 'loading-text',
      role: 'status',
      'aria-live': 'polite'
    })
    const errorEl = createElement('div', { className: 'error-text' })

    const publicOutput = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      readOnly: true,
      placeholder: '公钥将显示在此…',
      spellcheck: false
    })
    const privateOutput = createElement('textarea', {
      className: 'textarea',
      rows: 14,
      readOnly: true,
      placeholder: '私钥将显示在此…',
      spellcheck: false
    })

    function updateAlgorithmHint() {
      algorithmHint.textContent = findKeyAlgorithm(algorithmSelect.value).hint
    }

    function showKeys() {
      if (!current) return
      const format = formatGroup.getValue()
      publicOutput.value = current.publicKey[format]
      privateOutput.value = current.privateKey[format]
    }

    async function run() {
      if (busy) return
      busy = true
      errorEl.textContent = ''
      statusEl.textContent = '正在生成密钥对…'
      generateButton.disabled = true
      try {
        current = await generateKeyPair(algorithmSelect.value)
        showKeys()
        statusEl.textContent = `已生成 ${current.name} 密钥对`
      } catch (cause) {
        current = null
        publicOutput.value = ''
        privateOutput.value = ''
        statusEl.textContent = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      } finally {
        busy = false
        generateButton.disabled = false
      }
    }

    updateAlgorithmHint()

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [algorithmLabel, algorithmSelect, algorithmHint])
      ]),
      createElement('div', { className: 'btn-group' }, [generateButton]),
      statusEl,
      errorEl,
      createSection('导出格式', createElement('div', { className: 'tool-stack' }, [
        formatGroup,
        createElement('p', {
          className: 'form-hint',
          textContent: 'PEM 为 SPKI / PKCS#8 文本，可直接粘贴进 JWT 签发工具或 openssl；JWK 为 JSON Web Key。'
        })
      ])),
      createSection('公钥', publicOutput),
      createSection('私钥', privateOutput),
      createElement('p', {
        className: 'privacy-notice',
        textContent: '密钥对完全在浏览器本地生成，不会上传或保存，刷新页面即消失。'
      })
    )
  }
}
