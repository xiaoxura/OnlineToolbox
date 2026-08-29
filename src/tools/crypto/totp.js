import { createCopyButton, createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'

const DEFAULTS = {
  algorithm: 'SHA1',
  digits: 6,
  period: 30
}

const SUPPORTED_ALGORITHMS = new Set(['SHA1', 'SHA256', 'SHA512'])
const SUPPORTED_DIGITS = new Set([6, 8])

function isOtpAuthUri(value) {
  return /^otpauth:/i.test(value)
}

function normalizeAlgorithm(value) {
  const algorithm = String(value ?? DEFAULTS.algorithm).toUpperCase()
  if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
    throw new Error('仅支持 SHA1、SHA256 或 SHA512 算法')
  }
  return algorithm
}

function normalizeDigits(value) {
  const digits = Number(value ?? DEFAULTS.digits)
  if (!Number.isInteger(digits) || !SUPPORTED_DIGITS.has(digits)) {
    throw new Error('验证码位数仅支持 6 位或 8 位')
  }
  return digits
}

function normalizePeriod(value) {
  const period = Number(value ?? DEFAULTS.period)
  if (!Number.isInteger(period) || period < 1 || period > 300) {
    throw new Error('时间周期必须是 1 到 300 秒之间的整数')
  }
  return period
}

function normalizeTimestamp(timestamp) {
  if (!Number.isFinite(timestamp)) throw new Error('时间戳必须是有效的毫秒数')
  return timestamp
}

function base32Secret(value) {
  if (typeof value !== 'string') throw new Error('请输入 Base32 密钥')
  const normalized = value.replace(/[\s-]/g, '').toUpperCase()
  const match = /^([A-Z2-7]+)(=*)$/.exec(normalized)
  if (!match) throw new Error('密钥必须是有效的 Base32 字符串')

  const [, content, padding] = match
  const remainder = content.length % 8
  const requiredPadding = { 0: 0, 2: 6, 4: 4, 5: 3, 7: 1 }[remainder]
  if (requiredPadding === undefined || (padding && (normalized.length % 8 !== 0 || padding.length !== requiredPadding))) {
    throw new Error('Base32 密钥的长度或尾部填充无效')
  }

  try {
    const secret = OTPAuth.Secret.fromBase32(normalized)
    if (!secret.bytes.length) throw new Error('empty secret')
    return secret
  } catch {
    throw new Error('密钥必须是有效的 Base32 字符串')
  }
}

function parseOtpAuthUrl(value) {
  let uri
  try {
    uri = new URL(value)
  } catch {
    throw new Error('URI 格式无效')
  }
  if (uri.hash) throw new Error('URI 不支持 fragment')

  const secretValues = []
  for (const pair of uri.search.slice(1).split('&')) {
    if (!pair) continue
    const separator = pair.indexOf('=')
    const rawKey = separator < 0 ? pair : pair.slice(0, separator)
    const rawValue = separator < 0 ? '' : pair.slice(separator + 1)

    let key
    let parameterValue
    try {
      key = decodeURIComponent(rawKey)
      parameterValue = decodeURIComponent(rawValue)
    } catch {
      throw new Error('URI 查询参数编码无效')
    }

    if (key.toLowerCase() === 'secret') secretValues.push(parameterValue)
  }

  if (secretValues.length !== 1) throw new Error('URI 必须且只能包含一个 secret 参数')
  return base32Secret(secretValues[0])
}

function normalizeConfig(config = {}) {
  const secretValue = config.secret instanceof OTPAuth.Secret ? config.secret.base32 : config.secret
  const secret = base32Secret(secretValue)

  return {
    secret: secret.base32,
    issuer: String(config.issuer ?? ''),
    account: String(config.account ?? config.label ?? ''),
    algorithm: normalizeAlgorithm(config.algorithm),
    digits: normalizeDigits(config.digits),
    period: normalizePeriod(config.period)
  }
}

function createTotp(config) {
  const normalized = normalizeConfig(config)
  return new OTPAuth.TOTP({
    issuer: normalized.issuer,
    label: normalized.account,
    secret: normalized.secret,
    algorithm: normalized.algorithm,
    digits: normalized.digits,
    period: normalized.period
  })
}

export function parseTotpInput(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('请输入 Base32 密钥或 otpauth URI')
  const value = input.trim()

  if (!isOtpAuthUri(value)) {
    const secret = base32Secret(value)
    return {
      secret: secret.base32,
      issuer: '',
      account: '',
      ...DEFAULTS
    }
  }

  let secret
  try {
    secret = parseOtpAuthUrl(value)
  } catch (error) {
    const message = error instanceof Error ? error.message : '格式错误'
    throw new Error(`无效的 otpauth URI：${message}`)
  }

  let totp
  try {
    totp = OTPAuth.URI.parse(value)
  } catch (error) {
    const message = error instanceof Error ? error.message : '格式错误'
    throw new Error(`无效的 otpauth URI：${message}`)
  }

  if (!(totp instanceof OTPAuth.TOTP)) throw new Error('仅支持 TOTP 类型的 otpauth URI')
  if (totp.secret.base32 !== secret.base32) throw new Error('URI 中的 secret 参数不一致')

  return normalizeConfig({
    secret: secret.base32,
    issuer: totp.issuer,
    account: totp.label,
    algorithm: totp.algorithm,
    digits: totp.digits,
    period: totp.period
  })
}

export function generateTotp(config, timestamp = Date.now()) {
  return createTotp(config).generate({ timestamp: normalizeTimestamp(timestamp) })
}

export function validateTotp(config, token, timestamp = Date.now(), window = 1) {
  const normalized = normalizeConfig(config)
  if (typeof token !== 'string' || !new RegExp(`^\\d{${normalized.digits}}$`).test(token)) return null
  if (!Number.isInteger(window) || window < 0) throw new Error('校验窗口必须是非负整数')

  return createTotp(normalized).validate({
    token,
    timestamp: normalizeTimestamp(timestamp),
    window
  })
}

export function getSecondsRemaining(timestamp = Date.now(), period = DEFAULTS.period) {
  const timestampMs = normalizeTimestamp(timestamp)
  const periodMs = normalizePeriod(period) * 1000
  const elapsed = ((timestampMs % periodMs) + periodMs) % periodMs
  return Math.ceil((periodMs - elapsed) / 1000)
}

function validationMessage(delta) {
  if (delta === 0) return '有效：当前时间步的验证码。'
  if (delta === -1) return '有效：上一个时间步的验证码。'
  if (delta === 1) return '有效：下一个时间步的验证码。'
  return `有效：相差 ${delta} 个时间步。`
}

export default {
  id: 'totp',
  name: '2FA 验证码',
  description: '在浏览器本地生成和校验 TOTP 动态验证码',
  category: 'crypto',
  icon: 'hmac',
  keywords: ['2fa', 'totp', 'otp', 'authenticator', '动态口令'],
  render(container) {
    let currentAlgorithm = DEFAULTS.algorithm
    let currentDigits = DEFAULTS.digits
    let currentConfig = null
    let currentToken = ''
    let currentUri = ''
    let qrRequest = 0

    const secretInput = createElement('input', {
      id: 'totp-secret',
      className: 'input',
      type: 'password',
      placeholder: '粘贴 Base32 密钥或 otpauth URI',
      autocomplete: 'off',
      spellcheck: false
    })
    const secretLabel = createElement('label', { className: 'label', htmlFor: secretInput.id, textContent: 'Base32 密钥或 otpauth URI' })
    const showSecret = createElement('input', { id: 'totp-show-secret', className: 'checkbox', type: 'checkbox' })
    const showSecretLabel = createElement('label', { className: 'checkbox-label' }, [
      showSecret,
      createElement('span', { textContent: '显示密钥' })
    ])
    const randomSecretButton = createElement('button', { className: 'btn btn-secondary', type: 'button', textContent: '生成随机密钥' })

    const issuerInput = createElement('input', {
      id: 'totp-issuer',
      className: 'input',
      type: 'text',
      placeholder: '例如 GitHub',
      autocomplete: 'off'
    })
    const issuerLabel = createElement('label', { className: 'label', htmlFor: issuerInput.id, textContent: '服务名称' })
    const accountInput = createElement('input', {
      id: 'totp-account',
      className: 'input',
      type: 'text',
      placeholder: '例如 name@example.com',
      autocomplete: 'off'
    })
    const accountLabel = createElement('label', { className: 'label', htmlFor: accountInput.id, textContent: '账户' })

    const periodInput = createElement('input', {
      id: 'totp-period',
      className: 'input',
      type: 'number',
      min: '1',
      max: '300',
      step: '1',
      value: String(DEFAULTS.period),
      inputmode: 'numeric'
    })
    const periodLabel = createElement('label', { className: 'label', htmlFor: periodInput.id, textContent: '周期（秒）' })

    const codeValue = createElement('div', {
      className: 'totp-code',
      textContent: '------',
      'aria-label': '当前验证码',
      'aria-live': 'off'
    })
    const countdown = createElement('div', { className: 'totp-countdown', textContent: '等待密钥输入' })
    const progress = createElement('div', {
      className: 'totp-progress',
      role: 'progressbar',
      'aria-label': '当前验证码剩余时间',
      'aria-valuemin': '0',
      'aria-valuemax': String(DEFAULTS.period),
      'aria-valuenow': '0'
    }, [createElement('div', { className: 'totp-progress-fill' })])
    const getCurrentToken = () => currentConfig ? generateTotp(currentConfig, Date.now()) : ''
    const codeSection = createSection('当前验证码', createElement('div', { className: 'totp-code-panel' }, [codeValue, countdown, progress]), [createCopyButton(getCurrentToken)])

    const uriOutput = createElement('textarea', {
      id: 'totp-uri',
      className: 'textarea totp-uri',
      rows: '3',
      readOnly: true,
      'aria-label': 'otpauth 配置 URI',
      placeholder: '填写服务名称和账户后生成 otpauth URI'
    })
    const qrCanvas = createElement('canvas', {
      className: 'totp-qr-canvas hidden',
      role: 'img',
      'aria-label': 'TOTP 配置二维码'
    })
    const qrStatus = createElement('div', { className: 'sub-label totp-qr-status' })
    const qrArea = createElement('div', { className: 'totp-qr-area' }, [qrCanvas, qrStatus])
    const uriSection = createSection('配置 URI 与二维码', createElement('div', { className: 'tool-stack' }, [uriOutput, qrArea]), [createCopyButton(() => currentUri)])

    const validationInput = createElement('input', {
      id: 'totp-validation-code',
      className: 'input',
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'one-time-code',
      placeholder: '输入验证码进行校验',
      maxlength: '8'
    })
    const validationLabel = createElement('label', { className: 'label', htmlFor: validationInput.id, textContent: '验证码校验' })
    const validationButton = createElement('button', { className: 'btn btn-secondary', type: 'button', textContent: '校验验证码' })
    const validationResult = createElement('div', { className: 'totp-validation-result', role: 'status', 'aria-live': 'polite' })
    const validationSection = createSection('本地校验', createElement('div', { className: 'tool-stack' }, [
      createElement('div', { className: 'form-row form-action-row' }, [
        createElement('div', { className: 'form-group' }, [validationLabel, validationInput]),
        validationButton
      ]),
      validationResult
    ]))

    const errorText = createElement('div', { className: 'error-text', role: 'alert', 'aria-live': 'polite' })
    secretInput.setAttribute('aria-describedby', errorText.id || 'totp-input-error')
    errorText.id = 'totp-input-error'

    const algorithmGroup = createSegmentedGroup([
      { label: 'SHA-1', value: 'SHA1' },
      { label: 'SHA-256', value: 'SHA256' },
      { label: 'SHA-512', value: 'SHA512' }
    ], value => {
      currentAlgorithm = value
      refresh()
    }, { label: '算法' })
    const digitsGroup = createSegmentedGroup([
      { label: '6 位', value: '6' },
      { label: '8 位', value: '8' }
    ], value => {
      currentDigits = Number(value)
      validationInput.maxLength = currentDigits
      refresh()
    }, { label: '验证码位数' })

    const configurationSection = createSection('2FA 配置', createElement('div', { className: 'tool-stack' }, [
      createElement('div', { className: 'form-group' }, [secretLabel, secretInput, errorText]),
      createElement('div', { className: 'option-row' }, [showSecretLabel, randomSecretButton]),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [issuerLabel, issuerInput]),
        createElement('div', { className: 'form-group' }, [accountLabel, accountInput]),
        createElement('div', { className: 'form-group' }, [periodLabel, periodInput])
      ]),
      createElement('div', { className: 'form-group' }, [createElement('span', { className: 'label', textContent: '算法' }), algorithmGroup]),
      createElement('div', { className: 'form-group' }, [createElement('span', { className: 'label', textContent: '验证码位数' }), digitsGroup])
    ]))

    const privacyNotice = createElement('p', {
      className: 'privacy-notice',
      textContent: '密钥和验证码只在当前浏览器处理，不上传、不保存。'
    })

    function clearQr() {
      qrRequest += 1
      const context = qrCanvas.getContext?.('2d')
      context?.clearRect(0, 0, qrCanvas.width, qrCanvas.height)
      qrCanvas.width = 0
      qrCanvas.height = 0
      qrCanvas.classList.add('hidden')
      qrStatus.textContent = ''
    }

    function clearOutputs() {
      currentConfig = null
      currentToken = ''
      currentUri = ''
      codeValue.textContent = '------'
      countdown.textContent = '等待密钥输入'
      progress.style.setProperty('--totp-progress', '0%')
      progress.setAttribute('aria-valuemax', String(DEFAULTS.period))
      progress.setAttribute('aria-valuenow', '0')
      progress.removeAttribute('aria-valuetext')
      uriOutput.value = ''
      validationResult.textContent = ''
      validationResult.removeAttribute('data-state')
      clearQr()
    }

    async function renderQr(uri) {
      const request = ++qrRequest
      qrCanvas.classList.add('hidden')
      qrStatus.textContent = '正在生成二维码'
      try {
        await QRCode.toCanvas(qrCanvas, uri, {
          width: 256,
          errorCorrectionLevel: 'M',
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        })
        if (request !== qrRequest || !container.isConnected) return
        qrCanvas.classList.remove('hidden')
        qrStatus.textContent = '使用验证器扫描二维码添加账户'
      } catch {
        if (request !== qrRequest || !container.isConnected) return
        qrCanvas.classList.add('hidden')
        qrStatus.textContent = '二维码生成失败'
      }
    }

    function syncUriControls(config) {
      issuerInput.value = config.issuer
      accountInput.value = config.account
      currentAlgorithm = config.algorithm
      currentDigits = config.digits
      periodInput.value = String(config.period)
      algorithmGroup.setValue(config.algorithm)
      digitsGroup.setValue(String(config.digits))
      validationInput.maxLength = config.digits
    }

    function readConfig() {
      const parsed = parseTotpInput(secretInput.value)
      return normalizeConfig({
        ...parsed,
        issuer: issuerInput.value.trim(),
        account: accountInput.value.trim(),
        algorithm: currentAlgorithm,
        digits: currentDigits,
        period: periodInput.value
      })
    }

    function updateCurrentCode(timestamp = Date.now()) {
      if (!currentConfig) return
      currentToken = generateTotp(currentConfig, timestamp)
      const remaining = getSecondsRemaining(timestamp, currentConfig.period)
      codeValue.textContent = currentToken
      countdown.textContent = `本时间步还剩 ${remaining} 秒`
      progress.style.setProperty('--totp-progress', `${(remaining / currentConfig.period) * 100}%`)
      progress.setAttribute('aria-valuemax', String(currentConfig.period))
      progress.setAttribute('aria-valuenow', String(remaining))
      progress.setAttribute('aria-valuetext', `剩余 ${remaining} 秒`)
    }

    function refresh() {
      if (!secretInput.value.trim()) {
        errorText.textContent = ''
        clearOutputs()
        return
      }

      try {
        const config = readConfig()
        const nextUri = config.issuer && config.account ? createTotp(config).toString() : ''
        const shouldRenderQr = nextUri !== currentUri
        currentConfig = config
        currentUri = nextUri
        errorText.textContent = ''
        validationResult.textContent = ''
        validationResult.removeAttribute('data-state')
        uriOutput.value = currentUri
        updateCurrentCode()
        if (shouldRenderQr) {
          if (currentUri) renderQr(currentUri)
          else clearQr()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '无法读取 2FA 配置'
        errorText.textContent = message
        clearOutputs()
      }
    }

    showSecret.addEventListener('change', () => {
      secretInput.type = showSecret.checked ? 'text' : 'password'
    })
    secretInput.addEventListener('input', () => {
      if (isOtpAuthUri(secretInput.value.trim())) {
        try {
          const parsed = parseTotpInput(secretInput.value)
          secretInput.value = parsed.secret
          syncUriControls(parsed)
        } catch {
          // Let refresh display the URI parsing error while keeping the input intact.
        }
      }
      refresh()
    })
    issuerInput.addEventListener('input', refresh)
    accountInput.addEventListener('input', refresh)
    periodInput.addEventListener('input', refresh)
    randomSecretButton.addEventListener('click', () => {
      secretInput.value = new OTPAuth.Secret({ size: 20 }).base32
      refresh()
      secretInput.focus()
    })
    validationButton.addEventListener('click', () => {
      if (!currentConfig) {
        validationResult.textContent = '请先输入有效的 2FA 密钥。'
        validationResult.dataset.state = 'invalid'
        return
      }
      const delta = validateTotp(currentConfig, validationInput.value.trim(), Date.now(), 1)
      validationResult.textContent = delta === null
        ? '无效：已检查当前及前后一个时间步。'
        : validationMessage(delta)
      validationResult.dataset.state = delta === null ? 'invalid' : 'valid'
    })
    uriOutput.addEventListener('focus', () => uriOutput.select())

    container.append(configurationSection, codeSection, uriSection, validationSection, privacyNotice)
    refresh()

    let observer = null
    let timer = null
    const cleanupTimer = event => {
      if (event && event.target !== container) return
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      observer?.disconnect()
      observer = null
      container.removeEventListener('DOMNodeRemoved', cleanupTimer)
    }
    const scheduleUpdate = () => {
      if (!container.isConnected) {
        cleanupTimer()
        return
      }

      const delay = 1000 - (Date.now() % 1000)
      timer = setTimeout(() => {
        timer = null
        if (!container.isConnected) {
          cleanupTimer()
          return
        }
        updateCurrentCode()
        scheduleUpdate()
      }, delay)
    }
    container.addEventListener('DOMNodeRemoved', cleanupTimer)
    observer = globalThis.MutationObserver
      ? new globalThis.MutationObserver(() => {
        if (!container.isConnected) cleanupTimer()
      })
      : null
    if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true })
    scheduleUpdate()
  }
}
