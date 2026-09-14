import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  mountTool,
  editableTextareas,
  outputValue,
  setValue,
  clickText,
  clickPrimary,
  errorText
} from '../helpers/tool-harness.js'

// jsdom 26 still lacks Blob/File.arrayBuffer(), which file-hash relies on.
// Polyfill it (test-side only) via FileReader so the digest logic is exercised.
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

afterEach(() => {
  document.body.replaceChildren()
})

function textInputs(container) {
  return [...container.querySelectorAll('input.input')]
}

async function waitForOutput(container, expected) {
  await vi.waitFor(() => {
    expect(outputValue(container)).toBe(expected)
  })
}

describe('encoding tools', () => {
  it('base64 encodes and decodes UTF-8 text', async () => {
    const c = await mountTool('base64')
    const input = editableTextareas(c)[0]

    setValue(input, 'Hello, 世界')
    expect(outputValue(c)).toBe('SGVsbG8sIOS4lueVjA==')

    clickText(c, '解码')
    setValue(input, 'SGVsbG8sIOS4lueVjA==')
    expect(outputValue(c)).toBe('Hello, 世界')
  })

  it('url-encode percent-encodes components and full URLs', async () => {
    const c = await mountTool('url-encode')
    const input = editableTextareas(c)[0]

    setValue(input, '你好 world & a=1')
    expect(outputValue(c)).toBe('%E4%BD%A0%E5%A5%BD%20world%20%26%20a%3D1')

    setValue(input, '%E4%BD%A0%E5%A5%BD')
    clickText(c, '解码')
    expect(outputValue(c)).toBe('你好')
  })

  it('html-entity escapes and unescapes entities', async () => {
    const c = await mountTool('html-entity')
    const input = editableTextareas(c)[0]

    setValue(input, '<a href="x">&\'</a>')
    clickText(c, '转义')
    expect(outputValue(c)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')

    setValue(input, '&lt;p&gt;Hi &amp; bye&lt;/p&gt;')
    clickText(c, '反转义')
    expect(outputValue(c)).toBe('<p>Hi & bye</p>')
  })

  it('unicode converts text to/from code points including supplementary planes', async () => {
    const c = await mountTool('unicode')
    const input = editableTextareas(c)[0]

    setValue(input, '你好😀')
    expect(outputValue(c)).toBe('\\u4F60\\u597D\\u{1F600}')

    clickText(c, 'Unicode→文本')
    setValue(input, '\\u4F60\\u597D\\u{1F600}')
    expect(outputValue(c)).toBe('你好😀')
  })

  it('hex converts text/hex/decimal', async () => {
    const c = await mountTool('hex')
    const input = editableTextareas(c)[0]

    setValue(input, 'ab')
    expect(outputValue(c)).toBe('61 62')

    clickText(c, 'Hex→文本')
    setValue(input, '48 65 6C 6C 6F')
    expect(outputValue(c)).toBe('Hello')

    clickText(c, 'Hex→Decimal')
    setValue(input, 'FF 0A')
    expect(outputValue(c)).toBe('255 10')

    clickText(c, 'Decimal→Hex')
    setValue(input, '255 123')
    expect(outputValue(c)).toBe('FF 7B')
  })

  it('jwt decodes header, payload and signature', async () => {
    const c = await mountTool('jwt')
    const input = editableTextareas(c)[0]
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuW8oOS4iSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxODAwMDAwMDAwLCJyb2xlIjoiYWRtaW4ifQ.4q2AxBv0PjOZ4U2J2v6k8QJ6b7yP1mN5cR3tV9wX0yA'

    setValue(input, token)
    const output = c.querySelectorAll('pre.code-block')
    expect(output[0].textContent).toContain('"alg": "HS256"')
    expect(output[1].textContent).toContain('"sub": "1234567890"')
    expect(output[1].textContent).toContain('"name": "张三"')
    expect(output[2].textContent).toBe('4q2AxBv0PjOZ4U2J2v6k8QJ6b7yP1mN5cR3tV9wX0yA')
  })

  it('base58 encodes and decodes Bitcoin-alphabet text', async () => {
    const c = await mountTool('base58')
    const input = editableTextareas(c)[0]

    setValue(input, 'Hello World')
    clickText(c, '编码')
    expect(outputValue(c)).toBe('JxF12TrwUP45BMd')

    setValue(input, 'JxF12TrwUP45BMd')
    clickText(c, '解码')
    expect(outputValue(c)).toBe('Hello World')
  })

  it('base32 encodes and decodes RFC 4648 text', async () => {
    const c = await mountTool('base32')
    const input = editableTextareas(c)[0]

    setValue(input, 'Hello')
    clickText(c, '编码')
    expect(outputValue(c)).toBe('JBSWY3DP')

    setValue(input, 'JBSWY3DP')
    clickText(c, '解码')
    expect(outputValue(c)).toBe('Hello')
  })

  it('punycode encodes a CJK label to the RFC 3492 form', async () => {
    const c = await mountTool('punycode')
    const input = editableTextareas(c)[0]

    setValue(input, '例子')
    expect(outputValue(c)).toBe('xn--fsqu00a')
    expect(errorText(c)).toBe('')
  })

  it('punycode decodes an xn-- label back to text', async () => {
    const c = await mountTool('punycode')
    const input = editableTextareas(c)[0]

    clickText(c, 'Punycode→文本')
    setValue(input, 'xn--fsqu00a')
    expect(outputValue(c)).toBe('例子')
    expect(errorText(c)).toBe('')
  })

  it('data-url reads a file into a data URL', async () => {
    const c = await mountTool('data-url')
    const fileInput = c.querySelector('input[type="file"]')
    const file = new File(['hello'], 'x.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(outputValue(c)).toContain('data:text/plain;base64,aGVsbG8=')
    })
  })
})

describe('crypto tools', () => {
  it('md5 hashes text', async () => {
    const c = await mountTool('md5')
    const input = editableTextareas(c)[0]

    setValue(input, 'abc')
    expect(outputValue(c)).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('sha hashes text with SHA-256, SHA-1 and SHA-512', async () => {
    const c = await mountTool('sha')
    const input = editableTextareas(c)[0]

    setValue(input, 'abc')
    await waitForOutput(c, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')

    clickText(c, 'SHA-1')
    await waitForOutput(c, 'a9993e364706816aba3e25717850c26c9cd0d89d')

    clickText(c, 'SHA-512')
    await waitForOutput(c, 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f')
  })

  it('aes round-trips with CBC + Pkcs7', async () => {
    const c = await mountTool('aes')
    const input = editableTextareas(c)[0]
    const [key, iv] = textInputs(c)

    setValue(input, 'hello world')
    setValue(key, 'my-secret-key-16')
    setValue(iv, '1234567890abcdef')
    clickPrimary(c)
    const ciphertext = outputValue(c)
    expect(ciphertext).toBeTruthy()
    expect(ciphertext).not.toBe('hello world')

    setValue(input, ciphertext)
    clickText(c, '解密')
    expect(outputValue(c)).toBe('hello world')
  })

  it('aes honours the IV (different IV must not decrypt the ciphertext)', async () => {
    const c = await mountTool('aes')
    const input = editableTextareas(c)[0]
    const [key, iv] = textInputs(c)

    setValue(input, 'top secret')
    setValue(key, 'my-secret-key-16')
    setValue(iv, 'AAAAAAAAAAAAAAAA')
    clickPrimary(c)
    const ciphertext = outputValue(c)

    setValue(iv, 'BBBBBBBBBBBBBBBB')
    setValue(input, ciphertext)
    clickText(c, '解密')
    expect(outputValue(c)).not.toBe('top secret')
  })

  it('des round-trips with CBC + Pkcs7', async () => {
    const c = await mountTool('des')
    const input = editableTextareas(c)[0]
    const [key, iv] = textInputs(c)

    setValue(input, 'hello world')
    setValue(key, '8bytekey')
    setValue(iv, '12345678')
    clickPrimary(c)
    const ciphertext = outputValue(c)
    expect(ciphertext).toBeTruthy()

    setValue(input, ciphertext)
    clickText(c, '解密')
    expect(outputValue(c)).toBe('hello world')
  })

  it('file-hash computes a SHA-256 digest', async () => {
    const c = await mountTool('file-hash')
    const fileInput = c.querySelector('input[type="file"]')
    const algorithm = c.querySelector('select')
    setValue(algorithm, 'SHA-256')
    const file = new File([new Uint8Array([104, 101, 108, 108, 111])], 'hello.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForOutput(c, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('hmac computes an HMAC-SHA256 signature', async () => {
    const c = await mountTool('hmac')
    const message = editableTextareas(c)[0]
    const key = c.querySelector('input.input')

    setValue(message, 'The quick brown fox jumps over the lazy dog')
    setValue(key, 'key')
    expect(outputValue(c)).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
  })

  it('totp generates a six-digit code from a Base32 secret', async () => {
    const c = await mountTool('totp')
    const input = c.querySelector('input[type="text"]')
    setValue(input, 'JBSWY3DPEHPK3PXP')

    const form = c.querySelector('form')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(c.querySelector('.totp-code').textContent).toMatch(/^\d{6}$/)
    expect(errorText(c)).toBe('')
  })
})
