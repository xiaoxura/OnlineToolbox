import { createElement, createSection, createTableScroll } from '../../utils/dom.js'

// Build and dissect connection URIs for the four databases people paste into a
// terminal most often. `new URL` cannot parse a multi-host MongoDB authority
// (`h1:1,h2:2`), so the parser walks the URI by hand instead.

export const DIALECTS = [
  { id: 'mysql', label: 'MySQL', scheme: 'mysql', defaultPort: 3306, databaseLabel: '数据库' },
  { id: 'postgresql', label: 'PostgreSQL', scheme: 'postgresql', defaultPort: 5432, databaseLabel: '数据库' },
  { id: 'mongodb', label: 'MongoDB', scheme: 'mongodb', defaultPort: 27017, databaseLabel: '数据库' },
  { id: 'mongodb+srv', label: 'MongoDB SRV', scheme: 'mongodb+srv', defaultPort: null, databaseLabel: '数据库' },
  { id: 'redis', label: 'Redis', scheme: 'redis', defaultPort: 6379, databaseLabel: '数据库索引' }
]

export const DEFAULT_PORTS = {
  mysql: 3306,
  postgresql: 5432,
  postgres: 5432,
  mongodb: 27017,
  redis: 6379
}

const SCHEME_ALIASES = { postgres: 'postgresql' }

const DIALECT_PARAM_KEYS = {
  mysql: [],
  postgresql: ['sslmode'],
  mongodb: ['authSource', 'replicaSet'],
  'mongodb+srv': ['authSource', 'replicaSet'],
  redis: []
}

const DIALECT_BY_ID = Object.fromEntries(DIALECTS.map(dialect => [dialect.id, dialect]))

function normalizeDialect(value) {
  const id = String(value ?? '').trim().toLowerCase()
  const resolved = SCHEME_ALIASES[id] ?? id
  if (!DIALECT_BY_ID[resolved]) {
    throw new Error(`不支持的协议 "${value}"，仅支持 ${DIALECTS.map(item => item.id).join(' / ')}`)
  }
  return resolved
}

function encodeCredential(value) {
  return encodeURIComponent(String(value))
}

function decodePart(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function collectParams(config, dialect) {
  const entries = []
  const raw = config.params
  if (Array.isArray(raw)) {
    for (const pair of raw) {
      if (!Array.isArray(pair) || pair.length < 1) continue
      entries.push([String(pair[0]), pair[1] == null ? '' : String(pair[1])])
    }
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) entries.push([key, value == null ? '' : String(value)])
  }
  for (const key of DIALECT_PARAM_KEYS[dialect] ?? []) {
    const value = config[key]
    if (value !== undefined && value !== null && String(value) !== '') entries.push([key, String(value)])
  }
  return entries
}

/** Build a connection URI. Dialect-specific options go in `config.params` or as `authSource` / `replicaSet` / `sslmode`. */
export function buildConnectionString(config = {}) {
  const dialect = normalizeDialect(config.dialect)
  const definition = DIALECT_BY_ID[dialect]

  const host = String(config.host ?? '').trim() || 'localhost'
  const username = config.username == null ? '' : String(config.username)
  const password = config.password == null ? '' : String(config.password)
  const database = config.database == null ? '' : String(config.database).trim()

  const rawPort = config.port
  const hasPort = rawPort !== undefined && rawPort !== null && String(rawPort).trim() !== ''
  const port = hasPort ? Number(String(rawPort).trim()) : null
  if (hasPort && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    throw new Error('端口必须是 1-65535 之间的整数')
  }

  let auth = ''
  if (username || password) {
    auth = encodeCredential(username)
    if (password) auth += ':' + encodeCredential(password)
    auth += '@'
  }

  // mongodb+srv resolves the port through DNS and rejects an explicit one.
  const portPart = port !== null && definition.defaultPort !== null ? `:${port}` : ''
  const pathPart = database ? `/${encodeURIComponent(database)}` : ''

  const search = new URLSearchParams()
  for (const [key, value] of collectParams(config, dialect)) {
    if (!key || value === '') continue
    search.append(key, value)
  }
  const query = search.toString()

  return `${definition.scheme}://${auth}${host}${portPart}${pathPart}${query ? '?' + query : ''}`
}

function splitHostPort(entry) {
  if (entry.startsWith('[')) {
    const close = entry.indexOf(']')
    if (close < 0) return { host: entry, port: '' }
    const rest = entry.slice(close + 1)
    return { host: entry.slice(0, close + 1), port: rest.startsWith(':') ? rest.slice(1) : '' }
  }
  const colon = entry.lastIndexOf(':')
  if (colon < 0) return { host: entry, port: '' }
  return { host: entry.slice(0, colon), port: entry.slice(colon + 1) }
}

/** Dissect a connection URI into its parts. */
export function parseConnectionString(uri) {
  if (typeof uri !== 'string' || !uri.trim()) throw new Error('请输入连接字符串')
  const text = uri.trim()
  const schemeEnd = text.indexOf('://')
  if (schemeEnd <= 0) throw new Error('连接字符串必须包含协议前缀，例如 mysql://')

  const rawScheme = text.slice(0, schemeEnd).toLowerCase()
  const dialect = normalizeDialect(rawScheme)

  let rest = text.slice(schemeEnd + 3)
  const hashIndex = rest.indexOf('#')
  if (hashIndex >= 0) rest = rest.slice(0, hashIndex)

  let query = ''
  const queryIndex = rest.indexOf('?')
  if (queryIndex >= 0) {
    query = rest.slice(queryIndex + 1)
    rest = rest.slice(0, queryIndex)
  }

  let path = ''
  const pathIndex = rest.indexOf('/')
  if (pathIndex >= 0) {
    path = rest.slice(pathIndex + 1)
    rest = rest.slice(0, pathIndex)
  }

  let userinfo = ''
  const atIndex = rest.lastIndexOf('@')
  if (atIndex >= 0) {
    userinfo = rest.slice(0, atIndex)
    rest = rest.slice(atIndex + 1)
  }

  let username = ''
  let password = ''
  if (userinfo) {
    const colon = userinfo.indexOf(':')
    if (colon < 0) username = decodePart(userinfo)
    else {
      username = decodePart(userinfo.slice(0, colon))
      password = decodePart(userinfo.slice(colon + 1))
    }
  }

  const hosts = rest.split(',').map(entry => splitHostPort(entry.trim())).filter(item => item.host)
  const primary = hosts[0] ?? { host: '', port: '' }
  const defaultPort = DEFAULT_PORTS[dialect]
  const params = new URLSearchParams(query)
  const paramEntries = []
  for (const [key, value] of params) paramEntries.push([key, value])

  return {
    dialect,
    scheme: rawScheme,
    protocol: `${rawScheme}://`,
    username,
    password,
    hosts: hosts.map(item => item.host),
    host: primary.host,
    port: primary.port || (defaultPort ? String(defaultPort) : ''),
    portExplicit: Boolean(primary.port),
    defaultPort: defaultPort ? String(defaultPort) : '',
    database: decodePart(path),
    params: Object.fromEntries(paramEntries),
    paramEntries,
    uri: text
  }
}

const SAMPLE = {
  mysql: {
    dialect: 'mysql', username: 'root', password: 'p@ss:w0rd',
    host: 'db.example.com', port: '3306', database: 'shop'
  },
  postgresql: {
    dialect: 'postgresql', username: 'postgres', password: 'secret',
    host: 'pg.example.com', port: '5432', database: 'analytics', sslmode: 'require'
  },
  mongodb: {
    dialect: 'mongodb', username: 'app', password: 'hunter2',
    host: 'mongo.example.com', port: '27017', database: 'orders',
    authSource: 'admin', replicaSet: 'rs0'
  },
  'mongodb+srv': {
    dialect: 'mongodb+srv', username: 'app', password: 'hunter2',
    host: 'cluster0.example.mongodb.net', port: '', database: 'orders', authSource: 'admin'
  },
  redis: {
    dialect: 'redis', username: '', password: 'redis-pass',
    host: '127.0.0.1', port: '6379', database: '0'
  }
}

function tableRow(label, value) {
  return createElement('tr', {}, [
    createElement('th', { scope: 'row', textContent: label }),
    createElement('td', { className: 'code-text', textContent: value })
  ])
}

export default {
  id: 'db-connection-string',
  name: '数据库连接串',
  description: '构建与解析 MySQL、PostgreSQL、MongoDB 与 Redis 连接字符串',
  category: 'devtool',
  icon: 'sql',
  keywords: ['connection string', 'dsn', 'mysql', 'postgres', 'mongodb', 'redis', 'uri'],
  render(container) {
    const dialectSelect = createElement('select', { className: 'select', 'aria-label': '数据库协议' },
      DIALECTS.map(dialect => createElement('option', { value: dialect.id, textContent: `${dialect.label} (${dialect.scheme}://)` })))

    const usernameInput = createElement('input', { className: 'input', type: 'text', placeholder: 'root', 'aria-label': '用户名' })
    const passwordInput = createElement('input', { className: 'input', type: 'text', placeholder: '密码', 'aria-label': '密码' })
    const hostInput = createElement('input', { className: 'input', type: 'text', placeholder: 'localhost', 'aria-label': '主机' })
    const portInput = createElement('input', { className: 'input', type: 'number', min: '1', max: '65535', placeholder: '默认端口', 'aria-label': '端口' })
    const databaseInput = createElement('input', { className: 'input', type: 'text', placeholder: '数据库名', 'aria-label': '数据库' })
    const databaseLabel = createElement('div', { className: 'label', textContent: '数据库' })
    const portHint = createElement('p', { className: 'form-hint', textContent: '端口留空则使用协议默认端口。' })

    const dynamicRow = createElement('div', { className: 'form-row' })

    const pasteInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: 'mysql://user:pass@host:3306/db',
      'aria-label': '已有连接字符串'
    })

    const output = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      readOnly: true,
      placeholder: '生成的连接字符串将显示在此…'
    })

    const errorEl = createElement('div', { className: 'error-text' })

    const table = createElement('table', { className: 'result-table' })
    const tbody = createElement('tbody')
    table.append(createElement('thead', {}, [
      createElement('tr', {}, [
        createElement('th', { textContent: '字段' }),
        createElement('th', { textContent: '值' })
      ])
    ]), tbody)
    const tableScroll = createTableScroll(table, '连接字符串解析结果')

    const definition = () => DIALECTS.find(item => item.id === dialectSelect.value) ?? DIALECTS[0]

    function renderDynamicFields() {
      const dialect = dialectSelect.value
      const fields = []
      if (dialect === 'mongodb' || dialect === 'mongodb+srv') {
        fields.push(
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: 'authSource' }),
            createElement('input', { className: 'input', type: 'text', placeholder: 'admin', 'aria-label': 'authSource' })
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: 'replicaSet' }),
            createElement('input', { className: 'input', type: 'text', placeholder: 'rs0', 'aria-label': 'replicaSet' })
          ])
        )
      } else if (dialect === 'postgresql') {
        const sslmode = createElement('select', { className: 'select', 'aria-label': 'sslmode' }, [
          createElement('option', { value: '', textContent: '（不指定）' }),
          ...['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']
            .map(value => createElement('option', { value, textContent: value }))
        ])
        fields.push(createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: 'sslmode' }),
          sslmode
        ]))
      } else if (dialect === 'redis') {
        fields.push(createElement('p', {
          className: 'form-hint',
          textContent: 'Redis 没有数据库名，「数据库」填写的是 0-15 的库索引，会写进路径（/0）。'
        }))
      }
      dynamicRow.replaceChildren(...fields)
      for (const control of dynamicRow.querySelectorAll('input, select')) {
        control.addEventListener('input', generate)
        control.addEventListener('change', generate)
      }
    }

    function readDynamicFields() {
      const values = {}
      for (const control of dynamicRow.querySelectorAll('input, select')) {
        const key = control.getAttribute('aria-label')
        if (key && control.value) values[key] = control.value
      }
      return values
    }

    function syncPortPlaceholder() {
      const current = definition()
      portInput.placeholder = current.defaultPort ? String(current.defaultPort) : 'SRV 无需端口'
      portInput.disabled = current.defaultPort === null
      databaseLabel.textContent = current.databaseLabel
      databaseInput.placeholder = current.id === 'redis' ? '0' : '数据库名'
    }

    function readConfig() {
      return {
        dialect: dialectSelect.value,
        username: usernameInput.value,
        password: passwordInput.value,
        host: hostInput.value,
        port: portInput.value,
        database: databaseInput.value,
        ...readDynamicFields()
      }
    }

    function renderTable(parsed) {
      tbody.replaceChildren(
        tableRow('协议', parsed.protocol),
        tableRow('主机', parsed.hosts.join(', ') || '（未指定）'),
        tableRow('端口', parsed.port ? `${parsed.port}${parsed.portExplicit ? '' : '（默认）'}` : '（不适用）'),
        tableRow('用户名', parsed.username || '（无）'),
        tableRow('密码', parsed.password || '（无）'),
        tableRow('数据库', parsed.database || '（无）')
      )
      const params = parsed.paramEntries.length
        ? parsed.paramEntries.map(([key, value]) => `${key}=${value}`).join('\n')
        : '（无）'
      tbody.appendChild(tableRow('参数', params))
    }

    function generate() {
      errorEl.textContent = ''
      try {
        const uri = buildConnectionString(readConfig())
        output.value = uri
        renderTable(parseConnectionString(uri))
      } catch (cause) {
        output.value = ''
        tbody.replaceChildren()
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    function parseInput() {
      errorEl.textContent = ''
      try {
        const parsed = parseConnectionString(pasteInput.value)
        dialectSelect.value = parsed.dialect
        usernameInput.value = parsed.username
        passwordInput.value = parsed.password
        hostInput.value = parsed.host
        portInput.value = parsed.portExplicit ? parsed.port : ''
        databaseInput.value = parsed.database
        syncPortPlaceholder()
        renderDynamicFields()
        for (const control of dynamicRow.querySelectorAll('input, select')) {
          const key = control.getAttribute('aria-label')
          if (key && Object.hasOwn(parsed.params, key)) control.value = parsed.params[key]
        }
        output.value = parsed.uri
        renderTable(parsed)
      } catch (cause) {
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        const sample = SAMPLE[dialectSelect.value] ?? SAMPLE.mysql
        dialectSelect.value = sample.dialect
        usernameInput.value = sample.username
        passwordInput.value = sample.password
        hostInput.value = sample.host
        portInput.value = sample.port
        databaseInput.value = sample.database
        syncPortPlaceholder()
        renderDynamicFields()
        for (const control of dynamicRow.querySelectorAll('input, select')) {
          const key = control.getAttribute('aria-label')
          if (key && sample[key] !== undefined) control.value = sample[key]
        }
        generate()
      }
    })

    const parseBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '解析粘贴的连接串',
      onClick: parseInput
    })

    for (const control of [dialectSelect, usernameInput, passwordInput, hostInput, portInput, databaseInput]) {
      control.addEventListener('input', generate)
      control.addEventListener('change', generate)
    }
    dialectSelect.addEventListener('change', () => {
      syncPortPlaceholder()
      renderDynamicFields()
      generate()
    })

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '协议' }),
          dialectSelect
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '主机' }),
          hostInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '端口' }),
          portInput
        ])
      ]),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '用户名' }),
          usernameInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '密码' }),
          passwordInput
        ]),
        createElement('div', { className: 'form-group' }, [
          databaseLabel,
          databaseInput
        ])
      ]),
      dynamicRow,
      portHint,
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '原有连接串' }),
          pasteInput
        ]),
        parseBtn
      ]),
      createElement('div', { className: 'btn-group' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '生成连接串',
          onClick: generate
        }),
        sampleBtn
      ]),
      errorEl,
      createSection('连接字符串', output),
      createSection('解析结果', tableScroll)
    )

    syncPortPlaceholder()
    renderDynamicFields()
    // Something has to be on screen before the user types; start from localhost.
    hostInput.value = 'localhost'
    generate()
  }
}
