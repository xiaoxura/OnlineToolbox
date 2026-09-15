import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import jwtSign, {
  JWT_ALGORITHMS,
  base64UrlDecodeToBytes,
  base64UrlDecodeToString,
  base64UrlEncode,
  decodeJwt,
  describeTimeClaims,
  formatClaimTime,
  pemToArrayBuffer,
  readPemLabel,
  signJwt,
  verifyJwt
} from '../src/tools/crypto/jwt-sign.js'
import keyPairGenerator, {
  KEY_ALGORITHMS,
  arrayBufferToBase64,
  findKeyAlgorithm,
  formatPemBody,
  generateKeyPair,
  toPem
} from '../src/tools/crypto/key-pair-generator.js'
import morseCode, {
  MORSE_TABLE,
  buildMorseTimeline,
  countUnknownMorseTokens,
  findUnsupportedChars,
  morseToText,
  playMorseTimeline,
  textToMorse
} from '../src/tools/encoding/morse-code.js'
import {
  applyTwoColumnLayout,
  enhanceFormAccessibility,
  enhanceResultSections
} from '../src/utils/dom.js'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Mirrors the app's render pipeline (src/main.js) and then re-checks the rules
// tests/tools-smoke.test.js enforces, so a violation shows up in this file too.
function mount(tool) {
  tool.render(root)
  applyTwoColumnLayout(root)
  enhanceFormAccessibility(root)
  enhanceResultSections(root, { toolName: tool.id })
  return root
}

function expectToolContract(id) {
  expect(root.childElementCount).toBeGreaterThan(0)
  for (const control of root.querySelectorAll('input, textarea, select')) {
    const hasName = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
    expect(Boolean(hasName), `${id}: unnamed ${control.tagName}`).toBe(true)
  }
  expect(root.querySelector('select.input'), `${id}: select uses text-input styling`).toBeNull()
  expect(root.querySelector('button[class="btn"]'), `${id}: button has no visual variant`).toBeNull()
  for (const choice of root.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
    expect(choice.closest('label'), `${id}: choice is not wrapped by a label`).not.toBeNull()
  }
  expect(root.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box')).toBeNull()
  for (const table of root.querySelectorAll('table.result-table')) {
    expect(table.parentElement?.classList.contains('table-scroll'), `${id}: result table is not scrollable`).toBe(true)
  }
  for (const group of root.querySelectorAll('[role="radiogroup"]')) {
    expect(group.querySelectorAll('[role="radio"][aria-checked="true"]'), `${id}: invalid segmented state`).toHaveLength(1)
  }
}

function buttonByText(label) {
  return [...root.querySelectorAll('button')].filter(button => button.textContent.trim() === label)
}

function editableTextareas() {
  return [...root.querySelectorAll('textarea:not([readonly])')]
}

// 签发面板的三个可编辑字段（Header / Payload / 密钥）。
function signMaterial() {
  const [header, payload, key] = editableTextareas()
  return { header, payload, key }
}

function readonlyTextareas() {
  return [...root.querySelectorAll('textarea[readonly]')]
}

describe('JWT 签发与验签：编码工具函数', () => {
  it('encodes and decodes base64url without padding or unsafe characters', () => {
    expect(base64UrlEncode('hello')).toBe('aGVsbG8')
    expect(base64UrlEncode('中文 ok')).not.toMatch(/[+/=]/)
    expect(base64UrlDecodeToString(base64UrlEncode('中文 ok'))).toBe('中文 ok')

    const bytes = new Uint8Array([0, 1, 250, 255, 62, 63])
    expect(base64UrlEncode(bytes)).not.toMatch(/[+/=]/)
    expect([...base64UrlDecodeToBytes(base64UrlEncode(bytes))]).toEqual([0, 1, 250, 255, 62, 63])
    expect(base64UrlDecodeToString(base64UrlEncode('a'))).toBe('a')
  })

  it('reads PEM labels and converts PEM bodies back to bytes', () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer
    const pem = toPem(buffer, 'PUBLIC KEY')
    expect(readPemLabel(pem)).toBe('PUBLIC KEY')
    expect(pem).toBe('-----BEGIN PUBLIC KEY-----\nAQIDBA==\n-----END PUBLIC KEY-----')
    expect([...new Uint8Array(pemToArrayBuffer(pem))]).toEqual([1, 2, 3, 4])
    expect(readPemLabel('not a pem')).toBeNull()
    expect(() => pemToArrayBuffer('')).toThrow(/PEM/)
    expect(() => pemToArrayBuffer('-----BEGIN PUBLIC KEY-----\n@@@@\n-----END PUBLIC KEY-----')).toThrow(/非法字符/)
  })

  it('formats time claims and flags expired / not-yet-valid ones', () => {
    const formatted = formatClaimTime(1700000000)
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    const [datePart, timePart] = formatted.split(' ')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hour, minute, second] = timePart.split(':').map(Number)
    expect(new Date(year, month - 1, day, hour, minute, second).getTime()).toBe(1700000000 * 1000)
    expect(() => formatClaimTime('abc')).toThrow()

    const checks = describeTimeClaims(
      { iat: 1699999000, exp: 1699999999, nbf: 1700000100, iss: 'x' },
      1700000000 * 1000
    )
    expect(checks.map(check => [check.claim, check.status])).toEqual([
      ['iat', 'ok'],
      ['nbf', 'not-yet-valid'],
      ['exp', 'expired']
    ])
    expect(describeTimeClaims({ iss: 'x' }, 0)).toEqual([])
  })

  it('rejects malformed input with readable errors', async () => {
    expect(() => decodeJwt('')).toThrow(/请输入 JWT 令牌/)
    expect(() => decodeJwt('abc.def')).toThrow(/3 段/)
    expect(() => decodeJwt('@@@.@@@.@@@')).toThrow(/Header/)
    await expect(signJwt({ header: {}, payload: {}, algorithm: 'none', key: 'k' })).rejects.toThrow(/不支持的算法/)
    await expect(signJwt({ header: {}, payload: 'not json', algorithm: 'HS256', key: 'k' })).rejects.toThrow(/JSON/)
    await expect(signJwt({ header: [], payload: {}, algorithm: 'HS256', key: 'k' })).rejects.toThrow(/JSON 对象/)
    await expect(signJwt({ header: {}, payload: {}, algorithm: 'HS256', key: '' })).rejects.toThrow(/共享密钥/)
  })
})

describe('JWT 签发与验签：HMAC', () => {
  const SECRET = 'unit-test-secret'

  it('signs a token whose JOSE header always matches the selected algorithm', async () => {
    const token = await signJwt({
      header: { typ: 'JWT', alg: 'HS512' },
      payload: { sub: 'abc', role: 'admin' },
      algorithm: 'HS256',
      key: SECRET
    })

    expect(token.split('.')).toHaveLength(3)
    const decoded = decodeJwt(token)
    expect(decoded.header).toEqual({ typ: 'JWT', alg: 'HS256' })
    expect(decoded.payload).toEqual({ sub: 'abc', role: 'admin' })
    expect(decoded.signingInput).toBe(token.split('.').slice(0, 2).join('.'))
  })

  it('verifies a valid token and reports a wrong key or a tampered token', async () => {
    const token = await signJwt({ header: {}, payload: { sub: 'abc' }, algorithm: 'HS256', key: SECRET })

    const valid = await verifyJwt({ token, algorithm: 'HS256', key: SECRET })
    expect(valid.valid).toBe(true)
    expect(valid.signatureValid).toBe(true)
    expect(valid.reason).toBe('')

    const wrongKey = await verifyJwt({ token, algorithm: 'HS256', key: `${SECRET}2` })
    expect(wrongKey.valid).toBe(false)
    expect(wrongKey.signatureValid).toBe(false)
    expect(wrongKey.reason).toMatch(/签名/)

    const [header, payload, signature] = token.split('.')
    const tamperedPayload = `${header}.${base64UrlEncode('{"sub":"hacked"}')}.${signature}`
    const tampered = await verifyJwt({ token: tamperedPayload, algorithm: 'HS256', key: SECRET })
    expect(tampered.valid).toBe(false)
    expect(tampered.payload).toEqual({ sub: 'hacked' })

    const flipped = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`
    await expect(verifyJwt({ token: flipped, algorithm: 'HS256', key: SECRET })).resolves.toMatchObject({ valid: false })
  })

  it('refuses a token signed with another algorithm (alg confusion)', async () => {
    const token = await signJwt({ header: {}, payload: { sub: 'abc' }, algorithm: 'HS256', key: SECRET })
    const result = await verifyJwt({ token, algorithm: 'HS512', key: SECRET })
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/算法/)
  })

  it('reports expired and not-yet-valid tokens while keeping the signature verdict', async () => {
    const expired = await signJwt({
      header: {},
      payload: { exp: 1700000000 },
      algorithm: 'HS256',
      key: SECRET
    })
    const expiredResult = await verifyJwt({ token: expired, algorithm: 'HS256', key: SECRET, now: 1700000500000 })
    expect(expiredResult.signatureValid).toBe(true)
    expect(expiredResult.valid).toBe(false)
    expect(expiredResult.reason).toMatch(/过期/)

    const early = await signJwt({
      header: {},
      payload: { nbf: 1700000000 },
      algorithm: 'HS256',
      key: SECRET
    })
    const earlyResult = await verifyJwt({ token: early, algorithm: 'HS256', key: SECRET, now: 1699999000000 })
    expect(earlyResult.signatureValid).toBe(true)
    expect(earlyResult.valid).toBe(false)
    expect(earlyResult.reason).toMatch(/尚未生效/)

    const unsigned = `${expired.split('.').slice(0, 2).join('.')}.`
    const unsignedResult = await verifyJwt({ token: unsigned, algorithm: 'HS256', key: SECRET })
    expect(unsignedResult.valid).toBe(false)
    expect(unsignedResult.reason).toMatch(/没有签名/)
  })
})

describe('JWT 签发与验签：RSA / ECDSA', () => {
  it('signs and verifies RS256 with a generated key pair', async () => {
    const pair = await generateKeyPair('RSA-2048')
    const token = await signJwt({
      header: { typ: 'JWT' },
      payload: { sub: 'rsa-user' },
      algorithm: 'RS256',
      key: pair.privateKey.pem
    })

    const result = await verifyJwt({ token, algorithm: 'RS256', key: pair.publicKey.pem })
    expect(result.valid).toBe(true)
    expect(result.header.alg).toBe('RS256')
    expect(result.payload).toEqual({ sub: 'rsa-user' })

    await expect(verifyJwt({ token, algorithm: 'RS256', key: pair.privateKey.pem })).rejects.toThrow(/公钥/)
    await expect(signJwt({ header: {}, payload: {}, algorithm: 'RS256', key: pair.publicKey.pem })).rejects.toThrow(/私钥/)

    const otherPair = await generateKeyPair('RSA-2048')
    const wrongKey = await verifyJwt({ token, algorithm: 'RS256', key: otherPair.publicKey.pem })
    expect(wrongKey.valid).toBe(false)
  })

  it('produces a JWS-shaped ES256 signature', async () => {
    const pair = await generateKeyPair('ECDSA-P256')
    const token = await signJwt({
      header: { typ: 'JWT' },
      payload: { sub: 'ec-user' },
      algorithm: 'ES256',
      key: pair.privateKey.pem
    })

    // JWS ES256 requires the raw r||s form (64 bytes), which is exactly what
    // WebCrypto returns — a DER signature would break every other verifier.
    expect(base64UrlDecodeToBytes(token.split('.')[2])).toHaveLength(64)

    const result = await verifyJwt({ token, algorithm: 'ES256', key: pair.publicKey.pem })
    expect(result.valid).toBe(true)

    const tampered = await verifyJwt({
      token: `${token.split('.').slice(0, 2).join('.')}.${base64UrlEncode(new Uint8Array(64))}`,
      algorithm: 'ES256',
      key: pair.publicKey.pem
    })
    expect(tampered.valid).toBe(false)
  })

  it('lists the supported JWT algorithms', () => {
    expect(JWT_ALGORITHMS).toEqual(['HS256', 'HS384', 'HS512', 'RS256', 'ES256'])
  })
})

describe('密钥对生成', () => {
  it('wraps base64 bodies at 64 columns', () => {
    expect(formatPemBody('A'.repeat(130))).toBe(`${'A'.repeat(64)}\n${'A'.repeat(64)}\nAA`)
    expect(formatPemBody(' A A\nA ')).toBe('AAA')
    expect(formatPemBody('')).toBe('')
    expect(() => formatPemBody('AAA', 0)).toThrow(/正整数/)

    expect(arrayBufferToBase64(new Uint8Array([104, 105]).buffer)).toBe('aGk=')
    const pem = toPem(new Uint8Array(100).buffer, 'PRIVATE KEY')
    const lines = pem.split('\n')
    expect(lines[0]).toBe('-----BEGIN PRIVATE KEY-----')
    expect(lines.at(-1)).toBe('-----END PRIVATE KEY-----')
    expect(lines.slice(1, -1).every(line => line.length <= 64)).toBe(true)
  })

  it('generates EC and Ed25519 key pairs in PEM and JWK', async () => {
    const pair = await generateKeyPair('ECDSA-P256')
    expect(pair.id).toBe('ECDSA-P256')
    expect(pair.publicKey.pem.startsWith('-----BEGIN PUBLIC KEY-----')).toBe(true)
    expect(pair.privateKey.pem.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true)
    // The exported PEM must be importable again (round trip through WebCrypto).
    expect(new Uint8Array(pemToArrayBuffer(pair.publicKey.pem)).length).toBeGreaterThan(0)
    expect(JSON.parse(pair.publicKey.jwk)).toMatchObject({ kty: 'EC', crv: 'P-256' })
    expect(JSON.parse(pair.privateKey.jwk).d).toBeTruthy()

    try {
      const ed = await generateKeyPair('ED25519')
      expect(ed.publicKey.pem).toContain('BEGIN PUBLIC KEY')
      expect(JSON.parse(ed.privateKey.jwk).kty).toBe('OKP')
    } catch (error) {
      // Environments without Ed25519 must fail with a clear Chinese message.
      expect(error.message).toMatch(/Ed25519/)
    }
  })

  it('validates the requested algorithm', async () => {
    expect(findKeyAlgorithm('ECDSA-P384').name).toBe('ECDSA P-384')
    expect(KEY_ALGORITHMS.map(item => item.id)).toContain('RSA-4096')
    expect(() => findKeyAlgorithm('DSA-1024')).toThrow(/不支持的密钥算法/)
    await expect(generateKeyPair('DSA-1024')).rejects.toThrow(/不支持的密钥算法/)
  })
})

describe('摩尔斯电码', () => {
  it('exposes the ITU table for letters, digits and punctuation', () => {
    expect(MORSE_TABLE.S).toBe('...')
    expect(MORSE_TABLE.O).toBe('---')
    expect(MORSE_TABLE['0']).toBe('-----')
    expect(MORSE_TABLE['9']).toBe('----.')
    expect(MORSE_TABLE['.']).toBe('.-.-.-')
    expect(MORSE_TABLE['@']).toBe('.--.-.')
    expect(MORSE_TABLE['?']).toBe('..--..')
    expect(Object.keys(MORSE_TABLE)).toHaveLength(26 + 10 + 18)
  })

  it('encodes text case-insensitively with configurable separators', () => {
    expect(textToMorse('SOS')).toBe('... --- ...')
    expect(textToMorse('sos hello')).toBe('... --- ... / .... . .-.. .-.. ---')
    expect(textToMorse('2026')).toBe('..--- ----- ..--- -....')
    expect(textToMorse('a\nb')).toBe('.- / -...')
    expect(textToMorse('')).toBe('')
    expect(textToMorse('SOS', { letterSeparator: '|', wordSeparator: '//' })).toBe('...|---|...')
    expect(textToMorse('SOS OK', { letterSeparator: '|', wordSeparator: '//' })).toBe('...|---|...//---|-.-')
  })

  it('drops unknown characters and reports them', () => {
    expect(textToMorse('中文')).toBe('')
    expect(textToMorse('SOS 中文 2026')).toBe('... --- ... / ..--- ----- ..--- -....')
    expect(findUnsupportedChars('SOS 中文 ok')).toEqual(['中', '文'])
    expect(findUnsupportedChars('SOS 2026')).toEqual([])
    expect(findUnsupportedChars('café')).toEqual(['é'])
    expect(textToMorse('é', { unknown: 'keep' })).toBe('é')
  })

  it('decodes words, letters and unknown tokens', () => {
    expect(morseToText('... --- ...')).toBe('SOS')
    expect(morseToText('.... . .-.. .-.. --- / .-- --- .-. .-.. -..')).toBe('HELLO WORLD')
    expect(morseToText('.... . .-.. .-.. ---\n.-- --- .-. .-.. -..')).toBe('HELLO WORLD')
    expect(morseToText('')).toBe('')
    expect(morseToText('..--..')).toBe('?')
    expect(morseToText('... ......... ---')).toBe('S?O')
    expect(morseToText('...|---|...', { letterSeparator: '|' })).toBe('SOS')
    expect(morseToText(textToMorse('SOS HELLO WORLD 2026'))).toBe('SOS HELLO WORLD 2026')
  })

  it('counts unrecognised morse tokens without confusing a decoded "?"', () => {
    expect(countUnknownMorseTokens('... ......... ---')).toBe(1)
    expect(countUnknownMorseTokens('..--..')).toBe(0)
    expect(countUnknownMorseTokens('')).toBe(0)
  })

  it('lays out the playback timeline with ITU timing', () => {
    expect(buildMorseTimeline('', { unit: 10 })).toEqual([])
    expect(buildMorseTimeline('-', { unit: 10 })).toEqual([{ tone: true, start: 0, duration: 30 }])
    expect(buildMorseTimeline('...', { unit: 10 })).toEqual([
      { tone: true, start: 0, duration: 10 },
      { tone: false, start: 10, duration: 10 },
      { tone: true, start: 20, duration: 10 },
      { tone: false, start: 30, duration: 10 },
      { tone: true, start: 40, duration: 10 }
    ])

    const timeline = buildMorseTimeline('... / ...', { unit: 10 })
    expect(timeline[4]).toEqual({ tone: true, start: 40, duration: 10 })
    expect(timeline[5]).toEqual({ tone: false, start: 50, duration: 70 })
    expect(timeline[6]).toEqual({ tone: true, start: 120, duration: 10 })

    const letterTimeline = buildMorseTimeline('.. .', { unit: 10 })
    expect(letterTimeline.at(-2)).toEqual({ tone: false, start: 30, duration: 30 })
  })

  it('no-ops gracefully when Web Audio is unavailable or broken', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    expect(playMorseTimeline(buildMorseTimeline('SOS'))).toBeNull()
    expect(playMorseTimeline([])).toBeNull()

    vi.stubGlobal('AudioContext', class {
      constructor() {
        throw new Error('audio device unavailable')
      }
    })
    expect(playMorseTimeline(buildMorseTimeline('SOS'))).toBeNull()
  })

  it('schedules a tone per dot and dash when Web Audio is present', () => {
    const ramps = []
    let lastGain = null
    class FakeAudioContext {
      constructor() {
        this.currentTime = 0
        this.destination = {}
        this.closed = false
      }

      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
      }

      createGain() {
        lastGain = {
          gain: {
            setValueAtTime: (value, at) => ramps.push(['set', value, at]),
            linearRampToValueAtTime: (value, at) => ramps.push(['ramp', value, at])
          },
          connect: vi.fn()
        }
        return lastGain
      }

      resume() {
        return Promise.resolve()
      }

      close() {
        this.closed = true
      }
    }

    vi.stubGlobal('AudioContext', FakeAudioContext)
    const context = playMorseTimeline(buildMorseTimeline('.-', { unit: 100 }))
    expect(context).toBeInstanceOf(FakeAudioContext)
    expect(lastGain).not.toBeNull()
    // One ramp up + one ramp down per tone (dot + dash).
    expect(ramps.filter(entry => entry[0] === 'ramp')).toHaveLength(4)
    expect(ramps.some(entry => entry[1] === 0.22)).toBe(true)
  })
})

describe('新工具 DOM 行为', () => {
  it('renders the JWT tool, signs and verifies through the UI', async () => {
    mount(jwtSign)
    expectToolContract('jwt-sign')
    // The tool owns its layout: the mode panels must not be split into columns.
    expect(root.dataset.ioLayout).toBeUndefined()

    expect(root.querySelector('.segmented-group [aria-checked="true"]').textContent).toBe('签发')
    const { header, payload, key } = signMaterial()
    expect(JSON.parse(header.value)).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(JSON.parse(payload.value)).toHaveProperty('exp')

    buttonByText('示例数据')[0].click()
    expect(key.value).toBe('toolbox-demo-secret')

    const [signOutput] = readonlyTextareas()
    signOutput.value = ''
    buttonByText('生成令牌')[0].click()
    await vi.waitFor(() => expect(signOutput.value.split('.')).toHaveLength(3))

    // Switching the algorithm keeps the visible JOSE header in step.
    const algorithmSelect = root.querySelector('select')
    algorithmSelect.value = 'HS384'
    algorithmSelect.dispatchEvent(new Event('change'))
    expect(JSON.parse(header.value).alg).toBe('HS384')

    // 验签：the sample button reuses the token that was just signed.
    root.querySelector('.segmented-btn[data-value="verify"]').click()
    expect(root.querySelector('.segmented-group [aria-checked="true"]').textContent).toBe('验签')
    buttonByText('示例数据')[1].click()
    buttonByText('校验令牌')[0].click()

    await vi.waitFor(() => expect(root.querySelector('.jwt-status.valid')).not.toBeNull())
    expect(root.querySelector('.jwt-status').textContent).toContain('校验通过')
    expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(2)
    expect(root.querySelector('.jwt-claim-status.ok')).not.toBeNull()
    const decoded = readonlyTextareas().slice(1)
    expect(JSON.parse(decoded[0].value).alg).toBe('HS256')
    expect(JSON.parse(decoded[1].value)).toHaveProperty('sub', 'user-12345')
  })

  it('signs and verifies RS256 with the generated demo key pair', async () => {
    mount(jwtSign)
    const algorithmSelect = root.querySelector('select')
    algorithmSelect.value = 'RS256'
    algorithmSelect.dispatchEvent(new Event('change'))
    expect(JSON.parse(signMaterial().header.value).alg).toBe('RS256')

    // 「示例数据」must also fill a usable key for the asymmetric algorithms.
    buttonByText('示例数据')[0].click()
    const { key } = signMaterial()
    await vi.waitFor(() => expect(key.value).toContain('-----BEGIN PRIVATE KEY-----'), { timeout: 20000 })

    buttonByText('生成令牌')[0].click()
    const signOutput = readonlyTextareas()[0]
    await vi.waitFor(() => expect(signOutput.value.split('.')).toHaveLength(3))
    expect(decodeJwt(signOutput.value).header.alg).toBe('RS256')

    root.querySelector('.segmented-btn[data-value="verify"]').click()
    buttonByText('示例数据')[1].click()
    expect(editableTextareas()[4].value).toContain('-----BEGIN PUBLIC KEY-----')

    buttonByText('校验令牌')[0].click()
    await vi.waitFor(() => expect(root.querySelector('.jwt-status.valid')).not.toBeNull())
    expect(root.querySelector('.jwt-status').textContent).toContain('校验通过')
  }, 30000)

  it('shows a failed verification with a readable reason', async () => {
    mount(jwtSign)
    root.querySelector('.segmented-btn[data-value="verify"]').click()
    buttonByText('示例数据')[1].click()

    // 验签面板的字段排在签发面板之后：token 第 4 个、密钥第 5 个。
    const verifyKeyInput = editableTextareas()[4]
    const verifyError = root.querySelectorAll('.error-text')[1]

    verifyKeyInput.value = 'wrong-secret'
    buttonByText('校验令牌')[0].click()
    await vi.waitFor(() => expect(root.querySelector('.jwt-status.invalid')).not.toBeNull())
    expect(root.querySelector('.jwt-status').textContent).toContain('校验失败')
    expect(root.querySelector('.jwt-status').textContent).toContain('签名')
    // The payload is still decoded, so the user can inspect a rejected token.
    expect(JSON.parse(readonlyTextareas()[2].value)).toHaveProperty('iss', 'online-toolbox')

    verifyKeyInput.value = ''
    buttonByText('校验令牌')[0].click()
    await vi.waitFor(() => expect(verifyError.textContent).toContain('共享密钥'))
  })

  it('renders the key pair generator, generates and switches export format', async () => {
    mount(keyPairGenerator)
    expectToolContract('key-pair-generator')
    expect(root.querySelector('.segmented-group [aria-checked="true"]').textContent).toBe('PEM')

    const [publicOutput, privateOutput] = readonlyTextareas()
    expect(publicOutput.value).toBe('')

    root.querySelector('select').value = 'ECDSA-P256'
    root.querySelector('.btn-primary').click()
    await vi.waitFor(() => expect(publicOutput.value).toContain('-----BEGIN PUBLIC KEY-----'))
    expect(privateOutput.value).toContain('-----BEGIN PRIVATE KEY-----')
    expect(root.querySelector('.loading-text').textContent).toContain('ECDSA P-256')

    root.querySelector('.segmented-btn[data-value="jwk"]').click()
    expect(JSON.parse(publicOutput.value)).toMatchObject({ kty: 'EC', crv: 'P-256' })
    expect(JSON.parse(privateOutput.value).kty).toBe('EC')

    root.querySelector('.segmented-btn[data-value="pem"]').click()
    expect(publicOutput.value).toContain('-----BEGIN PUBLIC KEY-----')
  })

  it('renders the morse tool and converts in both directions', () => {
    mount(morseCode)
    expectToolContract('morse-code')
    // This tool is an input → output pair, so the shared split layout applies.
    expect(root.dataset.ioLayout).toBe('split')

    const input = root.querySelector('textarea:not([readonly])')
    const output = root.querySelector('textarea[readonly]')

    input.value = 'SOS'
    buttonByText('转换')[0].click()
    expect(output.value).toBe('... --- ...')

    input.value = '中文'
    buttonByText('转换')[0].click()
    expect(output.value).toBe('')
    expect(root.querySelector('.form-hint-warn').textContent).toContain('没有摩尔斯编码')

    root.querySelector('.segmented-btn[data-value="decode"]').click()
    input.value = '.... . .-.. .-.. --- / .-- --- .-. .-.. -..'
    buttonByText('转换')[0].click()
    expect(output.value).toBe('HELLO WORLD')

    input.value = '.........'
    buttonByText('转换')[0].click()
    expect(output.value).toBe('?')
    expect(root.querySelector('.form-hint-warn').textContent).toContain('无法识别')

    // Sample button and audio playback must both work without Web Audio.
    buttonByText('示例数据')[0].click()
    expect(input.value).toBe('... --- ... / .... . .-.. .-.. --- / .-- --- .-. .-.. -.. / ..--- ----- ..--- -....')
    expect(output.value).toBe('SOS HELLO WORLD 2026')
    expect(() => buttonByText('播放音频')[0].click()).not.toThrow()
  })

  it('applies custom separators from the options row', () => {
    mount(morseCode)
    const [letterSeparator, wordSeparator] = root.querySelectorAll('.form-row input[type="text"]')
    expect(letterSeparator.labels.length).toBe(1)
    expect(wordSeparator.labels.length).toBe(1)

    letterSeparator.value = '|'
    wordSeparator.value = '//'
    const input = root.querySelector('textarea:not([readonly])')
    const output = root.querySelector('textarea[readonly]')

    input.value = 'SOS OK'
    buttonByText('转换')[0].click()
    expect(output.value).toBe('...|---|...//---|-.-')

    root.querySelector('.segmented-btn[data-value="decode"]').click()
    input.value = '...|---|...'
    buttonByText('转换')[0].click()
    expect(output.value).toBe('SOS')
  })
})
