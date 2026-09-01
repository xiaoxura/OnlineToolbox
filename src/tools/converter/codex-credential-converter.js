import icons from '../../icons.js'
import { createCopyButton, createElement, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import { downloadText } from '../../utils/download.js'

export const AUTH_JSON = 'auth-json'
export const CLIPROXYAPI = 'cliproxyapi'
export const SUB2API = 'sub2api'

export const CREDENTIAL_FORMATS = Object.freeze({
  AUTH_JSON,
  CLIPROXYAPI,
  SUB2API
})
export const TARGET_FORMATS = CREDENTIAL_FORMATS

const AUTH_JSON_SOURCE_ERROR = 'auth.json 仅支持作为输出格式，凭证信息不可逆，无法反向转换为 CPA / CLIProxyAPI 或 Sub2API'

const CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const OPENAI_AUTH_CLAIM = 'https://api.openai.com/auth'
const OPENAI_PROFILE_CLAIM = 'https://api.openai.com/profile'
const SUB2API_PLATFORMS = new Set(['openai', 'codex', 'chatgpt', 'openai-codex'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

async function readFileAsText(file) {
  if (typeof file?.text === 'function') return file.text()
  if (typeof file?.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer()
    return new TextDecoder('utf-8').decode(buffer)
  }
  if (typeof FileReader !== 'function') throw new Error('当前环境不支持读取文件')

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result ?? '')
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function valueAt(object, paths) {
  for (const path of paths) {
    let value = object
    for (const key of path) {
      if (!isObject(value) || !Object.hasOwn(value, key)) {
        value = undefined
        break
      }
      value = value[key]
    }
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function textValue(value) {
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number') return String(value)
  return undefined
}

function tokenValue(object, names) {
  return textValue(valueAt(object, names.flatMap(name => [
    [name],
    ['credentials', name],
    ['tokens', name],
    ['credentials', 'tokens', name]
  ])))
}

function nestedValue(object, containers, names) {
  const prefixes = [
    [],
    ['credentials'],
    ['tokens'],
    ['credentials', 'tokens']
  ]
  return textValue(valueAt(object, prefixes.flatMap(prefix => containers.flatMap(container => names.map(name => [
    ...prefix,
    container,
    name
  ])))))
}

function fieldValue(object, names) {
  return textValue(valueAt(object, names.flatMap(name => [
    [name],
    ['credentials', name],
    ['tokens', name],
    ['credentials', 'tokens', name]
  ])))
}

const EXPIRATION_FIELD_NAMES = ['expires_at', 'expiresAt', 'expires', 'expiry']
const TOKEN_EXPIRATION_FIELD_NAMES = [...EXPIRATION_FIELD_NAMES, 'expired']

function expirationValueForSource(account, sourceFormat) {
  if (sourceFormat === SUB2API) {
    return valueAt(account, [
      ...[['credentials'], ['credentials', 'tokens']].flatMap(prefix => TOKEN_EXPIRATION_FIELD_NAMES.map(name => [
        ...prefix,
        name
      ]))
    ])
  }

  if (sourceFormat === CLIPROXYAPI) {
    return valueAt(account, EXPIRATION_FIELD_NAMES.concat('expired').map(name => [name]))
  }

  const explicitExpiresAt = valueAt(account, EXPIRATION_FIELD_NAMES.flatMap(name => [
    [name],
    ['credentials', name],
    ['tokens', name],
    ['credentials', 'tokens', name]
  ]))
  const cliProxyExpiresAt = valueAt(account, [
    ['expired'],
    ['credentials', 'expired'],
    ['tokens', 'expired'],
    ['credentials', 'tokens', 'expired']
  ])
  return explicitExpiresAt ?? cliProxyExpiresAt
}

function normalizeTime(value, label, warnings) {
  if (value === undefined || value === null || value === '') return undefined
  let milliseconds
  if (typeof value === 'number' && Number.isFinite(value)) {
    milliseconds = Math.abs(value) < 100000000000 ? value * 1000 : value
  } else if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && /^[-+]?\d+(?:\.\d+)?$/.test(value.trim())) {
      milliseconds = Math.abs(numeric) < 100000000000 ? numeric * 1000 : numeric
    } else {
      milliseconds = Date.parse(value)
    }
  }
  if (!Number.isFinite(milliseconds)) {
    warnings.push(`${label} 无法识别，已忽略`)
    return undefined
  }
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) {
    warnings.push(`${label} 无法识别，已忽略`)
    return undefined
  }
  return date.toISOString()
}

// JWT data is only used as a convenience fallback. No signature verification is attempted.
export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2 || !parts[1]) return null
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return null
  try {
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const value = JSON.parse(decoded)
    return isObject(value) ? value : null
  } catch {
    return null
  }
}

function claimValue(claims, names) {
  const auth = isObject(claims?.[OPENAI_AUTH_CLAIM]) ? claims[OPENAI_AUTH_CLAIM] : {}
  const profile = isObject(claims?.[OPENAI_PROFILE_CLAIM]) ? claims[OPENAI_PROFILE_CLAIM] : {}
  for (const namespace of [claims, profile, auth]) {
    const value = textValue(valueAt(namespace, names.map(name => [name])))
    if (value) return value
  }
  return undefined
}

function jwtOrganizationValue(claims) {
  const auth = isObject(claims?.[OPENAI_AUTH_CLAIM]) ? claims[OPENAI_AUTH_CLAIM] : {}
  return textValue(valueAt(auth, [['poid']]))
    || claimValue(claims, ['organization_id', 'org_id'])
    || undefined
}

function jwtOrganizationFallback(readable) {
  const poid = readable.map(claims => {
    const auth = isObject(claims?.[OPENAI_AUTH_CLAIM]) ? claims[OPENAI_AUTH_CLAIM] : {}
    return textValue(valueAt(auth, [['poid']]))
  }).find(Boolean)
  if (poid) return poid

  const explicit = readable.map(claims => jwtOrganizationValue(claims)).find(Boolean)
  if (explicit) return explicit

  const organizations = readable.flatMap(claims => {
    const auth = isObject(claims?.[OPENAI_AUTH_CLAIM]) ? claims[OPENAI_AUTH_CLAIM] : {}
    const value = Array.isArray(auth.organizations)
      ? auth.organizations
      : Array.isArray(claims.organizations) ? claims.organizations : []
    return value.filter(isObject)
  })
  const defaultOrganization = organizations.find(organization => organization.is_default === true)
  return textValue(defaultOrganization?.id) || textValue(organizations[0]?.id)
}

function jwtFallback(account, warnings) {
  const payloads = [account.idToken, account.accessToken]
    .map(token => ({ token, payload: decodeJwtPayload(token) }))
  for (const item of payloads) {
    if (item.token?.split('.').length >= 3 && !item.payload) warnings.push('部分 JWT 无法解码，已保留显式凭证字段')
  }
  const readable = payloads.map(item => item.payload).filter(Boolean)
  const fallback = names => {
    for (const claims of readable) {
      const value = claimValue(claims, names)
      if (value) return value
    }
    return undefined
  }
  const exp = readable.map(claims => claims.exp).find(value => value !== undefined)
  return {
    email: fallback(['email', 'preferred_username']),
    accountId: fallback(['account_id', 'chatgpt_account_id']),
    userId: fallback(['user_id', 'chatgpt_user_id', 'sub']),
    planType: fallback(['plan_type', 'chatgpt_plan_type', 'plan']),
    organizationId: jwtOrganizationFallback(readable),
    expiresAt: exp
  }
}

export function normalizeCredential(source, warnings = [], sourceFormat) {
  const account = isObject(source) ? source : {}
  const accessToken = tokenValue(account, ['access_token', 'accessToken', 'token'])
  const refreshToken = tokenValue(account, ['refresh_token', 'refreshToken'])
  const idToken = tokenValue(account, ['id_token', 'idToken'])
  const expirationValue = expirationValueForSource(account, sourceFormat)
  const accountId = fieldValue(account, ['account_id', 'accountId', 'chatgpt_account_id', 'chatgptAccountId'])
    || nestedValue(account, ['account'], ['id', 'account_id', 'accountId', 'chatgpt_account_id', 'chatgptAccountId'])
    || fieldValue(account, ['account'])
  const userId = fieldValue(account, ['user_id', 'userId', 'chatgpt_user_id', 'chatgptUserId'])
    || nestedValue(account, ['user'], ['id', 'user_id', 'userId', 'chatgpt_user_id', 'chatgptUserId'])
    || fieldValue(account, ['user'])
  const planType = fieldValue(account, ['plan_type', 'planType', 'chatgpt_plan_type', 'chatgptPlanType'])
    || nestedValue(account, ['account'], ['plan_type', 'planType', 'chatgpt_plan_type', 'chatgptPlanType', 'plan'])
  const organizationId = fieldValue(account, ['organization_id', 'organizationId', 'org_id', 'orgId'])
    || nestedValue(account, ['account', 'organization', 'org'], ['id', 'organization_id', 'organizationId', 'org_id', 'orgId'])
    || fieldValue(account, ['organization', 'org'])
  const normalized = {
    name: fieldValue(account, ['name', 'display_name', 'displayName']),
    email: fieldValue(account, ['email', 'user_email', 'userEmail']) || nestedValue(account, ['user'], ['email']),
    accessToken,
    refreshToken,
    idToken,
    accountId,
    lastRefresh: normalizeTime(valueAt(account, [
      ...['last_refresh', 'lastRefresh'].flatMap(name => [
        [name],
        ['credentials', name],
        ['tokens', name],
        ['credentials', 'tokens', name]
      ])
    ]), '最后刷新时间', warnings),
    expiresAt: normalizeTime(expirationValue, '过期时间', warnings),
    userId,
    planType,
    organizationId,
    clientId: fieldValue(account, ['client_id', 'clientId'])
  }

  const decoded = jwtFallback(normalized, warnings)
  normalized.email ||= decoded.email
  normalized.accountId ||= decoded.accountId
  normalized.userId ||= decoded.userId
  normalized.planType ||= decoded.planType
  normalized.organizationId ||= decoded.organizationId
  if (!normalized.expiresAt && decoded.expiresAt !== undefined) {
    normalized.expiresAt = normalizeTime(decoded.expiresAt, 'JWT 过期时间', warnings)
  }
  normalized.name ||= normalized.email || normalized.accountId || 'Codex OAuth 账户'
  return normalized
}

function hasTokenShape(value) {
  return isObject(value) && [
    'access_token', 'accessToken', 'token', 'refresh_token', 'refreshToken', 'id_token', 'idToken', 'tokens', 'credentials'
  ].some(key => Object.hasOwn(value, key))
}

function containsAuthJsonSource(source) {
  const seen = new WeakSet()

  function inspect(value) {
    if (!isObject(value) && !Array.isArray(value)) return false
    if (seen.has(value)) return false
    seen.add(value)

    if (isObject(value) && Object.hasOwn(value, 'OPENAI_API_KEY')) return true

    if (Array.isArray(value)) {
      return value.some(entry => inspect(entry) || (isObject(entry) && inspect(entry.credentials)))
    }

    return inspect(value.data)
      || inspect(value.credentials)
      || (Array.isArray(value.accounts) && inspect(value.accounts))
  }

  return inspect(source)
}

function sub2ApiEvidence(account) {
  if (!isObject(account) || !hasTokenShape(account)) return false
  const platform = textValue(account.platform)?.toLowerCase()
  const type = textValue(account.type)?.toLowerCase()
  const hasNonEmptyPlatform = account.platform !== undefined
    && account.platform !== null
    && !(typeof account.platform === 'string' && account.platform.trim() === '')
  if (hasNonEmptyPlatform && !SUB2API_PLATFORMS.has(platform)) return false
  const explicitPlatform = SUB2API_PLATFORMS.has(platform)
  const codexType = ['codex', 'openai', 'chatgpt'].includes(type)
  const oauthType = !type || type === 'oauth' || codexType
  const oauthWithCodexEvidence = type === 'oauth' && Boolean(fieldValue(account, [
    'chatgpt_account_id', 'chatgptAccountId', 'chatgpt_user_id', 'chatgptUserId'
  ]) || nestedValue(account, ['account'], ['id', 'account_id', 'accountId', 'chatgpt_account_id', 'chatgptAccountId']))
  const knownClient = fieldValue(account, ['client_id', 'clientId']) === CODEX_OAUTH_CLIENT_ID
  const accountIdEvidence = Boolean(fieldValue(account, [
    'account_id', 'accountId', 'chatgpt_account_id', 'chatgptAccountId'
  ]) || nestedValue(account, ['account'], ['id', 'account_id', 'accountId', 'chatgpt_account_id', 'chatgptAccountId']))
  return oauthType && (explicitPlatform || codexType || oauthWithCodexEvidence || knownClient || accountIdEvidence)
}

function cliProxyApiEvidence(entry) {
  if (!hasTokenShape(entry)) return false
  if (!Object.hasOwn(entry, 'type')) return true
  return textValue(entry.type)?.toLowerCase() === 'codex'
}

function parseObjectInput(input) {
  if (typeof input === 'string') {
    const text = input.replace(/^\uFEFF/, '').trim()
    if (!text) throw new Error('请输入 JSON 凭证')
    try {
      return JSON.parse(text)
    } catch (error) {
      throw new Error(`JSON 解析失败：${error.message}`)
    }
  }
  if (isObject(input) || Array.isArray(input)) return input
  throw new Error('输入必须是 JSON 对象或数组')
}

// Parse without any DOM dependency so callers can validate or convert imported data safely.
export function parseCredentialSource(input) {
  const source = parseObjectInput(input)
  const warnings = []
  let format
  let entries

  if (containsAuthJsonSource(source)) {
    throw new Error(AUTH_JSON_SOURCE_ERROR)
  } else if (isObject(source) && Array.isArray(source.data?.accounts)) {
    format = SUB2API
    entries = source.data.accounts
  } else if (isObject(source) && Array.isArray(source.accounts)) {
    format = SUB2API
    entries = source.accounts
  } else if (Array.isArray(source)) {
    format = CLIPROXYAPI
    entries = source
  } else if (hasTokenShape(source)) {
    format = CLIPROXYAPI
    entries = [source]
  } else {
    throw new Error('无法识别凭证格式：需要 CPA / CLIProxyAPI 或 Sub2API DataPayload JSON')
  }

  let accepted = entries
  if (format === SUB2API) {
    const rejected = entries.filter(entry => !sub2ApiEvidence(entry))
    accepted = entries.filter(sub2ApiEvidence)
    if (rejected.length) warnings.push(`已忽略 ${rejected.length} 个非 OpenAI/Codex OAuth 账户或无效条目`)
  } else if (format === CLIPROXYAPI) {
    const rejected = entries.filter(entry => !cliProxyApiEvidence(entry))
    accepted = entries.filter(cliProxyApiEvidence)
    if (rejected.length) warnings.push(`已忽略 ${rejected.length} 个非 Codex 或不含凭证字段的 CPA / CLIProxyAPI 条目`)
  }

  if (!accepted.length) {
    throw new Error(format === SUB2API ? '未发现可识别的 OpenAI/Codex OAuth 账户' : '未发现可识别的凭证条目')
  }
  const accounts = accepted.map(entry => normalizeCredential(entry, warnings, format))
  return { format, sourceFormat: format, accounts, warnings }
}

function requireAccessToken(account) {
  if (!account?.accessToken) throw new Error('缺少 Access Token (AT)，无法转换')
}

function asNow(now) {
  if (now instanceof Date) return now.getTime()
  const value = typeof now === 'number' ? now : Date.parse(now || new Date().toISOString())
  return Number.isFinite(value) ? value : Date.now()
}

function objectWithOptional(base, entries) {
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== '') base[key] = value
  }
  return base
}

function sub2ApiAccountName(account) {
  const name = textValue(account?.name)
    || textValue(account?.email)
    || textValue(account?.accountId)
    || 'Codex OAuth 账户'
  return Array.from(name).slice(0, 100).join('')
}

export function convertCredential(account, target, options = {}) {
  requireAccessToken(account)
  if (![AUTH_JSON, CLIPROXYAPI, SUB2API].includes(target)) throw new Error('未知的目标格式')

  if (target === AUTH_JSON) {
    return objectWithOptional({
      OPENAI_API_KEY: null,
      tokens: objectWithOptional({}, [
        ['id_token', account.idToken],
        ['access_token', account.accessToken],
        ['refresh_token', account.refreshToken],
        ['account_id', account.accountId]
      ])
    }, [['last_refresh', account.lastRefresh]])
  }

  if (target === CLIPROXYAPI) {
    return objectWithOptional({}, [
      ['id_token', account.idToken],
      ['access_token', account.accessToken],
      ['refresh_token', account.refreshToken],
      ['account_id', account.accountId],
      ['last_refresh', account.lastRefresh],
      ['email', account.email],
      ['type', 'codex'],
      ['expired', account.expiresAt]
    ])
  }

  const credentials = objectWithOptional({ access_token: account.accessToken }, [
    ['refresh_token', account.refreshToken],
    ['id_token', account.idToken],
    ['chatgpt_account_id', account.accountId],
    ['email', account.email],
    ['expires_at', account.expiresAt],
    ['chatgpt_user_id', account.userId],
    ['plan_type', account.planType],
    ['organization_id', account.organizationId]
  ])
  if (account.refreshToken) credentials.client_id = account.clientId || CODEX_OAUTH_CLIENT_ID
  return {
    type: 'sub2api-data',
    version: 1,
    exported_at: new Date(asNow(options.now)).toISOString(),
    proxies: [],
    accounts: [{
      name: sub2ApiAccountName(account),
      platform: 'openai',
      type: 'oauth',
      credentials,
      concurrency: 1,
      priority: 0
    }]
  }
}

function sourceFormatLabel(format) {
  return {
    [CLIPROXYAPI]: 'CPA',
    [SUB2API]: 'Sub2API'
  }[format] || '未知格式'
}

function targetsForSource(format) {
  if (format === CLIPROXYAPI) return [SUB2API, AUTH_JSON]
  if (format === SUB2API) return [CLIPROXYAPI, AUTH_JSON]
  return []
}

function credentialFileLabel(format) {
  return {
    [AUTH_JSON]: 'auth.json',
    [CLIPROXYAPI]: 'CPA 凭证文件',
    [SUB2API]: 'Sub2API 凭证文件'
  }[format] || 'JSON'
}

function targetOptionLabel(sourceFormat, targetFormat) {
  return `${sourceFormatLabel(sourceFormat)} -> ${credentialFileLabel(targetFormat)}`
}

function safeFilenamePart(value) {
  const cleaned = String(value || 'credential')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'credential'
}

function filenameFor(target, account) {
  if (target === AUTH_JSON) return 'auth.json'
  const identity = safeFilenamePart(account.email || account.accountId)
  if (target === CLIPROXYAPI) return `codex-${identity}.json`

  const now = new Date()
  const twoDigits = value => String(value).padStart(2, '0')
  const timestamp = `${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}`
  return `sub2api-account-${timestamp}.json`
}

function setCopyLabel(button, label) {
  button.title = label
  button.setAttribute('aria-label', label)
  return button
}

function detailRow(label, getValue) {
  const value = getValue()
  const copy = setCopyLabel(createCopyButton(() => value || ''), `复制${label}`)
  if (!value) copy.disabled = true
  return createElement('div', { className: 'credential-detail-row' }, [
    createElement('span', { className: 'credential-detail-label', textContent: label }),
    createElement('code', { className: 'credential-detail-value', textContent: value || '未提供' }),
    copy
  ])
}

export default {
  id: 'codex-credential-converter',
  name: 'CPA ↔ Sub2API 凭证转换',
  description: 'CPA ↔ Sub2API，二者均可导出 auth.json',
  category: 'converter',
  icon: 'json-yaml',

  render(container) {
    let parsed = null
    let selectedIndex = 0
    let target = null
    let readVersion = 0

    const input = createElement('textarea', {
      className: 'textarea credential-input',
      rows: 14,
      placeholder: '粘贴 CPA / CLIProxyAPI 或 Sub2API DataPayload 的 JSON…',
      'aria-label': '凭证 JSON 输入'
    })
    const fileInput = createElement('input', {
      id: 'credential-json-file',
      type: 'file',
      accept: '.json,application/json',
      hidden: true,
      'aria-label': '选择 JSON 凭证文件'
    })
    const fileButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '选择 JSON 文件',
      onClick: () => {
        fileInput.value = ''
        invalidateState('输入已更改，请重新解析')
        fileInput.click()
      }
    })
    const parseButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '解析并转换'
    })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空'
    })
    const status = createElement('p', {
      className: 'credential-source-status',
      role: 'status',
      'aria-live': 'polite',
      textContent: '等待输入 JSON 凭证'
    })
    const error = createElement('div', { className: 'error-text' })
    const warnings = createElement('ul', { className: 'credential-warnings', 'aria-live': 'polite' })
    const accountSelect = createElement('select', { className: 'select', 'aria-label': '选择账户' })
    const accountGroup = createElement('div', { className: 'form-group credential-account-picker', hidden: true }, [
      createElement('label', { className: 'label', textContent: '选择账户' }),
      accountSelect
    ])
    const targetSelect = createElement('select', {
      className: 'select',
      'data-role': 'target-select',
      'aria-label': '选择导出凭证文件',
      disabled: true
    })
    const details = createElement('div', { className: 'credential-details', hidden: true })
    const output = createElement('textarea', {
      className: 'textarea large credential-output-text',
      rows: 15,
      readOnly: true,
      placeholder: '转换后的 JSON 将显示在这里…',
      'aria-label': '转换后的 JSON 输出'
    })
    const copyOutput = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      innerHTML: `${icons.copy}<span>复制完整 JSON</span>`,
      'aria-label': '复制完整 JSON',
      title: '复制完整 JSON',
      disabled: true
    })
    const downloadOutput = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      innerHTML: `${icons.download}<span>导出 JSON</span>`,
      'aria-label': '导出 JSON',
      title: '导出 JSON',
      disabled: true
    })
    const outputTitle = createElement('h2', { id: 'credential-output-title', textContent: '转换结果' })
    const outputSection = createElement('section', {
      className: 'credential-output',
      'aria-labelledby': 'credential-output-title'
    }, [
      createElement('div', { className: 'credential-output-header' }, [
        outputTitle,
        createElement('div', { className: 'btn-group' }, [copyOutput, downloadOutput])
      ]),
      createElement('div', { className: 'credential-output-body' }, [output])
    ])

    const inputSection = createSection('输入凭证', createElement('div', { className: 'tool-stack' }, [
      input,
      fileInput,
      createElement('div', { className: 'btn-group' }, [fileButton, parseButton, clearButton]),
      status,
      error,
      warnings
    ]))
    const controls = createElement('div', { className: 'credential-controls', hidden: true }, [
      accountGroup,
      createElement('div', { className: 'form-group credential-target-picker' }, [
        createElement('label', { className: 'label', textContent: '导出为' }),
        targetSelect
      ])
    ])
    const detailSection = createSection('凭证详情', details)
    detailSection.hidden = true
    const root = createElement('div', { className: 'tool-stack credential-converter' }, [
      inputSection,
      controls,
      detailSection,
      outputSection
    ])
    container.appendChild(root)

    function clearFeedback() {
      error.textContent = ''
      warnings.replaceChildren()
    }

    function setOutputActionsEnabled(enabled) {
      const outputTarget = enabled ? target : null
      const targetFile = outputTarget ? credentialFileLabel(outputTarget) : null
      const downloadLabel = targetFile ? `导出 ${targetFile}` : '导出 JSON'
      copyOutput.disabled = !enabled
      downloadOutput.disabled = !enabled
      downloadOutput.querySelector('span').textContent = downloadLabel
      downloadOutput.title = downloadLabel
      downloadOutput.setAttribute('aria-label', downloadLabel)
      outputTitle.textContent = targetFile || '转换结果'
      output.setAttribute('aria-label', targetFile ? `${targetFile} JSON 输出` : '转换后的 JSON 输出')
    }

    function clearDetails() {
      details.replaceChildren()
      details.hidden = true
      detailSection.hidden = true
    }

    function resetTargetOptions() {
      target = null
      targetSelect.replaceChildren()
      targetSelect.disabled = true
    }

    function configureTargetOptions(sourceFormat) {
      const targets = targetsForSource(sourceFormat)
      target = targets[0] || null
      targetSelect.replaceChildren(...targets.map(format => createElement('option', {
        value: format,
        textContent: targetOptionLabel(sourceFormat, format)
      })))
      targetSelect.disabled = !target
      if (target) targetSelect.value = target
    }

    function invalidateState(statusText = '输入已更改，请重新解析') {
      readVersion += 1
      parsed = null
      selectedIndex = 0
      resetTargetOptions()
      accountSelect.replaceChildren()
      accountGroup.hidden = true
      controls.hidden = true
      clearDetails()
      output.value = ''
      setOutputActionsEnabled(false)
      clearFeedback()
      status.textContent = statusText
      return readVersion
    }

    function showWarnings(items) {
      warnings.replaceChildren(...items.map(item => createElement('li', { textContent: item })))
    }

    function selectedAccount() {
      return parsed?.accounts[selectedIndex]
    }

    function renderDetails(account) {
      details.replaceChildren(
        detailRow('Email', () => account.email),
        detailRow('Access Token (AT)', () => account.accessToken),
        detailRow('Refresh Token (RT)', () => account.refreshToken),
        detailRow('Account ID', () => account.accountId),
        detailRow('过期时间', () => account.expiresAt)
      )
      details.hidden = false
      detailSection.hidden = false
    }

    function renderOutput() {
      const account = selectedAccount()
      if (!account || !target || !targetsForSource(parsed?.format).includes(target)) {
        clearDetails()
        output.value = ''
        setOutputActionsEnabled(false)
        return
      }
      let outputGenerated = false
      try {
        output.value = JSON.stringify(convertCredential(account, target), null, 2)
        error.textContent = ''
        setOutputActionsEnabled(true)
        outputGenerated = true
      } catch (cause) {
        output.value = ''
        error.textContent = cause.message
        setOutputActionsEnabled(false)
      }
      renderDetails(account)
      const accountCount = parsed.accounts.length
      if (outputGenerated) {
        const accountMessage = accountCount > 1
          ? `；将导出当前选中的第 ${selectedIndex + 1} 个账户`
          : '；将导出当前账户'
        status.textContent = `${sourceFormatLabel(parsed.format)} -> ${credentialFileLabel(target)}，已识别 ${accountCount} 个账户${accountMessage}`
      } else {
        status.textContent = `${sourceFormatLabel(parsed.format)} -> ${credentialFileLabel(target)}，已识别 ${accountCount} 个账户；当前账户无法导出`
      }
    }

    function renderAccounts() {
      accountSelect.replaceChildren(...parsed.accounts.map((account, index) => createElement('option', {
        value: String(index),
        textContent: `${account.name}${account.email ? ` (${account.email})` : ''}`
      })))
      accountSelect.value = String(selectedIndex)
      configureTargetOptions(parsed.format)
      accountGroup.hidden = parsed.accounts.length < 2
      controls.hidden = false
      showWarnings(parsed.warnings)
      renderOutput()
    }

    function parseInput() {
      invalidateState('正在解析凭证…')
      try {
        parsed = parseCredentialSource(input.value)
        selectedIndex = 0
        renderAccounts()
      } catch (cause) {
        parsed = null
        resetTargetOptions()
        controls.hidden = true
        detailSection.hidden = true
        details.hidden = true
        output.value = ''
        setOutputActionsEnabled(false)
        status.textContent = '未能识别凭证'
        error.textContent = cause.message
      }
    }

    input.addEventListener('input', () => invalidateState('输入已更改，请重新解析'))
    parseButton.addEventListener('click', parseInput)
    clearButton.addEventListener('click', () => {
      invalidateState('等待输入 JSON 凭证')
      input.value = ''
      fileInput.value = ''
    })
    fileInput.addEventListener('change', async () => {
      const currentRead = invalidateState('输入已更改，请重新解析')
      const file = fileInput.files?.[0]
      fileInput.value = ''
      if (!file) {
        status.textContent = '未选择 JSON 文件'
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        status.textContent = '文件过大，无法读取'
        error.textContent = 'JSON 文件不能超过 10 MiB'
        return
      }
      status.textContent = `正在读取 ${file.name}…`
      try {
        const content = (await readFileAsText(file)).replace(/^\uFEFF/, '')
        if (currentRead !== readVersion) return
        input.value = content
        parseInput()
      } catch {
        if (currentRead !== readVersion) return
        status.textContent = '文件读取失败'
        error.textContent = '无法读取该 JSON 文件，请确认文件编码和权限'
      }
    })
    accountSelect.addEventListener('change', () => {
      const nextIndex = Number(accountSelect.value)
      selectedIndex = Number.isInteger(nextIndex)
        && String(nextIndex) === accountSelect.value
        && nextIndex >= 0
        && nextIndex < (parsed?.accounts?.length || 0)
        ? nextIndex
        : -1
      renderOutput()
    })
    targetSelect.addEventListener('change', () => {
      const selectedTarget = targetSelect.value
      if (!targetsForSource(parsed?.format).includes(selectedTarget)) {
        resetTargetOptions()
        renderOutput()
        return
      }
      target = selectedTarget
      renderOutput()
    })
    copyOutput.addEventListener('click', () => {
      if (!output.value) return
      copyToClipboard(output.value)
    })
    downloadOutput.addEventListener('click', () => {
      const account = selectedAccount()
      if (!account || !output.value) return
      downloadText(filenameFor(target, account), output.value, 'application/json;charset=utf-8')
    })
  }
}
