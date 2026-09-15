import '../../styles/tools/jwt-sign.css'
import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'
import { generateKeyPair } from './key-pair-generator.js'

// JWT (JWS compact serialization) signing and verification on top of WebCrypto.
//
// HMAC algorithms (HS256/HS384/HS512) use a shared secret string; RS256/ES256
// use an asymmetric key pasted as PEM (PKCS#8 private key to sign, SPKI public
// key to verify).
//
// The selected algorithm is authoritative: it is written into the JOSE header
// on sign, and on verify the token header must match the selected algorithm.
// That closes the classic "alg confusion" hole where an attacker re-signs a
// token with a weaker algorithm than the verifier expects.

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8')

export const JWT_ALGORITHMS = ['HS256', 'HS384', 'HS512', 'RS256', 'ES256']

const ALGORITHM_CONFIG = {
  HS256: { family: 'hmac', importAlgorithm: { name: 'HMAC', hash: 'SHA-256' }, signAlgorithm: { name: 'HMAC' } },
  HS384: { family: 'hmac', importAlgorithm: { name: 'HMAC', hash: 'SHA-384' }, signAlgorithm: { name: 'HMAC' } },
  HS512: { family: 'hmac', importAlgorithm: { name: 'HMAC', hash: 'SHA-512' }, signAlgorithm: { name: 'HMAC' } },
  RS256: {
    family: 'rsa',
    importAlgorithm: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    signAlgorithm: { name: 'RSASSA-PKCS1-v1_5' },
    demoKeyAlgorithm: 'RSA-2048'
  },
  ES256: {
    family: 'ecdsa',
    importAlgorithm: { name: 'ECDSA', namedCurve: 'P-256' },
    signAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
    demoKeyAlgorithm: 'ECDSA-P256'
  }
}

// Time claims rendered as human readable timestamps in verify mode.
const TIME_CLAIMS = [
  { claim: 'iat', label: '签发时间 (iat)' },
  { claim: 'nbf', label: '生效时间 (nbf)' },
  { claim: 'exp', label: '过期时间 (exp)' }
]

export function requireAlgorithm(algorithm) {
  const name = String(algorithm ?? '').toUpperCase()
  const config = ALGORITHM_CONFIG[name]
  if (!config) throw new Error(`不支持的算法：${algorithm ?? ''}（可选 ${JWT_ALGORITHMS.join('、')}）`)
  return { name, ...config }
}

export function isHmacAlgorithm(algorithm) {
  return requireAlgorithm(algorithm).family === 'hmac'
}

export function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : new Uint8Array(input)
  let binary = ''
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecodeToBytes(value) {
  const normalized = String(value ?? '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  let binary
  try {
    binary = atob(padded)
  } catch {
    throw new Error('Base64URL 内容无效')
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function base64UrlDecodeToString(value) {
  return textDecoder.decode(base64UrlDecodeToBytes(value))
}

// The BEGIN/END label of a PEM block (e.g. "PRIVATE KEY"); null when the text
// does not look like PEM at all.
export function readPemLabel(pem) {
  const match = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(String(pem ?? ''))
  return match ? match[1].trim() : null
}

export function pemToArrayBuffer(pem) {
  if (typeof pem !== 'string' || !pem.trim()) throw new Error('请输入 PEM 格式的密钥')
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  if (!body) throw new Error('PEM 内容为空，请粘贴完整的密钥文本')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new Error('PEM 内容包含非法字符')
  let binary
  try {
    binary = atob(body)
  } catch {
    throw new Error('PEM 的 Base64 内容无效')
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

export function formatClaimTime(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value)) throw new Error('时间戳必须是数字')
  const date = new Date(value * 1000)
  if (Number.isNaN(date.getTime())) throw new Error('时间戳超出可表示范围')
  const pad = part => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// exp / nbf / iat rendered as readable rows. `now` is injectable so the result
// is deterministic in tests.
export function describeTimeClaims(payload, now = Date.now()) {
  const currentSeconds = Math.floor(now / 1000)
  return TIME_CLAIMS
    .filter(item => payload !== null && typeof payload === 'object' && payload[item.claim] !== undefined)
    .map(item => {
      const value = Number(payload[item.claim])
      const valid = Number.isFinite(value)
      let status = 'ok'
      if (!valid) status = 'invalid'
      else if (item.claim === 'exp' && value <= currentSeconds) status = 'expired'
      else if (item.claim === 'nbf' && value > currentSeconds) status = 'not-yet-valid'
      return {
        claim: item.claim,
        label: item.label,
        seconds: valid ? value : null,
        formatted: valid ? formatClaimTime(value) : '无效的时间值',
        status
      }
    })
}

export const CLAIM_STATUS_TEXT = {
  ok: '正常',
  expired: '已过期',
  'not-yet-valid': '尚未生效',
  invalid: '格式无效'
}

function normalizeJsonObject(value, label) {
  let parsed = value
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) throw new Error(`${label} 不能为空`)
    try {
      parsed = JSON.parse(text)
    } catch (cause) {
      throw new Error(`${label} 不是合法的 JSON：${cause instanceof Error ? cause.message : cause}`)
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 对象`)
  }
  return parsed
}

async function importSigningKey(config, key) {
  if (config.family === 'hmac') {
    if (!String(key ?? '').length) throw new Error('请输入 HMAC 共享密钥')
    return crypto.subtle.importKey('raw', textEncoder.encode(String(key)), config.importAlgorithm, false, ['sign'])
  }
  const label = readPemLabel(key)
  if (label && label.includes('PUBLIC KEY')) {
    throw new Error('签发需要私钥，请粘贴 PKCS#8 私钥 PEM（-----BEGIN PRIVATE KEY-----）')
  }
  const der = pemToArrayBuffer(key)
  try {
    return await crypto.subtle.importKey('pkcs8', der, config.importAlgorithm, false, ['sign'])
  } catch (cause) {
    throw new Error(`无法导入私钥，请确认粘贴的是 PKCS#8 私钥 PEM：${cause instanceof Error ? cause.message : cause}`)
  }
}

async function importVerificationKey(config, key) {
  if (config.family === 'hmac') {
    if (!String(key ?? '').length) throw new Error('请输入 HMAC 共享密钥')
    return crypto.subtle.importKey('raw', textEncoder.encode(String(key)), config.importAlgorithm, false, ['verify'])
  }
  const label = readPemLabel(key)
  if (label && label.includes('PRIVATE KEY')) {
    throw new Error('验签需要公钥，请粘贴 SPKI 公钥 PEM（-----BEGIN PUBLIC KEY-----）')
  }
  const der = pemToArrayBuffer(key)
  try {
    return await crypto.subtle.importKey('spki', der, config.importAlgorithm, false, ['verify'])
  } catch (cause) {
    throw new Error(`无法导入公钥，请确认粘贴的是 SPKI 公钥 PEM：${cause instanceof Error ? cause.message : cause}`)
  }
}

export function decodeJwt(token) {
  const value = String(token ?? '').trim()
  if (!value) throw new Error('请输入 JWT 令牌')
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('JWT 令牌必须由 3 段组成（header.payload.signature）')
  const [headerPart, payloadPart, signaturePart] = parts

  let header
  let payload
  try {
    header = JSON.parse(base64UrlDecodeToString(headerPart))
  } catch {
    throw new Error('无法解析 JWT Header，请确认令牌未被截断')
  }
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadPart))
  } catch {
    throw new Error('无法解析 JWT Payload，请确认令牌未被截断')
  }
  if (header === null || typeof header !== 'object' || Array.isArray(header)) {
    throw new Error('JWT Header 不是合法的 JSON 对象')
  }

  return {
    header,
    payload,
    signature: signaturePart,
    signingInput: `${headerPart}.${payloadPart}`
  }
}

export async function signJwt({ header = {}, payload = {}, algorithm, key } = {}) {
  const config = requireAlgorithm(algorithm)
  // The selected algorithm wins, so the JOSE header always tells the truth
  // about how the token was signed.
  const joseHeader = { ...normalizeJsonObject(header, 'Header'), alg: config.name }
  const claims = normalizeJsonObject(payload, 'Payload')

  const signingInput = `${base64UrlEncode(JSON.stringify(joseHeader))}.${base64UrlEncode(JSON.stringify(claims))}`
  const cryptoKey = await importSigningKey(config, key)
  const signature = await crypto.subtle.sign(config.signAlgorithm, cryptoKey, textEncoder.encode(signingInput))
  return `${signingInput}.${base64UrlEncode(signature)}`
}

export async function verifyJwt({ token, algorithm, key, now = Date.now() } = {}) {
  const config = requireAlgorithm(algorithm)
  const decoded = decodeJwt(token)

  if (decoded.header.alg && decoded.header.alg !== config.name) {
    return {
      ...decoded,
      valid: false,
      signatureValid: false,
      timeChecks: describeTimeClaims(decoded.payload, now),
      reason: `令牌声明的算法是 ${decoded.header.alg}，与所选算法 ${config.name} 不一致`
    }
  }
  if (!decoded.signature) {
    return {
      ...decoded,
      valid: false,
      signatureValid: false,
      timeChecks: describeTimeClaims(decoded.payload, now),
      reason: '令牌没有签名段，无法验签'
    }
  }

  const cryptoKey = await importVerificationKey(config, key)
  const signatureValid = await crypto.subtle.verify(
    config.signAlgorithm,
    cryptoKey,
    base64UrlDecodeToBytes(decoded.signature),
    textEncoder.encode(decoded.signingInput)
  )

  const timeChecks = describeTimeClaims(decoded.payload, now)
  const expired = timeChecks.some(item => item.status === 'expired')
  const notYetValid = timeChecks.some(item => item.status === 'not-yet-valid')

  let reason = ''
  if (!signatureValid) reason = '签名校验失败：密钥不匹配，或令牌内容被篡改'
  else if (expired) reason = '签名有效，但令牌已过期（exp）'
  else if (notYetValid) reason = '签名有效，但令牌尚未生效（nbf）'

  return {
    ...decoded,
    valid: signatureValid && !expired && !notYetValid,
    signatureValid,
    timeChecks,
    reason
  }
}

const DEMO_SECRET = 'toolbox-demo-secret'
// HS256 token for the payload below, expiring 2100-01-01, so the verify sample
// always passes its time checks.
const DEMO_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJvbmxpbmUtdG9vbGJveCIsInN1YiI6InVzZXItMTIzNDUiLCJhdWQiOiJhcGkuZXhhbXBsZS5jb20iLCJpYXQiOjE3MzU2ODk2MDAsImV4cCI6NDEwMjQ0NDgwMH0.dhf-a_G0avkDLYLdKoeJZnhHzQUk-FvbHO4506TjvQs'
function buildPayloadSample() {
  const now = Math.floor(Date.now() / 1000)
  return JSON.stringify({
    iss: 'online-toolbox',
    sub: 'user-12345',
    aud: 'api.example.com',
    iat: now,
    exp: now + 3600
  }, null, 2)
}

function headerSample(algorithm) {
  return JSON.stringify({ alg: algorithm, typ: 'JWT' }, null, 2)
}

function createTextarea(options) {
  return createElement('textarea', { className: 'textarea', spellcheck: 'false', ...options })
}

// A real <label> element (not a styled div) so enhanceFormAccessibility can
// bind it to the select — that is what gives the control its accessible name.
function createKeyRow(labelText, select, hint) {
  return createElement('div', { className: 'form-row' }, [
    createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: labelText }),
      select,
      hint
    ])
  ])
}

export default {
  id: 'jwt-sign',
  name: 'JWT 签发与验签',
  description: '使用 HS256/HS384/HS512 或 RS256/ES256 签发并校验 JWT 令牌',
  category: 'crypto',
  icon: 'jwt',
  keywords: ['jwt', 'jws', 'jose', '签名', '验签', 'hs256', 'rs256', 'es256', '令牌'],
  render(container) {
    // Cached demo material so 「示例数据」 can fill a working sign→verify pair.
    let demoKeys = null
    let lastSigned = null

    const stack = createElement('div', { className: 'tool-stack' })

    const modeGroup = createSegmentedGroup([
      { value: 'sign', label: '签发' },
      { value: 'verify', label: '验签' }
    ], value => {
      signPanel.hidden = value !== 'sign'
      verifyPanel.hidden = value !== 'verify'
    })

    // --- 签发 ---------------------------------------------------------------
    const signAlgorithmSelect = createElement('select', {
      className: 'select',
      onChange: () => {
        syncSignHeader()
        updateSignKeyHint()
      }
    }, JWT_ALGORITHMS.map(item => createElement('option', { value: item, textContent: item })))

    const signAlgorithmHint = createElement('div', { className: 'form-hint' })
    const signHeaderInput = createTextarea({ rows: 5, placeholder: '{"alg":"HS256","typ":"JWT"}' })
    const signPayloadInput = createTextarea({ rows: 10, placeholder: '{"sub":"1234567890"}' })
    const signKeyInput = createTextarea({ rows: 4, placeholder: '请输入共享密钥' })
    const signOutput = createTextarea({ rows: 5, readOnly: true, placeholder: '生成的令牌将显示在此…' })
    const signError = createElement('div', { className: 'error-text' })
    const signStatus = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })

    const signButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '生成令牌',
      onClick: () => runSign()
    })
    const signSampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => fillSignSample()
    })

    function updateSignKeyHint() {
      const algorithm = signAlgorithmSelect.value
      if (isHmacAlgorithm(algorithm)) {
        signAlgorithmHint.textContent = `${algorithm} 使用共享密钥（HMAC），签发与验签必须是同一个密钥字符串。`
        signKeyInput.placeholder = '请输入 HMAC 共享密钥'
      } else {
        signAlgorithmHint.textContent = `${algorithm} 使用非对称密钥，请粘贴 PKCS#8 私钥 PEM；验签时使用配对的 SPKI 公钥 PEM（可用「密钥对生成」工具生成）。`
        signKeyInput.placeholder = '-----BEGIN PRIVATE KEY-----'
      }
    }

    // Keep the visible JOSE header in step with the algorithm picker. A header
    // the user broke on purpose is left untouched — signJwt overrides `alg`
    // anyway, so a stale value can never leak into a token.
    function syncSignHeader() {
      if (!signHeaderInput.value.trim()) return
      try {
        const parsed = JSON.parse(signHeaderInput.value)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return
        signHeaderInput.value = JSON.stringify({ ...parsed, alg: signAlgorithmSelect.value }, null, 2)
      } catch {
        // Leave malformed JSON alone; the user is mid-edit.
      }
    }

    async function fillSignSample() {
      const algorithm = signAlgorithmSelect.value
      signError.textContent = ''
      signHeaderInput.value = headerSample(algorithm)
      signPayloadInput.value = buildPayloadSample()

      if (isHmacAlgorithm(algorithm)) {
        signKeyInput.value = DEMO_SECRET
        return
      }

      signStatus.textContent = '正在生成示例密钥对…'
      try {
        const keyAlgorithm = requireAlgorithm(algorithm).demoKeyAlgorithm
        if (!demoKeys || demoKeys.algorithm !== keyAlgorithm) {
          demoKeys = { algorithm: keyAlgorithm, pair: await generateKeyPair(keyAlgorithm) }
        }
        signKeyInput.value = demoKeys.pair.privateKey.pem
        signStatus.textContent = '已填入示例 RSA/ECDSA 私钥，验签时请使用「示例数据」自动填入配对的公钥。'
      } catch (cause) {
        signKeyInput.value = ''
        signStatus.textContent = ''
        signError.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    async function runSign() {
      signError.textContent = ''
      signStatus.textContent = ''
      signButton.disabled = true
      try {
        const algorithm = signAlgorithmSelect.value
        const token = await signJwt({
          header: signHeaderInput.value,
          payload: signPayloadInput.value,
          algorithm,
          key: signKeyInput.value
        })
        signOutput.value = token
        lastSigned = { token, algorithm, key: signKeyInput.value }
      } catch (cause) {
        signOutput.value = ''
        signError.textContent = cause instanceof Error ? cause.message : String(cause)
      } finally {
        signButton.disabled = false
      }
    }

    const signPanel = createElement('div', { className: 'tool-stack' }, [
      createKeyRow('签名算法', signAlgorithmSelect, signAlgorithmHint),
      createSection('Header（JOSE 头）', signHeaderInput),
      createSection('Payload（载荷声明）', signPayloadInput),
      createSection('密钥', signKeyInput),
      createElement('div', { className: 'btn-group' }, [signButton, signSampleButton]),
      signStatus,
      signError,
      createSection('生成的令牌', signOutput)
    ])

    // --- 验签 ---------------------------------------------------------------
    const verifyAlgorithmSelect = createElement('select', {
      className: 'select',
      onChange: () => updateVerifyKeyHint()
    }, JWT_ALGORITHMS.map(item => createElement('option', { value: item, textContent: item })))

    const verifyAlgorithmHint = createElement('div', { className: 'form-hint' })
    const verifyTokenInput = createTextarea({ rows: 6, placeholder: '粘贴 JWT 令牌（header.payload.signature）' })
    const verifyKeyInput = createTextarea({ rows: 4, placeholder: '请输入共享密钥' })
    const verifyError = createElement('div', { className: 'error-text' })
    const verifyStatus = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })

    const verdictEl = createElement('div', { className: 'jwt-status', hidden: true })
    const claimsBody = createElement('tbody')
    const claimsTable = createElement('table', { className: 'result-table' }, [
      createElement('thead', {}, [
        createElement('tr', {}, [
          createElement('th', { textContent: '声明' }),
          createElement('th', { textContent: '时间' }),
          createElement('th', { textContent: '状态' })
        ])
      ]),
      claimsBody
    ])
    const claimsBox = createElement('div', { className: 'result-box' }, [createTableScroll(claimsTable, '时间声明校验结果')])
    const verdictBox = createElement('div', { className: 'tool-stack' }, [verdictEl, claimsBox])

    const verifyHeaderOutput = createTextarea({ rows: 6, readOnly: true, placeholder: '校验后显示 Header…' })
    const verifyPayloadOutput = createTextarea({ rows: 10, readOnly: true, placeholder: '校验后显示 Payload…' })

    const verifyButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '校验令牌',
      onClick: () => runVerify()
    })
    const verifySampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => fillVerifySample()
    })

    function updateVerifyKeyHint() {
      const algorithm = verifyAlgorithmSelect.value
      if (isHmacAlgorithm(algorithm)) {
        verifyAlgorithmHint.textContent = `${algorithm} 使用共享密钥（HMAC）验签，需与签发方使用完全相同的密钥。`
        verifyKeyInput.placeholder = '请输入 HMAC 共享密钥'
      } else {
        verifyAlgorithmHint.textContent = `${algorithm} 使用 SPKI 公钥 PEM 验签；令牌 Header 中的 alg 必须与所选算法一致。`
        verifyKeyInput.placeholder = '-----BEGIN PUBLIC KEY-----'
      }
    }

    function fillVerifySample() {
      verifyError.textContent = ''
      if (lastSigned) {
        verifyAlgorithmSelect.value = lastSigned.algorithm
        updateVerifyKeyHint()
        verifyTokenInput.value = lastSigned.token
        const publicKey = demoKeys?.pair.publicKey.pem
        // Never wipe a key the user pasted themselves — only overwrite it when
        // a matching public key is actually available.
        if (isHmacAlgorithm(lastSigned.algorithm)) verifyKeyInput.value = lastSigned.key
        else if (publicKey) verifyKeyInput.value = publicKey
        verifyStatus.textContent = (publicKey || isHmacAlgorithm(lastSigned.algorithm))
          ? '已填入本次签发的令牌与配对密钥。'
          : '已填入本次签发的令牌，请粘贴配对的公钥 PEM。'
        return
      }
      verifyAlgorithmSelect.value = 'HS256'
      updateVerifyKeyHint()
      verifyTokenInput.value = DEMO_TOKEN
      verifyKeyInput.value = DEMO_SECRET
      verifyStatus.textContent = '已填入 HS256 示例令牌（exp 为 2100 年）与对应密钥。'
    }

    function resetVerifyResult() {
      verdictEl.textContent = ''
      verdictEl.className = 'jwt-status'
      verdictEl.hidden = true
      claimsBody.replaceChildren()
      claimsBox.hidden = true
      verifyHeaderOutput.value = ''
      verifyPayloadOutput.value = ''
    }

    function showVerifyResult(result) {
      verdictEl.className = `jwt-status ${result.valid ? 'valid' : 'invalid'}`
      verdictEl.hidden = false
      verdictEl.textContent = result.valid
        ? `校验通过：签名有效，算法 ${verifyAlgorithmSelect.value}，时间声明正常`
        : `校验失败：${result.reason}`

      claimsBody.replaceChildren()
      const checks = result.timeChecks.length
        ? result.timeChecks
        : TIME_CLAIMS.map(item => ({
          claim: item.claim,
          label: item.label,
          formatted: '（未设置）',
          status: 'ok'
        }))
      for (const check of checks) {
        claimsBody.appendChild(createElement('tr', {}, [
          createElement('th', { scope: 'row', textContent: check.label }),
          createElement('td', { className: 'code-text', textContent: check.formatted }),
          createElement('td', {
            className: `jwt-claim-status ${check.status}`,
            textContent: CLAIM_STATUS_TEXT[check.status] ?? check.status
          })
        ]))
      }
      claimsBox.hidden = false
      verifyHeaderOutput.value = JSON.stringify(result.header, null, 2)
      verifyPayloadOutput.value = result.payload === undefined ? '' : JSON.stringify(result.payload, null, 2)
    }

    async function runVerify() {
      verifyError.textContent = ''
      verifyStatus.textContent = ''
      resetVerifyResult()
      verifyButton.disabled = true
      try {
        const result = await verifyJwt({
          token: verifyTokenInput.value,
          algorithm: verifyAlgorithmSelect.value,
          key: verifyKeyInput.value
        })
        showVerifyResult(result)
      } catch (cause) {
        verifyError.textContent = cause instanceof Error ? cause.message : String(cause)
      } finally {
        verifyButton.disabled = false
      }
    }

    const verifyPanel = createElement('div', { className: 'tool-stack', hidden: true }, [
      createKeyRow('验签算法', verifyAlgorithmSelect, verifyAlgorithmHint),
      createSection('令牌', verifyTokenInput),
      createSection('密钥', verifyKeyInput),
      createElement('div', { className: 'btn-group' }, [verifyButton, verifySampleButton]),
      verifyStatus,
      verifyError,
      createSection('校验结论', verdictBox),
      createSection('Header', verifyHeaderOutput),
      createSection('Payload', verifyPayloadOutput)
    ])

    // Initial state of both panels.
    updateSignKeyHint()
    updateVerifyKeyHint()
    signHeaderInput.value = headerSample('HS256')
    signPayloadInput.value = buildPayloadSample()
    resetVerifyResult()

    stack.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '模式' }),
          modeGroup
        ])
      ]),
      signPanel,
      verifyPanel,
      createElement('p', {
        className: 'privacy-notice',
        textContent: '令牌与密钥只在浏览器本地处理，不会上传或保存。'
      })
    )
    container.append(stack)
  }
}
