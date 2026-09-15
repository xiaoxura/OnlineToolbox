import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import envJson, { parseEnv, envToJson, jsonToEnv, COMMENTS_KEY } from '../src/tools/devtool/env-json.js'
import propertiesJson, {
  parseProperties,
  propertiesToJson,
  jsonToProperties
} from '../src/tools/devtool/properties-json.js'
import dbConnectionString, {
  buildConnectionString,
  parseConnectionString,
  DEFAULT_PORTS
} from '../src/tools/devtool/db-connection-string.js'
import utmBuilder, { buildUtmUrl, validateUtm } from '../src/tools/network/utm-builder.js'
import uuidConverter, {
  generateUuid,
  generateUuids,
  parseUuid,
  uuidV1,
  uuidV3,
  uuidV4,
  uuidV5,
  uuidToBytes,
  NAMESPACES
} from '../src/tools/generator/uuid-converter.js'
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

function editableTextarea() {
  return root.querySelector('textarea:not([readonly])')
}

function outputTextarea() {
  return root.querySelector('textarea[readonly]')
}

function runPrimaryAction() {
  root.querySelector('.btn-primary').click()
}

function buttonByText(text) {
  return [...root.querySelectorAll('button')].find(button => button.textContent.includes(text))
}

function selectOptions(select, value) {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

function tableValues(table) {
  return new Map([...table.querySelectorAll('tbody tr')]
    .map(row => [row.querySelector('th').textContent, row.querySelector('td').textContent]))
}

// Mirrors the invariants tools-smoke.test.js enforces for every registered tool.
function expectSmokeInvariants(container) {
  enhanceFormAccessibility(container)
  expect(container.childElementCount).toBeGreaterThan(0)
  for (const control of container.querySelectorAll('input, textarea, select')) {
    const named = control.labels?.length ||
      control.getAttribute('aria-label') ||
      control.getAttribute('aria-labelledby')
    expect(Boolean(named), `unnamed ${control.tagName}`).toBe(true)
  }
  expect(container.querySelector('select.input')).toBeNull()
  expect(container.querySelector('button[class="btn"]')).toBeNull()
  for (const choice of container.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
    expect(choice.closest('label')).not.toBeNull()
  }
  expect(container.querySelector(
    '.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box'
  )).toBeNull()
  expect(container.querySelector('.result-box > label + input, .result-box > label + textarea')).toBeNull()
  for (const table of container.querySelectorAll('table.result-table')) {
    expect(table.parentElement?.classList.contains('table-scroll')).toBe(true)
  }
  for (const group of container.querySelectorAll('[role="radiogroup"]')) {
    expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
  }
}

describe('.env ↔ JSON', () => {
  it('parses export prefixes, quoting, blank lines and comments', () => {
    const source = [
      '# leading comment',
      '',
      'NODE_ENV=production',
      'export API_URL="https://api.example.com/v1"',
      'INLINE=value # trailing comment',
      'HASH="a # not a comment"',
      'MOTD="first',
      'second"',
      "SINGLE='raw \\n kept'",
      'EMPTY='
    ].join('\n')

    expect(parseEnv(source)).toEqual([
      { type: 'comment', text: '# leading comment' },
      { type: 'blank' },
      { type: 'pair', key: 'NODE_ENV', value: 'production' },
      { type: 'pair', key: 'API_URL', value: 'https://api.example.com/v1' },
      { type: 'pair', key: 'INLINE', value: 'value' },
      { type: 'pair', key: 'HASH', value: 'a # not a comment' },
      { type: 'pair', key: 'MOTD', value: 'first\nsecond' },
      { type: 'pair', key: 'SINGLE', value: 'raw \\n kept' },
      { type: 'pair', key: 'EMPTY', value: '' }
    ])
  })

  it('keeps a Windows path intact inside a quoted value', () => {
    const value = jsonToEnv({ WIN: 'C:\\temp\\app' })
    expect(value).toBe('WIN="C:\\\\temp\\\\app"')
    expect(envToJson('WIN="C:\\temp\\app"')).toContain('C:\\\\temp\\\\app')
  })

  it('converts .env to JSON and back without losing pairs', () => {
    const source = [
      'NODE_ENV=production',
      'export API_URL="https://api.example.com/v1"',
      'TOKEN=abc123',
      'MOTD="first',
      'second"',
      "SINGLE='raw \\n kept'",
      'EMPTY='
    ].join('\n')

    const json = JSON.parse(envToJson(source))
    expect(json).toEqual({
      NODE_ENV: 'production',
      API_URL: 'https://api.example.com/v1',
      TOKEN: 'abc123',
      MOTD: 'first\nsecond',
      SINGLE: 'raw \\n kept',
      EMPTY: ''
    })

    const pairs = text => Object.fromEntries(
      parseEnv(text).filter(entry => entry.type === 'pair').map(entry => [entry.key, entry.value])
    )
    expect(pairs(jsonToEnv(envToJson(source)))).toEqual(pairs(source))
  })

  it('preserves comments only when asked to', () => {
    const source = '# kept\nKEY=1'
    expect(envToJson(source)).toBe('{\n  "KEY": "1"\n}')
    const json = JSON.parse(envToJson(source, { keepComments: true }))
    expect(json[COMMENTS_KEY]).toEqual(['# kept'])
    expect(jsonToEnv(json, { keepComments: true })).toBe('# kept\n\nKEY=1')
    expect(jsonToEnv(json)).toBe('KEY=1')
  })

  it('uppercases keys on request and rejects non-object JSON', () => {
    expect(jsonToEnv({ fooBar: 1, BAZ_QUX: 'a b' }, { uppercaseKeys: true }))
      .toBe('FOO_BAR=1\nBAZ_QUX="a b"')
    expect(() => jsonToEnv('[1,2]')).toThrow(/必须是对象/)
    expect(() => envToJson('# only a comment')).not.toThrow()
  })

  it('renders both directions in the UI', () => {
    envJson.render(root)
    expectSmokeInvariants(root)

    editableTextarea().value = 'A=1\nB="two words"'
    runPrimaryAction()
    expect(JSON.parse(outputTextarea().value)).toEqual({ A: '1', B: 'two words' })

    root.querySelector('.segmented-btn[data-value="json-to-env"]').click()
    editableTextarea().value = '{"A":"1","B":"two words"}'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('A=1\nB="two words"')

    root.querySelector('#env-json-uppercase-keys').click()
    runPrimaryAction()
    expect(outputTextarea().value).toBe('A=1\nB="two words"')
  })
})

describe('.properties ↔ JSON', () => {
  it('applies java.util.Properties separators, escapes and continuations', () => {
    const source = [
      '# comment',
      '! bang comment',
      'a b c',
      'd:e',
      'f = g',
      'escaped\\ key=value',
      'trailing=ends with space\\ ',
      'multi=first\\',
      '  second',
      'unicode=\\u4E2D\\u6587',
      'url=https\\://example.com/a=b',
      'lonely',
      'empty='
    ].join('\n')

    expect(parseProperties(source)).toEqual([
      { key: 'a', value: 'b c' },
      { key: 'd', value: 'e' },
      { key: 'f', value: 'g' },
      { key: 'escaped key', value: 'value' },
      { key: 'trailing', value: 'ends with space ' },
      { key: 'multi', value: 'firstsecond' },
      { key: 'unicode', value: '中文' },
      { key: 'url', value: 'https://example.com/a=b' },
      { key: 'lonely', value: '' },
      { key: 'empty', value: '' }
    ])
  })

  it('rejects malformed unicode escapes', () => {
    expect(() => parseProperties('key=\\u12')).toThrow(/\\uXXXX/)
  })

  it('expands dotted keys into nested JSON on request', () => {
    const source = 'app.name=工具箱\napp.database.host=localhost\napp.database.port=5432'
    expect(JSON.parse(propertiesToJson(source))).toEqual({
      'app.name': '工具箱',
      'app.database.host': 'localhost',
      'app.database.port': '5432'
    })
    expect(JSON.parse(propertiesToJson(source, { nested: true }))).toEqual({
      app: { name: '工具箱', database: { host: 'localhost', port: '5432' } }
    })
  })

  it('reports a conflict when a scalar key also has children', () => {
    expect(() => propertiesToJson('a=1\na.b=2', { nested: true })).toThrow(/冲突/)
    expect(() => propertiesToJson('a.b=2\na=1', { nested: true })).toThrow(/冲突/)
  })

  it('round-trips through both directions and escapes non-Latin-1', () => {
    const source = 'app.name=工具箱\napp.port=5432\napp.desc=has space'
    const text = jsonToProperties(propertiesToJson(source, { nested: true }), { nested: true })
    expect(text).toContain('app.name=\\u5DE5\\u5177\\u7BB1')
    expect(text).toContain('app.desc=has space')
    const pairs = value => Object.fromEntries(parseProperties(value).map(pair => [pair.key, pair.value]))
    expect(pairs(text)).toEqual(pairs(source))
  })

  it('refuses values properties cannot represent', () => {
    expect(() => jsonToProperties('{"a":null}')).toThrow(/无法表示/)
    expect(() => jsonToProperties('{"a":[1,2]}')).toThrow(/无法表示/)
    expect(() => jsonToProperties('{"a":{"b":1}}')).toThrow(/展开嵌套/)
    expect(() => jsonToProperties('[1,2]')).toThrow(/必须是对象/)
  })

  it('renders both directions in the UI', () => {
    propertiesJson.render(root)
    expectSmokeInvariants(root)

    editableTextarea().value = 'app.name=工具箱\napp.port=5432'
    runPrimaryAction()
    expect(JSON.parse(outputTextarea().value)).toEqual({ 'app.name': '工具箱', 'app.port': '5432' })

    root.querySelector('#properties-json-nested').click()
    runPrimaryAction()
    expect(JSON.parse(outputTextarea().value)).toEqual({ app: { name: '工具箱', port: '5432' } })

    root.querySelector('.segmented-btn[data-value="json-to-properties"]').click()
    editableTextarea().value = '{"app":{"name":"工具箱"}}'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('app.name=\\u5DE5\\u5177\\u7BB1')
  })
})

describe('database connection strings', () => {
  it('builds every supported dialect with its default port', () => {
    expect(DEFAULT_PORTS).toEqual({ mysql: 3306, postgresql: 5432, postgres: 5432, mongodb: 27017, redis: 6379 })
    expect(buildConnectionString({ dialect: 'mysql', host: 'db.example.com' })).toBe('mysql://db.example.com')
    expect(buildConnectionString({
      dialect: 'postgresql', username: 'postgres', host: 'pg.example.com', port: '5432',
      database: 'analytics', sslmode: 'require'
    })).toBe('postgresql://postgres@pg.example.com:5432/analytics?sslmode=require')
    expect(buildConnectionString({
      dialect: 'mongodb', username: 'app', password: 'hunter2', host: 'mongo.example.com',
      database: 'orders', authSource: 'admin', replicaSet: 'rs0'
    })).toBe('mongodb://app:hunter2@mongo.example.com/orders?authSource=admin&replicaSet=rs0')
    expect(buildConnectionString({ dialect: 'redis', password: 'pw', host: '127.0.0.1', port: '6379', database: '2' }))
      .toBe('redis://:pw@127.0.0.1:6379/2')
  })

  it('percent-encodes credentials and the database name', () => {
    const uri = buildConnectionString({
      dialect: 'mysql', username: 'user@x', password: 'p@ss:w', host: 'db.example.com', database: 'my db'
    })
    expect(uri).toBe('mysql://user%40x:p%40ss%3Aw@db.example.com/my%20db')
    const parsed = parseConnectionString(uri)
    expect(parsed.username).toBe('user@x')
    expect(parsed.password).toBe('p@ss:w')
    expect(parsed.database).toBe('my db')
  })

  it('drops the port for mongodb+srv and rejects bad input', () => {
    expect(buildConnectionString({ dialect: 'mongodb+srv', username: 'app', host: 'cluster0.example.net', port: '27017' }))
      .toBe('mongodb+srv://app@cluster0.example.net')
    expect(() => buildConnectionString({ dialect: 'oracle' })).toThrow(/不支持的协议/)
    expect(() => buildConnectionString({ dialect: 'mysql', port: 'abc' })).toThrow(/端口/)
  })

  it('parses single- and multi-host URIs', () => {
    const parsed = parseConnectionString('mongodb://app:hunter2@h1:27017,h2:27018/orders?authSource=admin&replicaSet=rs0')
    expect(parsed).toMatchObject({
      dialect: 'mongodb',
      protocol: 'mongodb://',
      host: 'h1',
      hosts: ['h1', 'h2'],
      port: '27017',
      portExplicit: true,
      database: 'orders',
      params: { authSource: 'admin', replicaSet: 'rs0' }
    })

    const fallback = parseConnectionString('postgresql://localhost/db')
    expect(fallback.port).toBe('5432')
    expect(fallback.portExplicit).toBe(false)
    expect(parseConnectionString('postgres://localhost/db').dialect).toBe('postgresql')
  })

  it('rejects unsupported or malformed URIs', () => {
    expect(() => parseConnectionString('not-a-uri')).toThrow(/协议前缀/)
    expect(() => parseConnectionString('ftp://host/db')).toThrow(/不支持的协议/)
    expect(() => parseConnectionString('  ')).toThrow(/请输入/)
  })

  it('renders the form, the URI and the parse table', () => {
    dbConnectionString.render(root)
    expectSmokeInvariants(root)

    expect(outputTextarea().value).toBe('mysql://localhost')
    const dialectSelect = root.querySelector('select')
    selectOptions(dialectSelect, 'postgresql')
    expect(outputTextarea().value).toBe('postgresql://localhost')

    const hostInput = root.querySelector('input[aria-label="主机"]')
    hostInput.value = 'pg.example.com'
    hostInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(outputTextarea().value).toBe('postgresql://pg.example.com')

    const pasteInput = root.querySelector('input[aria-label="已有连接字符串"]')
    pasteInput.value = 'redis://:pw@127.0.0.1:6379/2'
    buttonByText('解析粘贴的连接串').click()
    expect(dialectSelect.value).toBe('redis')
    expect(outputTextarea().value).toBe('redis://:pw@127.0.0.1:6379/2')
    const values = tableValues(root.querySelector('table.result-table'))
    expect(values.get('协议')).toBe('redis://')
    expect(values.get('主机')).toBe('127.0.0.1')
    expect(values.get('端口')).toBe('6379')
    expect(values.get('数据库')).toBe('2')
    expect(root.querySelector('.error-text').textContent).toBe('')
  })

  it('surfaces a bad pasted URI as an error', () => {
    dbConnectionString.render(root)
    const pasteInput = root.querySelector('input[aria-label="已有连接字符串"]')
    pasteInput.value = 'http://example.com'
    buttonByText('解析粘贴的连接串').click()
    expect(root.querySelector('.error-text').textContent).toContain('不支持的协议')
  })
})

describe('UTM link builder', () => {
  it('merges into an existing query string without duplicating keys', () => {
    const uri = buildUtmUrl('https://example.com/landing?ref=home&utm_source=old', {
      utm_source: 'newsletter',
      utm_medium: 'email',
      '': 'ignored',
      dropped: ''
    })
    const params = [...new URL(uri).searchParams.entries()]
    expect(params).toEqual([
      ['ref', 'home'],
      ['utm_source', 'newsletter'],
      ['utm_medium', 'email']
    ])
  })

  it('accepts pairs and rejects a relative base URL', () => {
    const uri = buildUtmUrl('https://a.com/p', [['utm_source', 'x'], ['utm_campaign', 'y']])
    expect(new URL(uri).searchParams.get('utm_campaign')).toBe('y')
    expect(() => buildUtmUrl('/relative', {})).toThrow(/绝对地址/)
    expect(() => buildUtmUrl('', {})).toThrow(/目标 URL/)
  })

  it('warns about missing, empty and non-standard parameters', () => {
    const empty = validateUtm({ url: '', params: {} })
    expect(empty).toContainEqual({ level: 'error', field: 'url', message: '请输入目标 URL' })
    expect(empty.filter(item => item.level === 'warning')).toHaveLength(3)

    const partial = validateUtm({ url: '/relative', params: { utm_source: 'a', utm_medium: '', aff: 'x' } })
    expect(partial).toContainEqual({
      level: 'error',
      field: 'url',
      message: '目标 URL 必须是包含协议的绝对地址，例如 https://example.com/landing'
    })
    expect(partial.map(item => item.field)).toContain('utm_medium')
    expect(partial.map(item => item.field)).toContain('utm_campaign')
    expect(partial.find(item => item.field === 'aff').level).toBe('info')

    expect(validateUtm({
      url: 'https://a.com',
      utm_source: 'a',
      utm_medium: 'b',
      utm_campaign: 'c'
    })).toEqual([])
  })

  it('renders the link, the parameter table and the warnings', () => {
    utmBuilder.render(root)
    expectSmokeInvariants(root)
    expect(root.querySelectorAll('.error-text')).toHaveLength(1)

    buttonByText('示例数据').click()
    const url = new URL(outputTextarea().value)
    expect(url.searchParams.get('utm_source')).toBe('newsletter')
    expect(url.searchParams.get('ref')).toBe('homepage')
    expect(url.searchParams.get('aff_id')).toBe('partner-42')
    expect(root.querySelector('.error-text')).toBeNull()

    const values = tableValues(root.querySelector('table.result-table'))
    expect(values.get('utm_campaign')).toBe('spring_sale')
    expect([...values.keys()]).toContain('aff_id')
  })
})

describe('UUID generation and parsing', () => {
  it('matches the published name-based UUID reference values', () => {
    expect(uuidV3(NAMESPACES.dns, 'python.org')).toBe('6fa459ea-ee8a-3ca4-894e-db77e160355e')
    expect(uuidV5(NAMESPACES.dns, 'python.org')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d')
    expect(uuidV5(NAMESPACES.dns, 'example.com')).toBe('cfbff0d1-9375-5685-968c-48ce8b15ae17')
    expect(uuidV3('dns', 'example.com')).toBe(uuidV3(NAMESPACES.dns, 'example.com'))
    expect(() => uuidV5(NAMESPACES.dns, '')).toThrow(/名称不能为空/)
    expect(() => uuidV5('not-a-uuid', 'x')).toThrow(/不是合法的 UUID/)
  })

  it('generates random v4 UUIDs with the version and variant bits set', () => {
    const seen = new Set()
    for (let index = 0; index < 200; index++) {
      const uuid = uuidV4()
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      seen.add(uuid)
    }
    expect(seen.size).toBe(200)
  })

  it('embeds a real timestamp in v1 UUIDs', () => {
    const before = Date.now()
    const uuid = uuidV1()
    const parsed = parseUuid(uuid)
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(parsed.version).toBe(1)
    expect(parsed.variant).toBe('RFC 4122')
    expect(parsed.timestampMs).toBeGreaterThanOrEqual(before - 1)
    expect(parsed.timestampMs).toBeLessThanOrEqual(Date.now() + 1)
    expect(new Date(parsed.timestamp).getTime()).toBeCloseTo(parsed.timestampMs, -2)
    expect(parsed.node).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/)
    // The multicast bit marks a random node id.
    expect(parseInt(parsed.node.slice(0, 2), 16) & 0x01).toBe(1)
    expect(uuidV1()).not.toBe(uuid)
  })

  it('parses versions, variants and rejects malformed input', () => {
    expect(parseUuid('f47ac10b-58cc-11cf-a447-001122334455')).toMatchObject({
      valid: true,
      version: 1,
      variant: 'RFC 4122',
      formatted: 'f47ac10b-58cc-11cf-a447-001122334455',
      node: '00:11:22:33:44:55',
      clockSeq: 9287
    })
    expect(parseUuid('{F47AC10B-58CC-11CF-A447-001122334455}').formatted)
      .toBe('f47ac10b-58cc-11cf-a447-001122334455')
    expect(parseUuid('urn:uuid:f47ac10b58cc11cfa447001122334455').valid).toBe(true)
    expect(parseUuid('f47ac10b58cc11cfa447001122334455').valid).toBe(true)

    const broken = parseUuid('not-a-uuid')
    expect(broken.valid).toBe(false)
    expect(broken.version).toBeNull()
    expect(broken.formatted).toBe('')
    expect(broken.error).toMatch(/不是合法的 UUID/)

    const v4 = parseUuid(uuidV4())
    expect(v4).toMatchObject({ valid: true, version: 4, variant: 'RFC 4122' })
    expect(v4.timestamp).toBeUndefined()
    expect(uuidToBytes(uuidV4())).toHaveLength(16)
  })

  it('honours version, formatting and batch options', () => {
    expect(generateUuid('v5', { namespace: 'dns', name: 'example.com', uppercase: true }))
      .toBe('CFBFF0D1-9375-5685-968C-48CE8B15AE17')
    expect(generateUuid(4, { hyphens: false })).toMatch(/^[0-9a-f]{32}$/)
    expect(generateUuids('v4', { count: 7 })).toHaveLength(7)
    expect(new Set(generateUuids('v1', { count: 50 })).size).toBe(50)
    expect(() => generateUuid('v9')).toThrow(/仅支持/)
    expect(() => generateUuid('v3', { namespace: 'dns' })).toThrow(/名称不能为空/)
  })

  it('renders generation, namespace fields and the parse table', () => {
    uuidConverter.render(root)
    expectSmokeInvariants(root)

    expect(outputTextarea().value.split('\n')).toHaveLength(5)
    const countInput = root.querySelector('input[aria-label="生成数量"]')
    countInput.value = '3'
    countInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(outputTextarea().value.split('\n')).toHaveLength(3)

    const nameRow = root.querySelector('input[aria-label="名称"]').closest('.form-row')
    expect(nameRow.hidden).toBe(true)
    root.querySelector('.segmented-btn[data-value="v5"]').click()
    expect(nameRow.hidden).toBe(false)

    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).toContain('名称不能为空')

    root.querySelector('input[aria-label="名称"]').value = 'example.com'
    runPrimaryAction()
    // A name-based UUID is deterministic, so every row of the batch is identical.
    expect(new Set(outputTextarea().value.split('\n')))
      .toEqual(new Set(['cfbff0d1-9375-5685-968c-48ce8b15ae17']))

    const parseInput = root.querySelector('input[aria-label="待解析的 UUID"]')
    parseInput.value = 'f47ac10b-58cc-11cf-a447-001122334455'
    parseInput.dispatchEvent(new Event('input', { bubbles: true }))
    const values = tableValues(root.querySelector('table.result-table'))
    expect(values.get('版本')).toBe('v1')
    expect(values.get('变体')).toBe('RFC 4122')
    expect(values.get('节点')).toBe('00:11:22:33:44:55')
    expect(values.get('内嵌时间戳')).toBe(parseUuid('f47ac10b-58cc-11cf-a447-001122334455').timestamp)

    parseInput.value = 'nope'
    parseInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(tableValues(root.querySelector('table.result-table')).get('错误')).toContain('不是合法的 UUID')

    buttonByText('示例数据').click()
    expect(root.querySelector('input[aria-label="名称"]').value).toBe('example.com')
  })
})
