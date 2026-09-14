import "../../styles/tools/totp.css"
import { createCopyButton, createElement, createSection } from '../../utils/dom.js'
import * as OTPAuth from 'otpauth'

const DEFAULTS = {
  algorithm: 'SHA1',
  digits: 6,
  period: 30
}

const SUPPORTED_ALGORITHMS = new Set(['SHA1', 'SHA256', 'SHA512'])
const SUPPORTED_DIGITS = new Set([6, 8])

const BASE32_PADDING = {
  0: 0,
  2: 6,
  4: 4,
  5: 3,
  7: 1
}

function normalizeAlgorithm(algorithm) {
  const value = String(algorithm ?? DEFAULTS.algorithm).toUpperCase()
  if (!SUPPORTED_ALGORITHMS.has(value)) throw new Error('仅支持 SHA1、SHA256 或 SHA512 算法')
  return value
}

function normalizeDigits(digits) {
  const value = Number(digits ?? DEFAULTS.digits)
  if (!Number.isInteger(value) || !SUPPORTED_DIGITS.has(value)) throw new Error('验证码位数仅支持 6 位或 8 位')
  return value
}

function normalizeTimestamp(timestamp) {
  if (!Number.isFinite(timestamp)) throw new Error('时间戳必须是有效的毫秒数')
  return timestamp
}

function normalizePeriod(period) {
  const value = Number(period)
  if (!Number.isInteger(value) || value < 1) throw new Error('周期必须是正整数秒')
  return value
}

function parseBase32Secret(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('请输入 Base32 密钥')

  const value = input.trim()
  if (/^otpauth:/i.test(value)) throw new Error('仅支持 Base32 密钥，不支持 otpauth URI')

  const compact = value.replace(/[\s-]/g, '')
  const match = /^([A-Za-z2-7]+)(=*)$/.exec(compact)
  if (!match) throw new Error('密钥只能包含 Base32 字符（A-Z、2-7）、空格、连字符和末尾填充符 =')

  const [, content, padding] = match
  const normalized = compact.toUpperCase()
  const requiredPadding = BASE32_PADDING[content.length % 8]
  if (requiredPadding === undefined || (padding && (normalized.length % 8 !== 0 || padding.length !== requiredPadding))) {
    throw new Error('Base32 密钥长度或尾部填充无效')
  }

  try {
    const secret = OTPAuth.Secret.fromBase32(normalized)
    if (!secret.bytes.length) throw new Error('empty secret')
    return secret
  } catch {
    throw new Error('Base32 密钥无效')
  }
}

function createTotp(config) {
  if (!config || typeof config !== 'object') throw new Error('请输入有效的 TOTP 配置')

  const secret = config.secret instanceof OTPAuth.Secret
    ? parseBase32Secret(config.secret.base32)
    : parseBase32Secret(config.secret)

  return new OTPAuth.TOTP({
    secret: secret.base32,
    algorithm: normalizeAlgorithm(config.algorithm),
    digits: normalizeDigits(config.digits),
    period: normalizePeriod(config.period ?? DEFAULTS.period)
  })
}

export function parseTotpInput(input) {
  return {
    secret: parseBase32Secret(input).base32,
    ...DEFAULTS
  }
}

export function generateTotp(config, timestamp = Date.now()) {
  return createTotp(config).generate({ timestamp: normalizeTimestamp(timestamp) })
}

export function getSecondsRemaining(timestamp = Date.now(), period = DEFAULTS.period) {
  const periodMs = normalizePeriod(period) * 1000
  const elapsed = ((normalizeTimestamp(timestamp) % periodMs) + periodMs) % periodMs
  return Math.ceil((periodMs - elapsed) / 1000)
}

export default {
  id: 'totp',
  name: '2FA 验证码',
  description: '输入 Base32 密钥，在浏览器本地生成 TOTP 动态验证码',
  category: 'crypto',
  icon: 'hmac',
  keywords: ['2fa', 'totp', 'otp', 'authenticator', '动态口令'],
  render(container) {
    let currentConfig = null
    let timer = null
    let observer = null
    let destroyed = false

    const secretInput = createElement('input', {
      id: 'totp-secret',
      className: 'input',
      type: 'text',
      placeholder: '粘贴 Base32 密钥',
      autocomplete: 'off',
      spellcheck: false
    })
    const errorText = createElement('div', {
      id: 'totp-input-error',
      className: 'error-text',
      role: 'alert'
    })
    secretInput.setAttribute('aria-describedby', errorText.id)

    const getCodeButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'submit',
      textContent: '获取验证码'
    })
    const form = createElement('form', { className: 'tool-stack' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', htmlFor: secretInput.id, textContent: 'Base32 密钥' }),
        secretInput,
        errorText
      ]),
      getCodeButton
    ])

    const codeValue = createElement('div', {
      className: 'totp-code',
      textContent: '------',
      'aria-label': '当前验证码'
    })
    const countdown = createElement('div', {
      className: 'totp-countdown',
      textContent: '等待输入密钥'
    })
    const copyButton = createCopyButton(() => {
      if (!currentConfig) return ''
      const timestamp = Date.now()
      const token = generateTotp(currentConfig, timestamp)
      updateCode(timestamp, token)
      return token
    })
    copyButton.disabled = true
    const codeSection = createSection(
      '当前验证码',
      createElement('div', { className: 'totp-code-panel' }, [codeValue, countdown]),
      [copyButton]
    )

    const privacyNotice = createElement('p', {
      className: 'privacy-notice',
      textContent: '密钥和验证码只在浏览器本地处理，不上传、不保存。'
    })

    function stopTimer() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    function clearResult(message = '等待输入密钥') {
      currentConfig = null
      stopTimer()
      codeValue.textContent = '------'
      countdown.textContent = message
      copyButton.disabled = true
    }

    function updateCode(timestamp = Date.now(), token = generateTotp(currentConfig, timestamp)) {
      if (!currentConfig) return
      codeValue.textContent = token
      countdown.textContent = `剩余 ${getSecondsRemaining(timestamp, currentConfig.period)} 秒`
    }

    function scheduleUpdate() {
      if (destroyed || !currentConfig) return
      const delay = 1000 - (Date.now() % 1000)
      timer = setTimeout(() => {
        timer = null
        if (!container.isConnected) {
          cleanup()
          return
        }
        updateCode()
        scheduleUpdate()
      }, delay)
    }

    function cleanup() {
      if (destroyed) return
      destroyed = true
      stopTimer()
      observer?.disconnect()
      observer = null
      container.removeEventListener('DOMNodeRemoved', handleNodeRemoval)
    }

    function handleNodeRemoval(event) {
      if (event.target === container || !container.isConnected) cleanup()
    }

    function generateCode() {
      try {
        const config = parseTotpInput(secretInput.value)
        currentConfig = config
        errorText.textContent = ''
        copyButton.disabled = false
        updateCode()
        stopTimer()
        scheduleUpdate()
      } catch (error) {
        clearResult(secretInput.value.trim() ? '点击获取验证码' : '等待输入密钥')
        errorText.textContent = error instanceof Error ? error.message : '无法生成验证码'
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault()
      generateCode()
    })
    secretInput.addEventListener('input', () => {
      errorText.textContent = ''
      clearResult(secretInput.value.trim() ? '点击获取验证码' : '等待输入密钥')
    })

    container.append(form, codeSection, privacyNotice)
    container.addEventListener('DOMNodeRemoved', handleNodeRemoval)
    observer = globalThis.MutationObserver
      ? new globalThis.MutationObserver(() => {
        if (!container.isConnected) cleanup()
      })
      : null
    if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true })
  }
}
