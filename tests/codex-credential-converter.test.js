import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import tool, {
  AUTH_JSON,
  convertCredential,
  decodeJwtPayload,
  parseCredentialSource
} from '../src/tools/converter/codex-credential-converter.js'

const PUBLIC_CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const EXPORTED_AT = '2026-01-02T03:04:05.000Z'
const JWT_EXPIRY_SECONDS = 1_800_000_000
const JWT_EXPIRY_MS = JWT_EXPIRY_SECONDS * 1000

function base64Url(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function makeUnsignedJwt(payload) {
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.`
}

function parsedAccounts(result) {
  if (Array.isArray(result)) return result
  return result?.accounts || result?.data?.accounts || []
}

function parsedWarnings(result) {
  const warnings = result?.warnings ?? result?.warning ?? []
  return Array.isArray(warnings) ? warnings : warnings ? [warnings] : []
}

function parsedFormat(result) {
  return result?.format ?? result?.sourceFormat ?? result?.source ?? result?.kind
}

function warningText(result) {
  return JSON.stringify(parsedWarnings(result)).toLowerCase()
}

function firstDefined(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) return object[key]
  }
  return undefined
}

function accountValue(account, field) {
  const aliases = {
    name: ['name', 'label'],
    email: ['email'],
    access: ['accessToken', 'access_token'],
    refresh: ['refreshToken', 'refresh_token'],
    account: ['accountId', 'account_id', 'chatgptAccountId', 'chatgpt_account_id'],
    user: ['userId', 'user_id', 'chatgptUserId', 'chatgpt_user_id'],
    plan: ['planType', 'plan_type', 'chatgptPlanType', 'chatgpt_plan_type'],
    organization: ['organizationId', 'organization_id', 'organization', 'poid'],
    expiry: ['expiresAt', 'expires_at', 'expired', 'expiry']
  }
  return firstDefined(account, aliases[field] || [field])
}

function asObject(value) {
  if (typeof value === 'string') return JSON.parse(value)
  return value
}

function epochMilliseconds(value) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) < 100_000_000_000 ? value * 1000 : value
  }
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/u.test(value.trim())) {
    return epochMilliseconds(Number(value))
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? NaN : parsed
}

function expectEpoch(value, expectedMilliseconds) {
  expect(epochMilliseconds(value)).toBe(expectedMilliseconds)
}

function makeSub2ApiAccount({
  name,
  email,
  accessToken,
  refreshToken,
  expiresAt,
  platform = 'openai',
  type = 'oauth',
  credentials = {}
}) {
  return {
    id: `${name}-id`,
    name,
    platform,
    type,
    credentials: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      email,
      ...credentials
    }
  }
}

const snakeAccount = makeSub2ApiAccount({
  name: 'snake-account',
  email: 'snake@example.com',
  accessToken: 'at-snake',
  refreshToken: 'rt-snake',
  expiresAt: 1_700_000_000
})

const camelNestedAccount = {
  id: 'camel-account-id',
  name: 'camel-account',
  email: 'camel@example.com',
  platform: 'openai',
  type: 'oauth',
  credentials: {
    tokens: {
      accessToken: 'at-camel',
      refreshToken: 'rt-camel',
      expiresAt: '2023-11-14T22:13:20.000Z'
    },
    expiresAt: '2023-11-14T22:13:20.000Z'
  }
}

const nonOpenAiAccount = makeSub2ApiAccount({
  name: 'other-provider',
  email: 'other@example.com',
  accessToken: 'at-other',
  refreshToken: 'rt-other',
  expiresAt: 1_700_000_000,
  platform: 'anthropic'
})

const sub2ApiSource = {
  exported_at: EXPORTED_AT,
  proxies: [],
  accounts: [snakeAccount, camelNestedAccount, nonOpenAiAccount]
}

const cliProxyApiSource = {
  email: 'cli@example.com',
  access_token: 'cli-access',
  refresh_token: 'cli-refresh',
  expired: '2023-11-14T22:13:21.000Z',
  type: 'codex',
  account_id: 'cli-account'
}

const authJsonSource = {
  OPENAI_API_KEY: null,
  tokens: {
    access_token: 'auth-at',
    refresh_token: 'auth-rt',
    account_id: 'auth-account',
    id_token: 'auth-id-token'
  }
}

const jwtPayload = {
  'https://api.openai.com/auth': {
    chatgpt_account_id: 'jwt-account',
    chatgpt_user_id: 'jwt-user',
    chatgpt_plan_type: 'pro',
    organization_id: 'jwt-organization',
    poid: 'jwt-organization',
    organizations: [{ id: 'jwt-organization', is_default: true }]
  },
  'https://api.openai.com/profile': {
    email: 'jwt@example.com'
  },
  exp: JWT_EXPIRY_SECONDS
}

const jwtAccessToken = makeUnsignedJwt(jwtPayload)

function inputElement(root) {
  return root.querySelector('[data-role="credential-input"], [data-role="source-input"], textarea:not([readonly])')
}

function fileElement(root) {
  return root.querySelector('[data-role="credential-file"], [data-role="file-input"], input[type="file"]')
}

function primaryButton(root) {
  return root.querySelector('[data-role="parse"], [data-role="convert"], [data-role="primary-action"]')
    || [...root.querySelectorAll('button')].find(button => /parse|convert|import|解析|转换|导入/iu.test(button.textContent))
    || root.querySelector('.btn-primary')
}

function outputElements(root) {
  return [...root.querySelectorAll(
    '[data-role="result-output"], [data-role="output"], textarea[readonly], pre'
  )]
}

function resultText(root) {
  const visibleDetails = root.querySelectorAll('.credential-details:not([hidden])')
  return [
    ...outputElements(root).map(element => element.value ?? element.textContent ?? ''),
    ...[...visibleDetails].map(element => element.textContent || '')
  ].join('\n')
}

function errorElement(root) {
  return root.querySelector('[data-role="error"], .error-text, [role="alert"]')
}

function controlByRole(root, role, fallback) {
  return root.querySelector(`[data-role="${role}"]`) || root.querySelector(fallback)
}

function accountSelect(root) {
  return controlByRole(root, 'account-select', 'select[name="account"], select')
}

function targetControl(root) {
  return controlByRole(root, 'target-select', 'select[name="target"], select[data-target], [role="radiogroup"]')
    || [...root.querySelectorAll('select')].find(select => [...select.options]
      .some(option => ['auth-json', 'cliproxyapi', 'sub2api'].includes(option.value)))
}

function targetOptionValues(root) {
  const control = targetControl(root)
  expect(control).not.toBeNull()
  expect(control.matches('select')).toBe(true)
  return [...control.options].map(option => option.value)
}

function targetOptionLabels(root) {
  const control = targetControl(root)
  expect(control).not.toBeNull()
  expect(control.matches('select')).toBe(true)
  return [...control.options].map(option => option.textContent.trim())
}

function setTarget(root, target) {
  const control = targetControl(root)
  expect(control).not.toBeNull()
  if (control.matches('select')) {
    control.value = target
    control.dispatchEvent(new Event('change', { bubbles: true }))
    return
  }
  const targetButton = control.querySelector(`[data-value="${target}"]`)
    || root.querySelector(`[data-value="${target}"]`)
  expect(targetButton).not.toBeNull()
  targetButton.click()
}

function accessibleName(element) {
  const labelledBy = element.getAttribute('aria-labelledby')
  const labelledText = labelledBy
    ? labelledBy.split(/\s+/u).map(id => document.getElementById(id)?.textContent || '').join(' ').trim()
    : ''
  return element.getAttribute('aria-label')
    || labelledText
    || element.labels?.[0]?.textContent?.trim()
    || element.getAttribute('title')
    || element.textContent?.trim()
    || ''
}

function copyButton(root, field) {
  const roles = {
    email: ['copy-email', 'copy-credential-email'],
    access: ['copy-access', 'copy-access-token', 'copy-at'],
    refresh: ['copy-refresh', 'copy-refresh-token', 'copy-rt'],
    all: ['copy-all', 'copy-result', 'copy-complete']
  }
  for (const role of roles[field]) {
    const element = root.querySelector(`[data-role="${role}"]`)
    if (element) return element
  }
  const pattern = {
    email: /copy.*email|复制.*email/iu,
    access: /copy.*access|copy.*\bat\b|复制.*(?:access|at)/iu,
    refresh: /copy.*refresh|copy.*\brt\b|复制.*(?:refresh|rt)/iu,
    all: /copy.*(?:all|complete|result)|复制.*(?:全部|完整|结果)/iu
  }[field]
  return [...root.querySelectorAll('button')].find(button => pattern.test(
    `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.textContent || ''}`
  )) || null
}

function downloadButton(root) {
  return root.querySelector('[data-role="export"], [data-role="download"]')
    || [...root.querySelectorAll('button')].find(button => /export|download|导出|下载/iu.test(accessibleName(button)))
    || null
}

function outputElement(root) {
  const [output] = outputElements(root)
  expect(output).toBeDefined()
  return output
}

function outputTitle(root) {
  const output = outputElement(root)
  return output.closest('section')?.querySelector('h1, h2, h3, [role="heading"]') || null
}

function expectTargetPresentation(root, fileLabel) {
  const output = outputElement(root)
  const title = outputTitle(root)
  const download = downloadButton(root)
  const downloadLabel = `导出 ${fileLabel}`

  expect(title).not.toBeNull()
  expect(title.textContent.trim()).toBe(fileLabel)
  expect(output.getAttribute('aria-label')).toBe(`${fileLabel} JSON 输出`)
  expect(download).not.toBeNull()
  expect(download.textContent).toContain(downloadLabel)
  expect(download.getAttribute('title')).toBe(downloadLabel)
  expect(download.getAttribute('aria-label')).toBe(downloadLabel)
}

function expectNeutralOutput(root, sensitiveValues = []) {
  const target = targetControl(root)
  const output = outputElement(root)
  const title = outputTitle(root)
  const copy = copyButton(root, 'all')
  const download = downloadButton(root)
  const details = root.querySelector('.credential-details')
  const detailSection = details?.closest('.tool-section')

  expect(target).not.toBeNull()
  expect(target.matches('select')).toBe(true)
  expect(target.disabled).toBe(true)
  expect(target.options).toHaveLength(0)
  expect(output.value).toBe('')
  expect(title).not.toBeNull()
  expect(title.textContent.trim()).toBe('转换结果')
  expect(output.getAttribute('aria-label')).toBe('转换后的 JSON 输出')
  expect(copy).not.toBeNull()
  expect(copy.disabled).toBe(true)
  expect(download).not.toBeNull()
  expect(download.disabled).toBe(true)
  expect(download.textContent).toContain('导出 JSON')
  expect(download.getAttribute('title')).toBe('导出 JSON')
  expect(download.getAttribute('aria-label')).toBe('导出 JSON')
  expect(details).not.toBeNull()
  expect(details.hidden).toBe(true)
  expect(detailSection?.hidden).toBe(true)
  expect(details.children).toHaveLength(0)
  for (const value of sensitiveValues) expect(details.textContent).not.toContain(value)
}

function clearButton(root) {
  return [...root.querySelectorAll('button')].find(button => /clear|清空/iu.test(accessibleName(button))) || null
}

function renderWithSource(root, source = sub2ApiSource) {
  tool.render(root)
  const input = inputElement(root)
  expect(input).not.toBeNull()
  input.value = JSON.stringify(source)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  primaryButton(root).click()
  return input
}

beforeEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('credential source parsing', () => {
  it('parses a Sub2API DataPayload, extracts nested token variants, and warns for non-OpenAI accounts', () => {
    const result = parseCredentialSource(sub2ApiSource)
    const accounts = parsedAccounts(result)

    expect(parsedFormat(result)).toBe('sub2api')
    expect(accounts).toHaveLength(2)
    expect(accountValue(accounts[0], 'name')).toBe('snake-account')
    expect(accountValue(accounts[0], 'email')).toBe('snake@example.com')
    expect(accountValue(accounts[0], 'access')).toBe('at-snake')
    expect(accountValue(accounts[0], 'refresh')).toBe('rt-snake')
    expectEpoch(accountValue(accounts[0], 'expiry'), 1_700_000_000_000)

    expect(accountValue(accounts[1], 'name')).toBe('camel-account')
    expect(accountValue(accounts[1], 'email')).toBe('camel@example.com')
    expect(accountValue(accounts[1], 'access')).toBe('at-camel')
    expect(accountValue(accounts[1], 'refresh')).toBe('rt-camel')
    expectEpoch(accountValue(accounts[1], 'expiry'), 1_700_000_000_000)

    expect(parsedWarnings(result).length).toBeGreaterThan(0)
    expect(warningText(result)).toMatch(/anthropic|openai|skip|unsupported|provider/iu)
  })

  it('unwraps the API response envelope without losing the Sub2API format', () => {
    const wrapped = {
      code: 0,
      message: 'ok',
      data: {
        name: 'wrapped-import',
        accounts: [snakeAccount],
        proxies: []
      }
    }
    const result = parseCredentialSource(wrapped)

    expect(parsedFormat(result)).toBe('sub2api')
    expect(parsedAccounts(result)).toHaveLength(1)
    expect(accountValue(parsedAccounts(result)[0], 'email')).toBe('snake@example.com')
  })

  it('uses Sub2API credential token expiry instead of account scheduling expiry for CPA export', () => {
    const tokenExpiry = 1_700_000_100
    const accountScheduleExpiry = 1_900_000_000
    const result = parseCredentialSource({
      accounts: [{
        platform: 'openai',
        type: 'oauth',
        expires_at: accountScheduleExpiry,
        credentials: {
          access_token: 'scheduled-at',
          refresh_token: 'scheduled-rt',
          expires_at: tokenExpiry
        }
      }],
      proxies: []
    })
    const account = parsedAccounts(result)[0]
    const cpa = asObject(convertCredential(account, 'cliproxyapi'))

    expectEpoch(accountValue(account, 'expiry'), tokenExpiry * 1000)
    expectEpoch(cpa.expired, tokenExpiry * 1000)
  })

  it('recognizes CLIProxyAPI flat objects and arrays, including email, expired, and type', () => {
    const one = {
      email: 'cli-one@example.com',
      access_token: 'cli-at-one',
      refresh_token: 'cli-rt-one',
      expired: 1_700_000_001,
      type: 'codex',
      account_id: 'cli-account-one'
    }
    const two = {
      email: 'cli-two@example.com',
      access_token: 'cli-at-two',
      refresh_token: 'cli-rt-two',
      expired: '2023-11-14T22:13:21.000Z',
      type: 'codex'
    }

    const single = parseCredentialSource(one)
    const array = parseCredentialSource([one, two])
    expect(parsedFormat(single)).toBe('cliproxyapi')
    expect(parsedAccounts(single)).toHaveLength(1)
    expect(accountValue(parsedAccounts(single)[0], 'email')).toBe('cli-one@example.com')
    expect(accountValue(parsedAccounts(single)[0], 'access')).toBe('cli-at-one')
    expectEpoch(accountValue(parsedAccounts(single)[0], 'expiry'), 1_700_000_001_000)

    expect(parsedFormat(array)).toBe('cliproxyapi')
    expect(parsedAccounts(array)).toHaveLength(2)
    expect(accountValue(parsedAccounts(array)[1], 'email')).toBe('cli-two@example.com')
    expectEpoch(accountValue(parsedAccounts(array)[1], 'expiry'), 1_700_000_001_000)
  })

  it('filters CLIProxyAPI entries with a non-Codex type without crashing on primitives', () => {
    const result = parseCredentialSource([{
      type: ' CODEX ',
      access_token: 'accepted-at'
    }, {
      type: 'claude',
      access_token: 'rejected-at'
    }, null, 'not-an-account'])

    expect(parsedAccounts(result)).toHaveLength(1)
    expect(accountValue(parsedAccounts(result)[0], 'access')).toBe('accepted-at')
    expect(parsedWarnings(result)).toHaveLength(1)
    expect(warningText(result)).toMatch(/codex|凭证|条目/iu)
  })

  it('accepts a bare Sub2API token alias and rejects unsupported platforms before type evidence', () => {
    const result = parseCredentialSource({
      accounts: [{ type: 'codex', token: 'accepted-at', account: { id: 'nested-account' } }, {
        platform: 'anthropic',
        type: 'codex',
        access_token: 'rejected-at'
      }, null, 42],
      proxies: []
    })

    expect(parsedAccounts(result)).toHaveLength(1)
    expect(accountValue(parsedAccounts(result)[0], 'access')).toBe('accepted-at')
    expect(accountValue(parsedAccounts(result)[0], 'account')).toBe('nested-account')
    expect(parsedWarnings(result)).toHaveLength(1)
  })

  it('reads identity aliases nested under credentials and credentials.tokens', () => {
    const result = parseCredentialSource({
      accounts: [{
        platform: 'openai',
        type: 'oauth',
        credentials: {
          tokens: {
            access_token: 'nested-at',
            user: { id: 'nested-user', email: 'nested@example.com' },
            account: {
              accountId: 'nested-account',
              planType: 'team'
            },
            organization: { id: 'nested-organization' }
          }
        }
      }],
      proxies: []
    })
    const account = parsedAccounts(result)[0]

    expect(accountValue(account, 'email')).toBe('nested@example.com')
    expect(accountValue(account, 'account')).toBe('nested-account')
    expect(accountValue(account, 'user')).toBe('nested-user')
    expect(accountValue(account, 'plan')).toBe('team')
    expect(accountValue(account, 'organization')).toBe('nested-organization')
  })

  it('rejects auth.json as an irreversible output-only source', () => {
    expect(() => parseCredentialSource(authJsonSource)).toThrow(
      /auth\.json.*(?:不可逆|无法反向|仅输出)|(?:不可逆|无法反向|仅输出).*auth\.json/iu
    )
  })

  it('rejects every supported auth.json wrapper before format detection', () => {
    const authSources = [
      { OPENAI_API_KEY: 'sk-only' },
      { OPENAI_API_KEY: 'sk-only', tokens: null },
      { credentials: { OPENAI_API_KEY: 'sk-credentials' } },
      { data: { OPENAI_API_KEY: 'sk-data' } },
      { accounts: [{ OPENAI_API_KEY: 'sk-account' }] },
      [{ type: 'codex', access_token: 'cli-at' }, { OPENAI_API_KEY: 'sk-mixed' }]
    ]

    for (const source of authSources) {
      expect(() => parseCredentialSource(source)).toThrow(
        /auth\.json.*(?:不可逆|无法反向|仅输出)|(?:不可逆|无法反向|仅输出).*auth\.json/iu
      )
    }
  })

  it('accepts a legal CPA account with nested tokens', () => {
    const result = parseCredentialSource({
      type: 'codex',
      tokens: {
        access_token: 'nested-at',
        refresh_token: 'nested-rt'
      }
    })

    expect(parsedFormat(result)).toBe('cliproxyapi')
    expect(parsedAccounts(result)).toHaveLength(1)
    expect(accountValue(parsedAccounts(result)[0], 'access')).toBe('nested-at')
    expect(accountValue(parsedAccounts(result)[0], 'refresh')).toBe('nested-rt')
  })

  it('gives an explicit access-token error when a legal CLIProxyAPI source lacks AT', () => {
    const missingAccess = parseCredentialSource({
      type: 'codex',
      email: 'missing-access@example.com',
      refresh_token: 'only-refresh'
    })
    expect(parsedAccounts(missingAccess)).toHaveLength(1)
    expect(() => convertCredential(parsedAccounts(missingAccess)[0], AUTH_JSON)).toThrow(/缺少 Access Token \(AT\)/u)
  })
})

describe('JWT enrichment and time handling', () => {
  it('decodes an unsigned base64url JWT payload', () => {
    expect(decodeJwtPayload(jwtAccessToken)).toMatchObject(jwtPayload)
  })

  it('fills profile, account, user, plan, organization, and expiry from JWT claims', () => {
    const result = parseCredentialSource({
      type: 'codex',
      access_token: jwtAccessToken,
      refresh_token: 'jwt-refresh'
    })
    const account = parsedAccounts(result)[0]

    expect(accountValue(account, 'email')).toBe('jwt@example.com')
    expect(accountValue(account, 'account')).toBe('jwt-account')
    expect(accountValue(account, 'user')).toBe('jwt-user')
    expect(accountValue(account, 'plan')).toBe('pro')
    expect(accountValue(account, 'organization')).toBe('jwt-organization')
    expectEpoch(accountValue(account, 'expiry'), JWT_EXPIRY_MS)
  })

  it('keeps explicit credential fields ahead of JWT claims', () => {
    const priorityJwt = makeUnsignedJwt({
      ...jwtPayload,
      'https://api.openai.com/auth': {
        ...jwtPayload['https://api.openai.com/auth'],
        chatgpt_account_id: 'jwt-account-ignored',
        chatgpt_user_id: 'jwt-user-ignored',
        chatgpt_plan_type: 'jwt-plan-ignored',
        poid: 'jwt-org-ignored'
      },
      'https://api.openai.com/profile': { email: 'jwt-email-ignored@example.com' },
      exp: 1_900_000_000
    })
    const result = parseCredentialSource({
      type: 'codex',
      name: 'explicit-fields',
      email: 'explicit@example.com',
      account_id: 'explicit-account',
      user_id: 'explicit-user',
      plan_type: 'explicit-plan',
      organization_id: 'explicit-organization',
      expired: 1_700_000_002,
      access_token: priorityJwt,
      refresh_token: 'explicit-refresh'
    })
    const account = parsedAccounts(result)[0]

    expect(accountValue(account, 'email')).toBe('explicit@example.com')
    expect(accountValue(account, 'account')).toBe('explicit-account')
    expect(accountValue(account, 'user')).toBe('explicit-user')
    expect(accountValue(account, 'plan')).toBe('explicit-plan')
    expect(accountValue(account, 'organization')).toBe('explicit-organization')
    expectEpoch(accountValue(account, 'expiry'), 1_700_000_002_000)
  })

  it('retains existing fields and warns instead of failing on a damaged JWT', () => {
    const result = parseCredentialSource({
      type: 'codex',
      access_token: 'eyJhbGciOiJub25lIn0.not-json.signature',
      refresh_token: 'kept-refresh',
      email: 'kept@example.com'
    })
    const account = parsedAccounts(result)[0]

    expect(accountValue(account, 'email')).toBe('kept@example.com')
    expect(accountValue(account, 'access')).toBe('eyJhbGciOiJub25lIn0.not-json.signature')
    expect(parsedWarnings(result).length).toBeGreaterThan(0)
    expect(warningText(result)).toMatch(/jwt|token|decode|invalid|parse/iu)
  })

  it('normalizes Unix seconds, Unix milliseconds, ISO dates, and omits invalid optional times with a warning', () => {
    const result = parseCredentialSource({
      accounts: [
        makeSub2ApiAccount({ name: 'seconds', email: 'seconds@example.com', accessToken: 'at-seconds', refreshToken: 'rt', expiresAt: 1_700_000_003 }),
        makeSub2ApiAccount({ name: 'milliseconds', email: 'milliseconds@example.com', accessToken: 'at-milliseconds', refreshToken: 'rt', expiresAt: 1_700_000_003_000 }),
        makeSub2ApiAccount({ name: 'iso', email: 'iso@example.com', accessToken: 'at-iso', refreshToken: 'rt', expiresAt: '2023-11-14T22:13:23.000Z' }),
        makeSub2ApiAccount({ name: 'invalid', email: 'invalid@example.com', accessToken: 'at-invalid', refreshToken: 'rt', expiresAt: 'not-a-date' })
      ],
      proxies: []
    })
    const accounts = parsedAccounts(result)

    expect(accounts).toHaveLength(4)
    expectEpoch(accountValue(accounts[0], 'expiry'), 1_700_000_003_000)
    expectEpoch(accountValue(accounts[1], 'expiry'), 1_700_000_003_000)
    expectEpoch(accountValue(accounts[2], 'expiry'), 1_700_000_003_000)
    expect(accountValue(accounts[3], 'expiry')).toBeUndefined()
    expect(parsedWarnings(result).length).toBeGreaterThan(0)
  })
})

describe('credential target conversion', () => {
  const fullAccount = {
    id: 'export-id',
    name: 'Export Account',
    email: 'export@example.com',
    accessToken: 'export-access',
    refreshToken: 'export-refresh',
    idToken: 'export-id-token',
    accountId: 'export-account',
    userId: 'export-user',
    planType: 'plus',
    organizationId: 'export-organization',
    expiresAt: '2023-11-14T22:13:24.000Z'
  }

  it('wraps auth.json tokens and does not invent absent optional fields', () => {
    const minimal = asObject(convertCredential({ accessToken: 'at', refreshToken: 'rt' }, 'auth-json'))
    expect(minimal).toEqual({
      OPENAI_API_KEY: null,
      tokens: {
        access_token: 'at',
        refresh_token: 'rt'
      }
    })

    const output = asObject(convertCredential(fullAccount, 'auth-json', { now: EXPORTED_AT }))
    expect(output).toEqual({
      OPENAI_API_KEY: null,
      tokens: {
        access_token: 'export-access',
        refresh_token: 'export-refresh',
        id_token: 'export-id-token',
        account_id: 'export-account'
      }
    })
  })

  it('emits a flat CLIProxyAPI codex record with normalized expiration', () => {
    const output = asObject(convertCredential(fullAccount, 'cliproxyapi', { now: EXPORTED_AT }))

    expect(output).toMatchObject({
      email: 'export@example.com',
      access_token: 'export-access',
      refresh_token: 'export-refresh',
      type: 'codex',
      account_id: 'export-account',
      expired: '2023-11-14T22:13:24.000Z'
    })
    expect(output).not.toHaveProperty('tokens')
    expect(output).not.toHaveProperty('data')
    expect(output).not.toHaveProperty('accounts')
  })

  it('emits the raw Sub2API DataPayload with fixed defaults and public Codex client id', () => {
    const output = asObject(convertCredential(fullAccount, 'sub2api', { now: EXPORTED_AT }))
    const account = output.accounts?.[0]

    expect(output).toMatchObject({
      exported_at: EXPORTED_AT,
      proxies: []
    })
    expect(output).not.toHaveProperty('data')
    expect(output.accounts).toHaveLength(1)
    expect(account).toMatchObject({
      platform: 'openai',
      type: 'oauth',
      concurrency: 1,
      priority: 0
    })
    expect(account.credentials).toMatchObject({
      access_token: 'export-access',
      refresh_token: 'export-refresh',
      client_id: PUBLIC_CODEX_CLIENT_ID
    })
    expectEpoch(account.credentials.expires_at, 1_700_000_004_000)

    const withoutOptional = asObject(convertCredential({ accessToken: 'only-access' }, 'sub2api', { now: EXPORTED_AT }))
    expect(withoutOptional.accounts[0].credentials).not.toHaveProperty('refresh_token')
    expect(withoutOptional.accounts[0].credentials).not.toHaveProperty('client_id')
    expect(withoutOptional.accounts[0]).not.toHaveProperty('email')
  })

  it('bounds a generated Sub2API account name without truncating the credential email', () => {
    const longEmail = `${'测'.repeat(120)}@example.com`
    const account = parsedAccounts(parseCredentialSource({
      type: 'codex',
      email: longEmail,
      access_token: 'long-email-at'
    }))[0]
    const output = asObject(convertCredential(account, 'sub2api', { now: EXPORTED_AT }))
    const sub2ApiAccount = output.accounts[0]

    expect(sub2ApiAccount.name).not.toBe('')
    expect(Array.from(sub2ApiAccount.name)).toHaveLength(100)
    expect(sub2ApiAccount.credentials.email).toBe(longEmail)
  })

  it('keeps both reversible source routes importable and wraps auth.json output', () => {
    const cpaAccount = parsedAccounts(parseCredentialSource(cliProxyApiSource))[0]
    const cpaToSub2Api = asObject(convertCredential(cpaAccount, 'sub2api', { now: EXPORTED_AT }))
    const cpaToAuth = asObject(convertCredential(cpaAccount, 'auth-json'))

    expect(cpaToSub2Api).toMatchObject({
      type: 'sub2api-data',
      version: 1,
      exported_at: EXPORTED_AT,
      proxies: [],
      accounts: [expect.objectContaining({
        platform: 'openai',
        type: 'oauth',
        credentials: expect.objectContaining({
          access_token: 'cli-access',
          refresh_token: 'cli-refresh'
        })
      })]
    })
    expect(cpaToSub2Api).not.toHaveProperty('data')
    expect(parsedFormat(parseCredentialSource(cpaToSub2Api))).toBe('sub2api')
    expect(cpaToAuth).toMatchObject({
      OPENAI_API_KEY: null,
      tokens: {
        access_token: 'cli-access',
        refresh_token: 'cli-refresh'
      }
    })
    expect(cpaToAuth).not.toHaveProperty('accounts')

    const sub2ApiAccount = parsedAccounts(parseCredentialSource(sub2ApiSource))[0]
    const sub2ApiToCpa = asObject(convertCredential(sub2ApiAccount, 'cliproxyapi'))
    const sub2ApiToAuth = asObject(convertCredential(sub2ApiAccount, 'auth-json'))

    expect(sub2ApiToCpa).toMatchObject({
      email: 'snake@example.com',
      access_token: 'at-snake',
      refresh_token: 'rt-snake',
      type: 'codex'
    })
    expect(sub2ApiToCpa).not.toHaveProperty('accounts')
    expect(sub2ApiToCpa).not.toHaveProperty('data')
    expect(sub2ApiToCpa).not.toHaveProperty('tokens')
    expect(parsedFormat(parseCredentialSource(sub2ApiToCpa))).toBe('cliproxyapi')
    expect(sub2ApiToAuth).toMatchObject({
      OPENAI_API_KEY: null,
      tokens: {
        access_token: 'at-snake',
        refresh_token: 'rt-snake'
      }
    })
    expect(sub2ApiToAuth).not.toHaveProperty('accounts')
  })
})

describe('credential converter DOM workflow', () => {
  let root

  beforeEach(() => {
    root = document.createElement('main')
    document.body.replaceChildren(root)
  })

  it('renders named controls and updates account and target output interactively', () => {
    tool.render(root)
    const controls = [...root.querySelectorAll('textarea, input, select, button')]
      .filter(element => element.type !== 'hidden')
    expect(controls.length).toBeGreaterThan(0)
    expect(controls.every(element => accessibleName(element))).toBe(true)

    renderWithSource(root)
    expect(root.textContent.toLowerCase()).toContain('sub2api')
    const accounts = accountSelect(root)
    expect(accounts).not.toBeNull()
    expect(accounts.options?.length || root.querySelectorAll('[data-role="account-option"]').length).toBe(2)
    expect(resultText(root)).toContain('snake@example.com')

    const firstResult = resultText(root)
    if (accounts.matches('select')) {
      accounts.value = accounts.options[1].value
      accounts.dispatchEvent(new Event('change', { bubbles: true }))
    } else {
      root.querySelector('[data-role="account-option"]:nth-child(2)')?.click()
    }
    expect(resultText(root)).toContain('camel@example.com')
    expect(resultText(root)).not.toBe(firstResult)

    const target = targetControl(root)
    expect(targetOptionValues(root)).toHaveLength(2)
    expect(targetOptionValues(root)).toEqual(['cliproxyapi', 'auth-json'])
    expect(targetOptionLabels(root)).toEqual([
      'Sub2API -> CPA 凭证文件',
      'Sub2API -> auth.json'
    ])
    expect(target.value).toBe('cliproxyapi')
    expect(resultText(root)).toContain('"type"')
    expect(resultText(root)).toContain('codex')
    expectTargetPresentation(root, 'CPA 凭证文件')

    setTarget(root, 'auth-json')
    const authOutput = asObject(outputElements(root)[0].value)
    expect(authOutput).toMatchObject({ OPENAI_API_KEY: null })
    expect(authOutput.tokens).toMatchObject({
      access_token: 'at-camel',
      refresh_token: 'rt-camel'
    })
    expect(authOutput).not.toHaveProperty('accounts')
    expectTargetPresentation(root, 'auth.json')
  })

  it('limits CLIProxyAPI sources to Sub2API and auth.json targets and defaults to raw Sub2API output', () => {
    renderWithSource(root, cliProxyApiSource)

    const target = targetControl(root)
    expect(targetOptionValues(root)).toHaveLength(2)
    expect(targetOptionValues(root)).toEqual(['sub2api', 'auth-json'])
    expect(targetOptionLabels(root)).toEqual([
      'CPA -> Sub2API 凭证文件',
      'CPA -> auth.json'
    ])
    expect(target.value).toBe('sub2api')

    const sub2ApiOutput = asObject(outputElements(root)[0].value)
    expect(sub2ApiOutput).toMatchObject({
      type: 'sub2api-data',
      proxies: [],
      accounts: [expect.objectContaining({
        platform: 'openai',
        type: 'oauth',
        credentials: expect.objectContaining({
          access_token: 'cli-access',
          refresh_token: 'cli-refresh'
        })
      })]
    })
    expect(sub2ApiOutput).not.toHaveProperty('data')
    expectTargetPresentation(root, 'Sub2API 凭证文件')

    setTarget(root, 'auth-json')
    const authOutput = asObject(outputElements(root)[0].value)
    expect(authOutput).toMatchObject({
      OPENAI_API_KEY: null,
      tokens: {
        access_token: 'cli-access',
        refresh_token: 'cli-refresh'
      }
    })
    expect(authOutput).not.toHaveProperty('accounts')
    expectTargetPresentation(root, 'auth.json')
  })

  it('copies the selected Email, AT, and RT rows independently and disables RT when absent', () => {
    renderWithSource(root)
    for (const field of ['email', 'access', 'refresh', 'all']) {
      expect(copyButton(root, field)).not.toBeNull()
    }
    expect(copyButton(root, 'refresh').disabled).toBe(false)

    navigator.clipboard.writeText.mockClear()
    copyButton(root, 'email').click()
    copyButton(root, 'access').click()
    copyButton(root, 'refresh').click()
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(1, 'snake@example.com')
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(2, 'at-snake')
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(3, 'rt-snake')

    document.body.replaceChildren(root = document.createElement('main'))
    const noRefresh = {
      accounts: [{
        name: 'no-refresh',
        platform: 'openai',
        type: 'oauth',
        credentials: { access_token: 'at-only', email: 'no-refresh@example.com' }
      }],
      proxies: []
    }
    renderWithSource(root, noRefresh)
    expect(copyButton(root, 'email')).not.toBeNull()
    expect(copyButton(root, 'access')).not.toBeNull()
    expect(copyButton(root, 'refresh')).not.toBeNull()
    expect(copyButton(root, 'refresh').disabled).toBe(true)
  })

  it('parses an uploaded JSON File asynchronously', async () => {
    tool.render(root)
    const fileInput = fileElement(root)
    expect(fileInput).not.toBeNull()
    const file = new File([JSON.stringify({
      accounts: [snakeAccount],
      proxies: []
    })], 'credentials.json', { type: 'application/json' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => expect(resultText(root)).toContain('snake@example.com'))
  })

  it('exports auth.json, CPA, and Sub2API targets with their documented filenames', () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:codex-export')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    let clickedAnchor
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clickedAnchor = this
    })

    renderWithSource(root, cliProxyApiSource)
    setTarget(root, 'sub2api')
    const exportButton = downloadButton(root)
    expect(exportButton).not.toBeNull()
    exportButton.click()

    expect(createObjectUrl).toHaveBeenCalled()
    expect(clickedAnchor).not.toBeUndefined()
    expect(clickedAnchor.download).toMatch(/^sub2api-account-\d{14}\.json$/u)

    setTarget(root, 'auth-json')
    exportButton.click()
    expect(clickedAnchor.download).toBe('auth.json')

    document.body.replaceChildren(root = document.createElement('main'))
    renderWithSource(root, sub2ApiSource)
    const cpaExportButton = downloadButton(root)
    expect(cpaExportButton).not.toBeNull()
    cpaExportButton.click()
    expect(clickedAnchor.download).toBe('codex-snake-example.com.json')
  })
})

describe('credential converter failure and security behavior', () => {
  let root

  beforeEach(() => {
    root = document.createElement('main')
    document.body.replaceChildren(root)
  })

  it('shows a visible error and clears a previous result for invalid JSON', () => {
    renderWithSource(root)
    expect(resultText(root)).toContain('snake@example.com')

    const input = inputElement(root)
    input.value = '{invalid json'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    primaryButton(root).click()

    const error = errorElement(root)
    expect(error).not.toBeNull()
    expect(error.textContent.trim()).not.toBe('')
    expect(error.hidden).toBe(false)
    expect(error.getAttribute('aria-hidden')).not.toBe('true')
    expect(resultText(root)).not.toContain('snake@example.com')
    expectNeutralOutput(root, ['snake@example.com', 'at-snake', 'rt-snake'])
  })

  it('rejects auth.json input with no output and unavailable target actions', () => {
    tool.render(root)
    const input = inputElement(root)
    input.value = JSON.stringify(authJsonSource)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    primaryButton(root).click()

    const error = errorElement(root)
    expect(error).not.toBeNull()
    expect(error.textContent).toMatch(
      /auth\.json.*(?:不可逆|无法反向|仅输出)|(?:不可逆|无法反向|仅输出).*auth\.json/iu
    )
    expect(error.hidden).toBe(false)
    expectNeutralOutput(root, ['auth-at', 'auth-rt', 'auth-account'])
  })

  it('clears sensitive account details after invalid target or account selection', () => {
    const expectDetailsCleared = () => {
      const details = root.querySelector('.credential-details')
      const detailSection = details?.closest('.tool-section')
      expect(outputElements(root)[0].value).toBe('')
      expect(copyButton(root, 'all').disabled).toBe(true)
      expect(details?.hidden).toBe(true)
      expect(detailSection?.hidden).toBe(true)
      expect(details?.children).toHaveLength(0)
      expect(details?.textContent).not.toMatch(/snake@example\.com|at-snake|rt-snake/iu)
      for (const field of ['email', 'access', 'refresh']) {
        expect(copyButton(root, field)).toBeNull()
      }
    }

    renderWithSource(root)
    const target = targetControl(root)
    target.value = 'invalid-target'
    target.dispatchEvent(new Event('change', { bubbles: true }))
    expectDetailsCleared()

    document.body.replaceChildren(root = document.createElement('main'))
    renderWithSource(root)
    const accounts = accountSelect(root)
    accounts.value = '999'
    accounts.dispatchEvent(new Event('change', { bubbles: true }))
    expectDetailsCleared()
  })

  it('returns to a neutral state and removes sensitive details when input becomes stale or is cleared', () => {
    renderWithSource(root)
    const input = inputElement(root)
    input.value += ' '
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expectNeutralOutput(root, ['snake@example.com', 'at-snake', 'rt-snake'])
    expect(root.textContent).toContain('输入已更改，请重新解析')

    primaryButton(root).click()
    expect(resultText(root)).toContain('snake@example.com')
    const clear = clearButton(root)
    expect(clear).not.toBeNull()
    clear.click()

    expect(input.value).toBe('')
    expectNeutralOutput(root, ['snake@example.com', 'at-snake', 'rt-snake'])
    expect(root.textContent).toContain('等待输入 JSON 凭证')
  })

  it('parses accounts without AT but displays the conversion error and no output', () => {
    renderWithSource(root, {
      accounts: [{
        platform: 'openai',
        type: 'oauth',
        credentials: {
          email: 'missing-at@example.com',
          refresh_token: 'only-refresh'
        }
      }],
      proxies: []
    })

    const error = errorElement(root)
    const status = root.querySelector('.credential-source-status')
    expect(error.textContent).toContain('缺少 Access Token (AT)')
    expect(status.textContent).not.toContain('将导出')
    expect(status.textContent).toContain('无法导出')
    expect(outputElements(root)[0].value).toBe('')
    expect(copyButton(root, 'all').disabled).toBe(true)
    expect(copyButton(root, 'email').disabled).toBe(false)
    expect(copyButton(root, 'refresh').disabled).toBe(false)
    expect([...root.querySelectorAll('button')]
      .find(button => /导出 JSON|export|download/iu.test(button.textContent))?.disabled).toBe(true)
  })

  it('rejects a JSON file larger than 10 MiB and clears old output', async () => {
    renderWithSource(root)
    expect(resultText(root)).toContain('snake@example.com')
    const fileInput = fileElement(root)
    const hugeFile = new File(['{}'], 'too-large.json', { type: 'application/json' })
    Object.defineProperty(hugeFile, 'size', { configurable: true, value: 10 * 1024 * 1024 + 1 })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [hugeFile] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      const error = errorElement(root)
      expect(error).not.toBeNull()
      expect(error.textContent.trim()).not.toBe('')
    })
    expect(resultText(root)).not.toContain('snake@example.com')
    expect(copyButton(root, 'all').disabled).toBe(true)
    expect([...root.querySelectorAll('button')]
      .find(button => /导出 JSON|export|download/iu.test(button.textContent))?.disabled).toBe(true)
  })

  it('keeps malicious names and emails as text, without HTML execution or storage writes', () => {
    const maliciousName = '<img src=x onerror="window.__codexXss = true">'
    const maliciousEmail = '<svg onload="window.__codexXss = true">evil@example.com</svg>'
    const source = {
      name: maliciousName,
      accounts: [{
        name: maliciousName,
        platform: 'openai',
        type: 'oauth',
        credentials: {
          email: maliciousEmail,
          access_token: 'safe-at',
          refresh_token: 'safe-rt'
        }
      }, {
        name: 'safe-account',
        platform: 'openai',
        type: 'oauth',
        credentials: { access_token: 'other-at' }
      }],
      proxies: []
    }

    renderWithSource(root, source)
    const rendered = `${root.textContent}\n${resultText(root)}`
    expect(rendered).toContain(maliciousName)
    expect(rendered).toContain(maliciousEmail)
    expect(root.querySelector('img, script')).toBeNull()
    expect(root.querySelector('[onload], [onerror]')).toBeNull()
    expect(globalThis.__codexXss).not.toBe(true)
    expect(localStorage.length).toBe(0)
  })
})
