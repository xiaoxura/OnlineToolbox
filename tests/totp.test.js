import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as OTPAuth from 'otpauth'
import { enhanceFormAccessibility } from '../src/utils/dom.js'
import totp, {
  generateTotp,
  getSecondsRemaining,
  parseTotpInput
} from '../src/tools/crypto/totp.js'

// RFC 6238 test secret: ASCII "12345678901234567890" encoded as Base32.
const RFC_SHA1_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
const RFC_SHA256_SECRET = OTPAuth.Secret.fromUTF8('12345678901234567890123456789012').base32
const RFC_SHA512_SECRET = OTPAuth.Secret.fromUTF8('1234567890123456789012345678901234567890123456789012345678901234').base32
const ALTERNATE_SECRET = 'JBSWY3DPEHPK3PXP'
const SHORT_SECRET = 'GEZDGNBVGY'
const PERIOD_START = 1_700_000_010_000

const RFC_SHA1_VECTORS = {
  59: '94287082',
  1111111109: '07081804',
  1111111111: '14050471',
  1234567890: '89005924',
  2000000000: '69279037',
  20000000000: '65353130'
}

let root

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(PERIOD_START + 5_000)
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

function setInputValue(input, value) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function renderTool() {
  totp.render(root)
  enhanceFormAccessibility(root)
}

function secretInput() {
  return root.querySelector('#totp-secret') || root.querySelector('input[type="text"]')
}

function codeElement() {
  return root.querySelector('.totp-code') || root.querySelector('[aria-label="当前验证码"]')
}

function countdownElement() {
  return root.querySelector('.totp-countdown') || root.querySelector('[aria-label*="剩余"]')
}

function submitForm() {
  const form = root.querySelector('form')
  expect(form).not.toBeNull()
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

function renderedCode() {
  return codeElement()?.textContent.trim() || ''
}

describe('TOTP primitives', () => {
  it('matches the RFC 6238 SHA1 8-digit vectors at representative timestamps', () => {
    const config = {
      secret: RFC_SHA1_SECRET,
      algorithm: 'SHA1',
      digits: 8,
      period: 30
    }

    for (const [seconds, expected] of Object.entries(RFC_SHA1_VECTORS)) {
      expect(generateTotp(config, Number(seconds) * 1000)).toBe(expected)
    }
  })

  it('matches the RFC 6238 SHA256 and SHA512 8-digit vectors at 59 seconds', () => {
    const vectors = [
      { algorithm: 'SHA256', secret: RFC_SHA256_SECRET, expected: '46119246' },
      { algorithm: 'SHA512', secret: RFC_SHA512_SECRET, expected: '90693936' }
    ]

    for (const { algorithm, secret, expected } of vectors) {
      expect(generateTotp({ secret, algorithm, digits: 8, period: 30 }, 59_000)).toBe(expected)
    }
  })

  it('accepts OTPAuth.Secret instances in direct generation configs', () => {
    const secret = OTPAuth.Secret.fromUTF8('12345678901234567890')

    expect(generateTotp({ secret, digits: 8 }, 59_000)).toBe(RFC_SHA1_VECTORS[59])
  })

  it('normalizes Base32 case, spaces, hyphens and legal padding', () => {
    const variants = [
      SHORT_SECRET.toLowerCase(),
      `${SHORT_SECRET.slice(0, 4)} ${SHORT_SECRET.slice(4)}`,
      `${SHORT_SECRET.slice(0, 4)}-${SHORT_SECRET.slice(4)}`,
      `${SHORT_SECRET}======`
    ]

    for (const input of variants) {
      expect(parseTotpInput(input)).toEqual({
        secret: SHORT_SECRET,
        algorithm: 'SHA1',
        digits: 6,
        period: 30
      })
    }
  })

  it('rejects empty input, otpauth URIs, invalid characters and invalid length or padding', () => {
    const invalidInputs = [
      '',
      '   ',
      null,
      undefined,
      'otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP',
      'JBSWY3DPEHPK3P!P',
      'JBSWY3DPEHPK3P0P',
      'ABC',
      `${SHORT_SECRET}=`,
      `${SHORT_SECRET}====`,
      `${SHORT_SECRET}=======`
    ]

    for (const input of invalidInputs) {
      expect(() => parseTotpInput(input)).toThrow()
    }
  })

  it('rejects Unicode characters that would expand into Base32 letters when uppercased', () => {
    const invalidInputs = [
      'JBSWY3DPEHPK3Pß',
      'JBSWY3DPEHPK3Pﬀ',
      'JBSWY3DPEHßPK3PXP',
      'JBSWY3DPEHﬀPK3PXP'
    ]

    for (const input of invalidInputs) {
      expect(() => parseTotpInput(input)).toThrow()
    }
  })

  it('reports the seconds remaining at and around period boundaries', () => {
    expect(getSecondsRemaining(0, 30)).toBe(30)
    expect(getSecondsRemaining(1, 30)).toBe(30)
    expect(getSecondsRemaining(29_000, 30)).toBe(1)
    expect(getSecondsRemaining(29_999, 30)).toBe(1)
    expect(getSecondsRemaining(30_000, 30)).toBe(30)
    expect(getSecondsRemaining(60_000, 30)).toBe(30)
  })
})

describe('TOTP tool UI', () => {
  beforeEach(() => {
    renderTool()
  })

  it('renders one accessible Base32 text input and the primary submit action', () => {
    const inputs = [...root.querySelectorAll('input')]
    const input = secretInput()
    const button = [...root.querySelectorAll('button')]
      .find(candidate => candidate.textContent.trim() === '获取验证码')

    expect(inputs).toHaveLength(1)
    expect(input).not.toBeNull()
    expect(input.type).toBe('text')
    expect(input.labels?.length || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby'))
      .toBeTruthy()
    expect(button).not.toBeNull()
    expect(root.querySelector('form')).not.toBeNull()
    expect(root.querySelector('.privacy-notice')).not.toBeNull()
    expect(root.querySelector('input[type="checkbox"], input[type="number"], input[type="radio"], select, textarea'))
      .toBeNull()
  })

  it('does not generate a token while the secret is only being entered', () => {
    const input = secretInput()
    setInputValue(input, RFC_SHA1_SECRET)

    expect(renderedCode()).not.toMatch(/^\d{6}$/)
  })

  it('generates a six-digit token and remaining seconds through form submit', () => {
    const input = secretInput()
    setInputValue(input, RFC_SHA1_SECRET)

    expect(renderedCode()).not.toMatch(/^\d{6}$/)
    submitForm()

    expect(renderedCode()).toBe(generateTotp({ secret: RFC_SHA1_SECRET }, Date.now()))
    expect(renderedCode()).toMatch(/^\d{6}$/)
    expect(countdownElement()).not.toBeNull()
    expect(countdownElement().textContent).toContain(String(getSecondsRemaining(Date.now(), 30)))
  })

  it('refreshes at the exact Unix 30-second boundary after a successful submit', () => {
    vi.setSystemTime(PERIOD_START + 29_000)
    const input = secretInput()
    setInputValue(input, RFC_SHA1_SECRET)
    submitForm()

    const beforeBoundary = generateTotp({ secret: RFC_SHA1_SECRET }, PERIOD_START + 29_000)
    const atBoundary = generateTotp({ secret: RFC_SHA1_SECRET }, PERIOD_START + 30_000)
    expect(renderedCode()).toBe(beforeBoundary)

    vi.advanceTimersByTime(999)
    expect(renderedCode()).toBe(beforeBoundary)
    vi.advanceTimersByTime(1)
    expect(renderedCode()).toBe(atBoundary)
    expect(countdownElement().textContent).toContain('30')
  })

  it('cleans up the scheduled refresh when the container is removed', async () => {
    const input = secretInput()
    setInputValue(input, RFC_SHA1_SECRET)
    submitForm()

    const removedCode = renderedCode()
    expect(removedCode).toMatch(/^\d{6}$/)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    const mutationSettled = new Promise(resolve => {
      const observer = new MutationObserver(() => {
        observer.disconnect()
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    root.remove()
    await mutationSettled

    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(renderedCode()).toBe(removedCode)
  })

  it('clears the old token when the input changes and requires another submit', () => {
    const input = secretInput()
    setInputValue(input, RFC_SHA1_SECRET)
    submitForm()
    expect(renderedCode()).toMatch(/^\d{6}$/)

    setInputValue(input, ALTERNATE_SECRET)
    expect(renderedCode()).not.toMatch(/^\d{6}$/)

    vi.advanceTimersByTime(5_000)
    expect(renderedCode()).not.toMatch(/^\d{6}$/)

    submitForm()
    expect(renderedCode()).toBe(generateTotp({ secret: ALTERNATE_SECRET }, Date.now()))
    expect(renderedCode()).toMatch(/^\d{6}$/)
  })

  it('copies the token generated for the current time at click time', () => {
    const input = secretInput()
    setInputValue(input, RFC_SHA1_SECRET)
    submitForm()

    const copyButton = root.querySelector('.btn-icon')
    expect(copyButton).not.toBeNull()
    expect(copyButton.querySelector('svg')).not.toBeNull()
    expect(copyButton.getAttribute('aria-label') || copyButton.title).toMatch(/复制|copy/i)

    const clickTimestamp = PERIOD_START + 30_000
    vi.setSystemTime(clickTimestamp)
    copyButton.click()

    expect(navigator.clipboard.writeText)
      .toHaveBeenLastCalledWith(generateTotp({ secret: RFC_SHA1_SECRET }, clickTimestamp))
  })

  it('does not expose the removed configuration, URI, QR, validation or progress UI', () => {
    expect(root.querySelector('.totp-progress, [role="progressbar"]')).toBeNull()
    expect(root.querySelector('.totp-uri, .totp-qr-area, .totp-qr-canvas, .totp-validation-result')).toBeNull()
    expect(root.textContent).not.toMatch(/随机密钥|二维码|otpauth|本地校验|校验验证码/i)
  })
})
