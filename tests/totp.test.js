import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { enhanceFormAccessibility } from '../src/utils/dom.js'
import totp, {
  generateTotp,
  getSecondsRemaining,
  parseTotpInput,
  validateTotp
} from '../src/tools/crypto/totp.js'

const RFC_SECRETS = {
  SHA1: '12345678901234567890',
  SHA256: '12345678901234567890123456789012',
  SHA512: '1234567890123456789012345678901234567890123456789012345678901234'
}

const RFC_VECTORS = {
  SHA1: {
    59: '94287082',
    1111111109: '07081804',
    1111111111: '14050471',
    1234567890: '89005924',
    2000000000: '69279037',
    20000000000: '65353130'
  },
  SHA256: {
    59: '46119246',
    1111111109: '68084774',
    1111111111: '67062674',
    1234567890: '91819424',
    2000000000: '90698825',
    20000000000: '77737706'
  },
  SHA512: {
    59: '90693936',
    1111111109: '25091201',
    1111111111: '99943326',
    1234567890: '93441116',
    2000000000: '38618901',
    20000000000: '47863826'
  }
}

const secretFromAscii = value => OTPAuth.Secret.fromUTF8(value).base32
const inputEvent = () => new Event('input', { bubbles: true })

let root

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_700_000_015_000)
  root = document.createElement('main')
  document.body.replaceChildren(root)
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function controlLabel(control) {
  return [
    ...(control.labels || [])
  ].map(label => label.textContent || '').join(' ')
    .concat(` ${control.getAttribute('aria-label') || ''} ${control.getAttribute('placeholder') || ''}`)
}

function controlMatching(pattern) {
  return [...root.querySelectorAll('input, textarea, select')]
    .find(control => pattern.test(controlLabel(control)))
}

function fieldValues() {
  return [...root.querySelectorAll('input, textarea, select')].map(control => control.value)
}

function selectedChoiceValues() {
  return [...root.querySelectorAll('[role="radio"][aria-checked="true"]')]
    .map(button => button.getAttribute('data-value'))
}

function renderedText() {
  return [...root.querySelectorAll('[role="status"], .inline-result, .error-text, output, .result-box')]
    .map(element => element.textContent || element.value || '')
    .join(' ')
}

function hasRenderedToken(token) {
  return [...root.querySelectorAll('*')].some(element => {
    if (element.matches('input, textarea, select')) return element.value === token
    return element.childElementCount === 0 && element.textContent.trim() === token
  })
}

function setControlValue(control, value) {
  control.value = value
  control.dispatchEvent(inputEvent())
}

function findInvalidToken(config, timestamp) {
  const period = config.period ?? 30
  const digits = config.digits ?? 6
  const blocked = new Set([-1, 0, 1].map(delta => (
    generateTotp(config, timestamp + delta * period * 1000)
  )))
  const limit = 10 ** digits

  for (let value = 0; value < limit; value += 1) {
    const candidate = String(value).padStart(digits, '0')
    if (!blocked.has(candidate)) return candidate
  }

  throw new Error('无法生成确定的无效验证码')
}

describe('TOTP primitives', () => {
  it('matches the RFC 6238 SHA1, SHA256 and SHA512 8-digit vectors', () => {
    for (const [algorithm, expectedBySecond] of Object.entries(RFC_VECTORS)) {
      const config = {
        secret: secretFromAscii(RFC_SECRETS[algorithm]),
        algorithm,
        digits: 8,
        period: 30
      }

      for (const [seconds, expected] of Object.entries(expectedBySecond)) {
        expect(generateTotp(config, Number(seconds) * 1000))
          .toBe(expected)
      }
    }
  })

  it('parses Base32 secrets regardless of case, spacing, hyphens or padding', () => {
    const canonical = secretFromAscii(RFC_SECRETS.SHA256)
    const expected = generateTotp({ secret: canonical }, 59_000)
    const variants = [
      canonical.toLowerCase(),
      `${canonical.slice(0, 4)} ${canonical.slice(4)}`,
      `${canonical.slice(0, 4)}-${canonical.slice(4)}`,
      `${canonical}====`
    ]

    for (const variant of variants) {
      const parsed = parseTotpInput(variant)
      expect(generateTotp(parsed, 59_000)).toBe(expected)
    }
  })

  it('rejects empty and malformed Base32 input', () => {
    for (const invalid of ['', '   ', null, undefined, 'JBSWY3DPEHPK3PX!']) {
      expect(() => parseTotpInput(invalid)).toThrow()
    }
  })

  it('parses TOTP URI metadata and rejects unsupported URI configurations', () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA256)
    const uri = `otpauth://totp/Acme:alice%40example.com?secret=${secret}&issuer=Acme&algorithm=SHA256&digits=8&period=60`
    const parsed = parseTotpInput(uri)

    expect(parsed).toMatchObject({
      issuer: 'Acme',
      account: 'alice@example.com',
      algorithm: 'SHA256',
      digits: 8,
      period: 60
    })
    expect(generateTotp(parsed, 59_000)).toBe(generateTotp({ secret, algorithm: 'SHA256', digits: 8, period: 60 }, 59_000))

    const unsupported = [
      'otpauth://hotp/Acme:alice?secret=JBSWY3DPEHPK3PXP&counter=0',
      'otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP&algorithm=MD5',
      'otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP&digits=7',
      'otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP&period=0',
      'otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP&period=301'
    ]

    for (const invalid of unsupported) {
      expect(() => parseTotpInput(invalid)).toThrow()
    }
  })

  it('applies direct Base32 validation to URI secrets', () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA256)
    const createUri = value => `otpauth://totp/Acme:alice?secret=${encodeURIComponent(value)}`
    const validPadded = `${secret}====`

    expect(parseTotpInput(createUri(validPadded)).secret).toBe(secret)

    for (const invalid of ['A', 'ABC', `${secret}=`, `${secret}===`, `${secret}!`, `${secret}+`]) {
      expect(() => parseTotpInput(createUri(invalid))).toThrow()
    }
  })

  it('preserves URI metadata encoding and rejects ambiguous secret parameters', () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA1)
    const parsed = parseTotpInput(`otpauth://totp/Acme%20Inc:alice?SECRET=${secret}&issuer=Acme%20Inc`)

    expect(parsed).toMatchObject({ secret, issuer: 'Acme Inc', account: 'alice' })
    expect(() => parseTotpInput(`otpauth://totp/Acme:alice?se%63ret=${secret}`)).toThrow()
    expect(() => parseTotpInput(`otpauth://totp/Acme:alice?secret=${secret}+`)).toThrow()
    expect(() => parseTotpInput(`otpauth://totp/Acme:alice?secret=${secret}&SECRET=${secret}`)).toThrow()
    expect(() => parseTotpInput(`otpauth://totp/Acme:alice?secret=${secret}#fragment&secret=MZXW6YTBOI======`)).toThrow()
  })

  it('validates current and adjacent-period tokens, returning null for malformed tokens', () => {
    const config = {
      secret: secretFromAscii(RFC_SECRETS.SHA1),
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    }
    const timestamp = 1_700_000_015_000

    expect(validateTotp(config, generateTotp(config, timestamp), timestamp, 1)).toBe(0)
    expect(validateTotp(config, generateTotp(config, timestamp - 30_000), timestamp, 1)).toBe(-1)
    expect(validateTotp(config, generateTotp(config, timestamp + 30_000), timestamp, 1)).toBe(1)
    expect(validateTotp(config, '12x456', timestamp, 1)).toBeNull()
  })

  it('reports the seconds remaining at period boundaries', () => {
    expect(getSecondsRemaining(0, 30)).toBe(30)
    expect(getSecondsRemaining(29_000, 30)).toBe(1)
    expect(getSecondsRemaining(29_999, 30)).toBe(1)
    expect(getSecondsRemaining(30_000, 30)).toBe(30)
  })
})

describe('TOTP tool UI', () => {
  beforeEach(() => {
    totp.render(root)
    enhanceFormAccessibility(root)
  })

  it('renders an accessible sensitive secret field and toggles its visibility', () => {
    const secretInput = root.querySelector('input[type="password"]')
    expect(secretInput).not.toBeNull()
    expect(secretInput.labels?.length || secretInput.getAttribute('aria-label')).toBeTruthy()

    const showSecret = root.querySelector('input[type="checkbox"]')
    expect(showSecret).not.toBeNull()
    showSecret.click()
    expect(secretInput.type).toBe('text')
    showSecret.click()
    expect(secretInput.type).toBe('password')
  })

  it('shows the current token after a secret is entered', async () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA1)
    const secretInput = root.querySelector('input[type="password"]')
    setControlValue(secretInput, secret)

    const expected = generateTotp({ secret }, Date.now())
    await vi.waitFor(() => expect(hasRenderedToken(expected)).toBe(true))
  })

  it('generates a valid Base32 secret from the random-key action', () => {
    const secretInput = root.querySelector('input[type="password"]')
    const generateButton = [...root.querySelectorAll('button')]
      .find(button => /随机|生成.*密钥|密钥.*生成/i.test(`${button.textContent} ${button.getAttribute('aria-label') || ''}`))
    expect(generateButton).not.toBeNull()

    generateButton.click()

    expect(secretInput.value).toMatch(/^[A-Z2-7]+=*$/)
    expect(() => OTPAuth.Secret.fromBase32(secretInput.value)).not.toThrow()
  })

  it('imports a TOTP URI into the visible configuration controls', async () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA256)
    const uri = `otpauth://totp/Acme:alice%40example.com?secret=${secret}&issuer=Acme&algorithm=SHA256&digits=8&period=60`
    const uriInput = controlMatching(/otpauth|URI|链接|导入/i)
    expect(uriInput).not.toBeNull()

    setControlValue(uriInput, uri)

    await vi.waitFor(() => {
      expect(fieldValues()).toEqual(expect.arrayContaining(['Acme', 'alice@example.com', '60']))
      expect(selectedChoiceValues()).toEqual(expect.arrayContaining(['SHA256', '8']))
    })
  })

  it('keeps imported URI controls editable and regenerates URI metadata', async () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA256)
    const uri = `otpauth://totp/Acme:alice%40example.com?secret=${secret}&issuer=Acme&algorithm=SHA256&digits=8&period=60`
    const uriInput = controlMatching(/otpauth|URI|链接|导入/i)
    const issuerInput = controlMatching(/issuer|服务|发行/i)
    const periodInput = controlMatching(/period|周期/i)
    const uriOutput = root.querySelector('#totp-uri')
    const sha512Button = root.querySelector('[role="radio"][data-value="SHA512"]')

    setControlValue(uriInput, uri)
    await vi.waitFor(() => expect(issuerInput.value).toBe('Acme'))

    setControlValue(issuerInput, 'Renamed')
    sha512Button.click()
    setControlValue(periodInput, '45')

    await vi.waitFor(() => {
      expect(issuerInput.value).toBe('Renamed')
      expect(periodInput.value).toBe('45')
      expect(selectedChoiceValues()).toContain('SHA512')
      expect(uriOutput.value).toContain('issuer=Renamed')
      expect(uriOutput.value).toContain('algorithm=SHA512')
      expect(uriOutput.value).toContain('period=45')
    })
  })

  it('updates the displayed token at the exact Unix period boundary', () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA1)
    const config = { secret, algorithm: 'SHA1', digits: 6, period: 30 }
    const secretInput = root.querySelector('input[type="password"]')
    const before = generateTotp(config, Date.now())
    const after = generateTotp(config, Date.now() + 15_000)

    setControlValue(secretInput, secret)
    expect(hasRenderedToken(before)).toBe(true)

    vi.advanceTimersByTime(14_999)
    expect(hasRenderedToken(before)).toBe(true)
    vi.advanceTimersByTime(1)
    expect(hasRenderedToken(after)).toBe(true)
  })

  it('generates the copied token from the current time at click time', () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA1)
    const config = { secret, algorithm: 'SHA1', digits: 6, period: 30 }
    const secretInput = root.querySelector('input[type="password"]')
    const codeSection = [...root.querySelectorAll('.tool-section')]
      .find(section => section.querySelector('h2')?.textContent.includes('当前验证码'))
    const copyButton = codeSection.querySelector('.btn-icon')

    setControlValue(secretInput, secret)
    const oldToken = generateTotp(config, Date.now())
    let clickTimestamp = Date.now() + config.period * 1000
    let expected = generateTotp(config, clickTimestamp)
    while (expected === oldToken) {
      clickTimestamp += config.period * 1000
      expected = generateTotp(config, clickTimestamp)
    }
    vi.setSystemTime(clickTimestamp)

    copyButton.click()

    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(expected)
  })

  it('resets progress accessibility values when the configuration is cleared', () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA1)
    const secretInput = root.querySelector('input[type="password"]')
    const progress = root.querySelector('.totp-progress')

    setControlValue(secretInput, secret)
    expect(progress.getAttribute('aria-valuetext')).toMatch(/剩余/)

    setControlValue(secretInput, '')

    expect(progress.getAttribute('aria-valuemax')).toBe('30')
    expect(progress.getAttribute('aria-valuenow')).toBe('0')
    expect(progress.hasAttribute('aria-valuetext')).toBe(false)
  })

  it('requests a QR canvas once the secret, issuer and account are complete', async () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA1)
    const secretInput = root.querySelector('input[type="password"]')
    const issuerInput = controlMatching(/issuer|服务|发行/i)
    const accountInput = controlMatching(/account|账户|账号/i)
    expect(issuerInput).not.toBeNull()
    expect(accountInput).not.toBeNull()
    QRCode.toCanvas.mockClear()

    setControlValue(secretInput, secret)
    setControlValue(issuerInput, 'Acme')
    setControlValue(accountInput, 'alice@example.com')

    await vi.waitFor(() => expect(QRCode.toCanvas).toHaveBeenCalled())
    const [canvas, uri] = QRCode.toCanvas.mock.calls.at(-1)
    expect(canvas).toBeInstanceOf(HTMLCanvasElement)
    expect(uri).toContain('otpauth://totp/')
    expect(uri).toContain('issuer=Acme')
  })

  it('reports valid and invalid tokens from the verification action', () => {
    const secret = secretFromAscii(RFC_SECRETS.SHA1)
    const secretInput = root.querySelector('input[type="password"]')
    const tokenInput = controlMatching(/验证码|一次性|动态密码/i)
    const verifyButton = [...root.querySelectorAll('button')]
      .find(button => /校验|验证|检查|validate/i.test(`${button.textContent} ${button.getAttribute('aria-label') || ''}`))
    expect(tokenInput).not.toBeNull()
    expect(verifyButton).not.toBeNull()

    setControlValue(secretInput, secret)
    const token = generateTotp({ secret }, Date.now())
    setControlValue(tokenInput, token)
    verifyButton.click()
    expect(renderedText()).toMatch(/有效|正确|valid/i)

    setControlValue(tokenInput, findInvalidToken({ secret }, Date.now()))
    verifyButton.click()
    expect(renderedText()).toMatch(/无效|错误|invalid/i)
  })
})
