import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import bcryptTool, {
  DEFAULT_COST,
  hashPassword as bcryptHash,
  isBcryptHash,
  normalizeCost,
  parseHashInfo,
  utf8Length,
  verifyPassword
} from '../src/tools/crypto/bcrypt.js'
import htpasswdTool, {
  apr1Crypt,
  basicAuthHeader,
  bcryptHtpasswd,
  buildHtpasswdLine,
  hashPassword as htpasswdHash,
  sha1Htpasswd
} from '../src/tools/devtool/htpasswd-generator.js'
import strengthTool, {
  SCORE_LABELS,
  analyzePassword,
  detectCharsetSize,
  estimateCrackSeconds,
  formatDuration,
  hasSequentialRun,
  isCommonPassword
} from '../src/tools/crypto/password-strength.js'
import cipherTool, {
  atbash,
  bruteForceCaesar,
  caesar,
  formatBruteForce,
  normalizeShift,
  rot13,
  vigenere
} from '../src/tools/crypto/classic-cipher.js'
import bip39Tool, {
  SAMPLE_MNEMONIC,
  VALID_WORD_COUNTS,
  bytesToHex,
  entropyToMnemonic,
  generateMnemonic,
  inspectMnemonic,
  mnemonicToEntropy,
  mnemonicToSeed,
  validateMnemonic
} from '../src/tools/crypto/bip39.js'
import { WORDLIST } from '../src/tools/crypto/bip39-wordlist.js'
import ibanTool, { SAMPLE_IBAN, formatIban, mod97, validateIban } from '../src/tools/devtool/iban-validator.js'
import { enhanceFormAccessibility } from '../src/utils/dom.js'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function render(tool) {
  tool.render(root)
  enhanceFormAccessibility(root)
  return root
}

function buttonByText(scope, text) {
  return [...scope.querySelectorAll('button')].find(button => button.textContent.trim() === text)
}

// Mirrors the repo-wide smoke assertions so a violation fails here first.
function expectRenderable(tool, container) {
  expect(container.childElementCount).toBeGreaterThan(0)
  expect(container.querySelector('select.input')).toBeNull()
  expect(container.querySelector('button[class="btn"]')).toBeNull()
  for (const control of container.querySelectorAll('input, textarea, select')) {
    const named = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
    expect(Boolean(named), `${tool.id}: unnamed ${control.tagName}`).toBe(true)
  }
  for (const choice of container.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
    expect(choice.closest('label')).not.toBeNull()
  }
  expect(container.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box')).toBeNull()
  for (const group of container.querySelectorAll('[role="radiogroup"]')) {
    expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
  }
}

describe('bcrypt 哈希', () => {
  it('parses and recognises bcrypt hashes', () => {
    const hash = bcryptHash('hunter2', 10, '$2b$10$abcdefghijklmnopqrstuv')
    expect(hash).toBe('$2b$10$abcdefghijklmnopqrstuu7gIUFBKrYXdzQy8HrouzMJyZ4cijAb2')
    expect(isBcryptHash(hash)).toBe(true)
    expect(parseHashInfo(hash)).toEqual({
      version: '2b',
      cost: 10,
      salt: 'abcdefghijklmnopqrstuu',
      digest: '7gIUFBKrYXdzQy8HrouzMJyZ4cijAb2'
    })
    expect(parseHashInfo('not-a-hash')).toBeNull()
    expect(isBcryptHash('$2b$10$short')).toBe(false)
  })

  it('is deterministic for a fixed salt and verifies round trips', () => {
    const hash = bcryptHash('correct horse', 10, '$2b$10$abcdefghijklmnopqrstuv')
    expect(bcryptHash('correct horse', 10, '$2b$10$abcdefghijklmnopqrstuv')).toBe(hash)
    expect(verifyPassword('correct horse', hash)).toBe(true)
    expect(verifyPassword('wrong horse', hash)).toBe(false)
    expect(bcryptHash('correct horse', 10)).not.toBe(hash)
  })

  it('rejects invalid costs, empty passwords and malformed hashes', () => {
    expect(() => normalizeCost(3)).toThrow(/4 到 31/)
    expect(() => normalizeCost(1.5)).toThrow()
    expect(normalizeCost('12')).toBe(12)
    expect(DEFAULT_COST).toBe(10)
    expect(() => bcryptHash('', 10)).toThrow(/请输入/)
    expect(() => bcryptHash('x', 10, 'nope')).toThrow(/盐值格式无效/)
    expect(() => verifyPassword('', '$2b$10$abcdefghijklmnopqrstuu7gIUFBKrYXdzQy8HrouzMJyZ4cijAb2')).toThrow(/请输入/)
    expect(() => verifyPassword('x', 'plain-text')).toThrow(/哈希格式无效/)
    expect(utf8Length('中文')).toBe(6)
  })

  it('renders both modes and hashes on demand', () => {
    const container = render(bcryptTool)
    expectRenderable(bcryptTool, container)

    const [passwordField] = container.querySelectorAll('input[type="text"]')
    passwordField.value = 'hunter2'
    container.querySelector('.btn-primary').click()
    const output = container.querySelector('textarea[readonly]')
    expect(output.value).toMatch(/^\$2[ab]\$10\$/)
    expect(verifyPassword('hunter2', output.value)).toBe(true)

    container.querySelector('.segmented-btn[data-value="verify"]').click()
    const [, , verifyPasswordField, verifyHashField] = container.querySelectorAll('input[type="text"]')
    verifyHashField.value = output.value
    verifyPasswordField.value = 'hunter2'
    container.querySelectorAll('.btn-primary')[1].click()
    expect(container.querySelector('.inline-result').textContent).toContain('匹配')

    verifyPasswordField.value = 'nope'
    container.querySelectorAll('.btn-primary')[1].click()
    expect(container.querySelector('.inline-result').textContent).toContain('不匹配')
  })
})

describe('htpasswd 生成器', () => {
  // Ground truth from `openssl passwd -apr1 -salt <salt> <password>`.
  it('produces Apache apr1 MD5 crypt hashes', () => {
    expect(apr1Crypt('password', 'xxxxxxxx')).toBe('$apr1$xxxxxxxx$dxHfLAsjHkDRmG83UXe8K0')
    expect(apr1Crypt('test', 'saltsalt')).toBe('$apr1$saltsalt$NBMPZFGR7yazCdGvlWJji1')
    expect(apr1Crypt('hunter2', 'abcdefgh')).toBe('$apr1$abcdefgh$ckT15POyCRlen.h6XtGAZ1')
    // UTF-8 passwords hash over their bytes, same as the C implementation.
    expect(apr1Crypt('中文密码', 'salt1234')).toBe('$apr1$salt1234$HJcGcm9T18HiWj5pfpmLo/')
  })

  it('produces {SHA} and bcrypt credentials', () => {
    expect(sha1Htpasswd('password')).toBe('{SHA}W6ph5Mm5Pz8GgiULbPgzG37mj9g=')
    expect(htpasswdHash('secret', 'sha1')).toBe(sha1Htpasswd('secret'))
    expect(htpasswdHash('secret', 'plain')).toBe('secret')
    expect(bcryptHtpasswd('secret')).toMatch(/^\$2[ab]\$10\$/)
    expect(bcryptHtpasswd('secret', 5)).toMatch(/^\$2[ab]\$05\$/)
  })

  it('builds htpasswd lines and Basic auth headers', () => {
    expect(buildHtpasswdLine('user', 'password', 'apr1', { salt: 'xxxxxxxx' }))
      .toBe('user:$apr1$xxxxxxxx$dxHfLAsjHkDRmG83UXe8K0')
    expect(buildHtpasswdLine('user', 'pass', 'plain')).toBe('user:pass')
    expect(basicAuthHeader('admin', 'hunter2')).toBe('Authorization: Basic YWRtaW46aHVudGVyMg==')
    expect(() => buildHtpasswdLine('', 'pass', 'plain')).toThrow(/请输入用户名/)
    expect(() => buildHtpasswdLine('a:b', 'pass', 'plain')).toThrow(/冒号/)
    expect(() => htpasswdHash('', 'plain')).toThrow(/请输入密码/)
    expect(() => htpasswdHash('x', 'unknown')).toThrow(/不支持的格式/)
  })

  it('renders username:hash output for the selected format', () => {
    const container = render(htpasswdTool)
    expectRenderable(htpasswdTool, container)

    const [usernameField, passwordField] = container.querySelectorAll('input[type="text"]')
    usernameField.value = 'admin'
    passwordField.value = 'hunter2'
    const [lineOutput, headerOutput] = container.querySelectorAll('textarea[readonly]')

    container.querySelector('.select').value = 'plain'
    container.querySelector('.btn-primary').click()
    expect(lineOutput.value).toBe('admin:hunter2')
    expect(headerOutput.value).toBe('Authorization: Basic YWRtaW46aHVudGVyMg==')

    passwordField.value = 'password'
    container.querySelector('.select').value = 'sha1'
    container.querySelector('.btn-primary').click()
    expect(lineOutput.value).toBe('admin:{SHA}W6ph5Mm5Pz8GgiULbPgzG37mj9g=')

    container.querySelector('.select').value = 'apr1'
    container.querySelector('.btn-primary').click()
    expect(lineOutput.value).toMatch(/^admin:\$apr1\$[./A-Za-z0-9]{8}\$[./A-Za-z0-9]{22}$/)

    usernameField.value = 'bad:name'
    container.querySelector('.btn-primary').click()
    expect(lineOutput.value).toBe('')
    expect(container.querySelector('.error-text').textContent).toContain('冒号')
  })
})

describe('密码强度分析', () => {
  it('scores weak, medium and strong passwords', () => {
    const empty = analyzePassword('')
    expect(empty.score).toBe(0)
    expect(empty.warnings).toHaveLength(1)

    const common = analyzePassword('password')
    expect(common.score).toBe(0)
    expect(common.label).toBe(SCORE_LABELS[0])
    expect(common.warnings.join()).toContain('字典')

    const digits = analyzePassword('123456')
    expect(digits.score).toBe(0)
    expect(digits.warnings.join()).toContain('只包含数字')

    const decent = analyzePassword('Tr0ub4dor&3')
    expect(decent.score).toBeGreaterThanOrEqual(2)
    expect(decent.entropyBits).toBeCloseTo(72.3, 1)
    expect(decent.charsetSize).toBe(95)

    const strong = analyzePassword('vN7$qLp2#Zx9!Km4')
    expect(strong.score).toBe(4)
    expect(strong.label).toBe('极强')
  })

  it('measures the character set of a password', () => {
    expect(detectCharsetSize('')).toBe(0)
    expect(detectCharsetSize('abcdef')).toBe(26)
    expect(detectCharsetSize('aB1!')).toBe(95)
    expect(detectCharsetSize('中文密码')).toBe(128)
    expect(analyzePassword('中文密码').charsetSize).toBe(128)
  })

  it('detects common passwords, sequences and repeats', () => {
    expect(isCommonPassword('Password123')).toBe(true)
    expect(isCommonPassword('admin!')).toBe(true)
    expect(isCommonPassword('xkcd-9F2q')).toBe(false)
    expect(hasSequentialRun('qwerty')).toBe(true)
    expect(hasSequentialRun('abc123')).toBe(true)
    expect(hasSequentialRun('a1b2c3')).toBe(false)
    expect(analyzePassword('aaaBBB123').warnings.join()).toContain('连续重复')
    expect(analyzePassword('Hello2024!').warnings.join()).toContain('年份')
  })

  it('estimates crack times and formats durations', () => {
    expect(estimateCrackSeconds(0, 10)).toBe(0)
    expect(estimateCrackSeconds(10, 10)).toBeCloseTo(Math.pow(2, 9) / 10, 5)
    expect(formatDuration(0.4)).toBe('不到 1 秒')
    expect(formatDuration(45)).toBe('45 秒')
    expect(formatDuration(600)).toBe('10 分钟')
    expect(formatDuration(7200)).toBe('2 小时')
    expect(formatDuration(172800)).toBe('2 天')
    expect(formatDuration(86400 * 365.25 * 5)).toBe('5 年')
    expect(formatDuration(Infinity)).toBe('几乎瞬间')
    expect(analyzePassword('vN7$qLp2#Zx9!Km4').crackTimes.offline).toContain('年')
  })

  it('updates the meter and stats live', () => {
    const container = render(strengthTool)
    expectRenderable(strengthTool, container)

    const input = container.querySelector('input[type="text"]')
    expect(container.querySelector('.strength-text').textContent).toBe('——')
    expect(container.querySelectorAll('.stat-item')).toHaveLength(0)

    input.value = 'password'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelector('.strength-text').textContent).toBe('极弱')
    expect(container.querySelector('.strength-bar').style.getPropertyValue('--strength-width')).toBe('20%')
    expect(container.querySelectorAll('.stat-item').length).toBe(6)
    expect(container.querySelector('.result-box').textContent).toContain('字典')

    input.value = 'vN7$qLp2#Zx9!Km4'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelector('.strength-text').textContent).toBe('极强')

    buttonByText(container, '清空').click()
    expect(container.querySelector('.strength-text').textContent).toBe('——')
  })
})

describe('经典密码', () => {
  it('shifts letters and preserves case', () => {
    expect(caesar('abc', 3)).toBe('def')
    expect(caesar('xyz', 3)).toBe('abc')
    expect(caesar('def', 3, true)).toBe('abc')
    expect(caesar('Hello, World!', 13)).toBe('Uryyb, Jbeyq!')
    expect(caesar('Hello, World! 123', 13, true)).toBe('Uryyb, Jbeyq! 123')
    expect(normalizeShift(26)).toBe(0)
    expect(normalizeShift(-1)).toBe(25)
    expect(() => normalizeShift(1.5)).toThrow(/整数/)
    expect(() => normalizeShift('abc')).toThrow()
  })

  it('handles ROT13, Atbash, Vigenère and brute force', () => {
    expect(rot13('Hello')).toBe('Uryyb')
    expect(rot13(rot13('Hello, World!'))).toBe('Hello, World!')
    expect(atbash('abc')).toBe('zyx')
    expect(atbash('Abc XYZ')).toBe('Zyx CBA')
    expect(atbash(atbash('Hello'))).toBe('Hello')

    expect(vigenere('ATTACKATDAWN', 'LEMON')).toBe('LXFOPVEFRNHR')
    expect(vigenere('LXFOPVEFRNHR', 'LEMON', true)).toBe('ATTACKATDAWN')
    expect(vigenere('attack at dawn', 'lemon')).toBe('lxfopv ef rnhr')
    expect(() => vigenere('test', '123')).toThrow(/关键词/)

    const all = bruteForceCaesar('Uryyb')
    expect(all).toHaveLength(25)
    expect(all[12].text).toBe('Hello')
    expect(formatBruteForce('Uryyb').split('\n')[12]).toBe('13 位移: Hello')
  })

  it('renders and converts through the shared text transform', () => {
    const container = render(cipherTool)
    expectRenderable(cipherTool, container)

    const input = container.querySelector('textarea:not([readonly])')
    const output = container.querySelector('textarea[readonly]')

    input.value = 'Attack at dawn'
    buttonByText(container, '转换').click()
    expect(output.value).toBe('Dwwdfn dw gdzq')

    container.querySelector('.segmented-btn[data-value="decode"]').click()
    input.value = 'Dwwdfn dw gdzq'
    buttonByText(container, '转换').click()
    expect(output.value).toBe('Attack at dawn')

    const typeSelect = container.querySelector('.select')
    input.value = 'Attack at dawn'
    typeSelect.value = 'rot13'
    typeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    expect(output.value).toBe('Nggnpx ng qnja')

    container.querySelector('.segmented-btn[data-value="encode"]').click()
    typeSelect.value = 'vigenere'
    typeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    const keyInput = container.querySelector('input[type="text"]')
    keyInput.value = 'LEMON'
    keyInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(output.value).toBe('Lxfopv ef rnhr')

    container.querySelector('.segmented-btn[data-value="decode"]').click()
    input.value = 'Lxfopv ef rnhr'
    buttonByText(container, '转换').click()
    expect(output.value).toBe('Attack at dawn')

    input.value = 'Dwwdfn dw gdzq'
    typeSelect.value = 'caesar'
    typeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    container.querySelector('input[type="checkbox"]').click()
    expect(output.value.split('\n')).toHaveLength(25)
    expect(output.value).toContain('3 位移: Attack at dawn')
  })
})

describe('BIP39 助记词', () => {
  it('bundles the full 2048-word English wordlist', () => {
    expect(WORDLIST).toHaveLength(2048)
    expect(new Set(WORDLIST).size).toBe(2048)
    expect(WORDLIST[0]).toBe('abandon')
    expect(WORDLIST[2047]).toBe('zoo')
    expect(WORDLIST.every(word => /^[a-z]+$/.test(word))).toBe(true)
  })

  it('encodes entropy into the canonical mnemonic and back', () => {
    expect(entropyToMnemonic(new Uint8Array(16))).toBe(SAMPLE_MNEMONIC)
    expect(bytesToHex(mnemonicToEntropy(SAMPLE_MNEMONIC))).toBe('00000000000000000000000000000000')
    expect(validateMnemonic(SAMPLE_MNEMONIC)).toBe(true)
    expect(validateMnemonic('  abandon   abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about ')).toBe(true)
    expect(validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')).toBe(false)
    expect(validateMnemonic('notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')).toBe(false)
    expect(() => entropyToMnemonic(new Uint8Array(15))).toThrow(/128/)
  })

  it('reports why a mnemonic is invalid', () => {
    const info = inspectMnemonic('abandon abandon abandon')
    expect(info.valid).toBe(false)
    expect(info.error).toContain('数量')
    expect(info.wordCount).toBe(3)

    const words = inspectMnemonic(SAMPLE_MNEMONIC)
    expect(words.valid).toBe(true)
    expect(words.countValid).toBe(true)
    expect(words.checksumValid).toBe(true)
    expect(words.strengthBits).toBe(128)
    expect(words.invalidWords).toEqual([])
    expect(inspectMnemonic('').valid).toBe(false)
  })

  it('generates valid mnemonics for every supported strength', () => {
    for (const count of VALID_WORD_COUNTS) {
      const mnemonic = generateMnemonic((count * 11 * 32) / 33)
      expect(mnemonic.split(' ')).toHaveLength(count)
      expect(validateMnemonic(mnemonic)).toBe(true)
    }
    expect(() => generateMnemonic(100)).toThrow(/128/)
    expect(generateMnemonic(128)).not.toBe(generateMnemonic(128))
  })

  // Official BIP-39 test vector (trezor vectors, entropy 0x00 × 16).
  it('derives the reference seed with PBKDF2-HMAC-SHA512', async () => {
    const seed = await mnemonicToSeed(SAMPLE_MNEMONIC, 'TREZOR')
    expect(seed).toHaveLength(64)
    expect(bytesToHex(seed)).toBe(
      'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04'
    )
    expect(bytesToHex(await mnemonicToSeed(SAMPLE_MNEMONIC, ''))).not.toBe(bytesToHex(seed))
    await expect(mnemonicToSeed('', 'TREZOR')).rejects.toThrow(/请输入助记词/)
  })

  it('generates, validates and derives from the UI', async () => {
    const container = render(bip39Tool)
    expectRenderable(bip39Tool, container)

    const mnemonicInput = container.querySelector('textarea:not([readonly])')
    const seedOutput = container.querySelector('textarea[readonly]')

    buttonByText(container, '示例数据').click()
    expect(mnemonicInput.value).toBe(SAMPLE_MNEMONIC)
    expect(container.querySelector('.inline-result').textContent).toContain('有效')
    expect(container.querySelectorAll('.stat-item')).toHaveLength(4)

    const passphrase = container.querySelector('input[type="text"]')
    passphrase.value = 'TREZOR'
    buttonByText(container, '推导种子').click()
    await vi.waitFor(() => {
      expect(seedOutput.value).toBe(
        'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04'
      )
    })

    container.querySelector('.btn-primary').click()
    const wordCount = mnemonicInput.value.split(' ').length
    expect(VALID_WORD_COUNTS).toContain(wordCount)
    expect(validateMnemonic(mnemonicInput.value)).toBe(true)
    expect(container.querySelector('.inline-result').textContent).toContain('有效')
  })
})

describe('IBAN 校验', () => {
  it('validates real IBANs and reports their structure', () => {
    const german = validateIban(SAMPLE_IBAN)
    expect(german.valid).toBe(true)
    expect(german.countryCode).toBe('DE')
    expect(german.countryName).toBe('德国')
    expect(german.checkDigits).toBe('89')
    expect(german.bban).toBe('370400440532013000')
    expect(german.formatted).toBe('DE89 3704 0044 0532 0130 00')

    for (const iban of [
      'GB82 WEST 1234 5698 7654 32',
      'FR14 2004 1010 0505 0001 3M02 606',
      'NL91ABNA0417164300',
      'CH93 0076 2011 6238 5295 7',
      'NO9386011117947',
      'MT84MALT011000012345MTLCAST001S'
    ]) {
      expect(validateIban(iban).valid, iban).toBe(true)
    }
    expect(validateIban('de89370400440532013000').valid).toBe(true)
  })

  it('rejects broken IBANs with a reason', () => {
    expect(validateIban('').reason).toContain('请输入')
    expect(validateIban('DE89 3704 0044 0532 0130 01').reason).toContain('mod-97')
    expect(validateIban('DE893704004405320130').reason).toContain('22 位')
    expect(validateIban('ZZ89370400440532013000').reason).toContain('不支持')
    expect(validateIban('D889370400440532013000').reason).toContain('国家/地区代码')
    expect(validateIban('DEAB370400440532013000').reason).toContain('数字校验位')
    expect(validateIban('DE89-3704-0044-0532-0130-0#').reason).toContain('只能包含字母和数字')
    expect(validateIban('DE8').reason).toContain('至少')
  })

  it('computes mod-97 over the rotated, letter-mapped string', () => {
    expect(mod97('370400440532013000' + 'DE89')).toBe(1)
    expect(mod97('AB')).toBe(1011 % 97) // A=10, B=11 → "1011"
    expect(() => mod97('A-B')).toThrow(/非法字符/)
    expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00')
  })

  it('shows the parsed structure in the UI', () => {
    const container = render(ibanTool)
    expectRenderable(ibanTool, container)

    const input = container.querySelector('input[type="text"]')
    input.value = SAMPLE_IBAN
    buttonByText(container, '示例数据').click()

    expect(container.querySelector('.inline-result').textContent).toContain('有效')
    expect(container.querySelectorAll('.stat-item')).toHaveLength(6)
    expect(container.querySelector('.stats-row').textContent).toContain('德国')
    expect(container.querySelector('textarea[readonly]').value).toBe('DE89 3704 0044 0532 0130 00')

    input.value = 'DE89370400440532013001'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelector('.inline-result').textContent).toContain('无效')
    expect(container.querySelector('.error-text').textContent).toContain('mod-97')
  })
})
