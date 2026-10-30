import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import javascriptTool, { formatJavaScript, minifyJavaScript } from '../src/tools/formatter/javascript.js'
import yamlTool, { formatYaml, validateYaml, yamlToJson } from '../src/tools/formatter/yaml.js'
import tomlTool, { formatToml, validateToml, tomlToJson } from '../src/tools/formatter/toml.js'
import nginxTool, { buildNginxConfig } from '../src/tools/devtool/nginx-config.js'
import crontabTool, { cronToSystemd, describeCron, systemdToCron } from '../src/tools/devtool/crontab-systemd.js'
import { enhanceFormAccessibility } from '../src/utils/dom.js'
import { clickText, editableTextareas, errorText, outputValue, setValue } from './helpers/tool-harness.js'

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

function expectSmokeInvariants(container) {
  expect(container.childElementCount).toBeGreaterThan(0)
  for (const control of container.querySelectorAll('input, textarea, select')) {
    const named = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
    expect(Boolean(named), `unnamed ${control.tagName}`).toBe(true)
  }
  expect(container.querySelector('select.input')).toBeNull()
  expect(container.querySelector('button[class="btn"]')).toBeNull()
  for (const choice of container.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
    expect(choice.closest('label')).not.toBeNull()
  }
  expect(container.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box')).toBeNull()
  for (const group of container.querySelectorAll('[role="radiogroup"]')) {
    expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
  }
}

function setCheckbox(container, ariaLabel, checked) {
  const input = container.querySelector(`input[type="checkbox"][aria-label="${ariaLabel}"]`)
  expect(input, `checkbox not found: ${ariaLabel}`).toBeTruthy()
  input.checked = checked
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// ---------------------------------------------------------------------------
// JavaScript formatter
// ---------------------------------------------------------------------------

describe('javascript formatter', () => {
  it('formats JavaScript and TypeScript with explicit options', async () => {
    expect(await formatJavaScript('const x={a:1,b:[2,3]}', { semi: false, singleQuote: true, printWidth: 80 })).toBe(
      'const x = { a: 1, b: [2, 3] }\n'
    )
    expect(await formatJavaScript('const x: {a:number}={a:1}', { parser: 'typescript', semi: false })).toBe(
      'const x: { a: number } = { a: 1 }\n'
    )
    await expect(formatJavaScript('const =', {})).rejects.toThrow(/格式化失败/)
  })

  it('minifies JavaScript and explains why TypeScript cannot be minified', async () => {
    const result = await minifyJavaScript('function add(a, b) { return a + b }')
    expect(result.error).toBeNull()
    expect(result.code).toBe('function add(n,d){return n+d}')

    const typescript = await minifyJavaScript('const answer: number = 42')
    expect(typescript.code).toBe('')
    expect(typescript.error).toMatch(/TypeScript/)
  })

  it('formats and minifies through the rendered UI', async () => {
    render(javascriptTool)
    expectSmokeInvariants(root)
    const [input] = editableTextareas(root)

    setValue(input, 'const x={a:1,b:[2,3]}')
    clickText(root, '格式化')
    await vi.waitFor(() => {
      expect(outputValue(root)).toBe('const x = { a: 1, b: [2, 3] };\n')
    })

    clickText(root, 'TypeScript')
    setValue(input, 'interface User { name: string }\nconst user: User = { name: "Ada" }')
    clickText(root, '格式化')
    await vi.waitFor(() => {
      expect(outputValue(root)).toContain('interface User {')
      expect(outputValue(root)).toContain('name: string')
    })

    clickText(root, '压缩')
    await vi.waitFor(() => {
      expect(errorText(root)).toMatch(/TypeScript/)
    })
  })
})

// ---------------------------------------------------------------------------
// YAML formatter
// ---------------------------------------------------------------------------

describe('yaml formatter', () => {
  it('formats YAML, converts it to JSON, and reports parser marks', () => {
    expect(formatYaml('name: demo\nitems:\n- one\n- two')).toBe('name: demo\nitems:\n  - one\n  - two')
    expect(yamlToJson('name: demo\nitems:\n  - one\n  - two')).toBe('{\n  "name": "demo",\n  "items": [\n    "one",\n    "two"\n  ]\n}')
    expect(validateYaml('a: 1')).toEqual({ ok: true, error: '' })

    const invalid = validateYaml('a:\n b: 1\n  c: 2')
    expect(invalid.ok).toBe(false)
    expect(invalid.error).toContain('第 3 行第 4 列')
    expect(() => formatYaml('a: [1, 2')).toThrow(/第 2 行第 1 列/)
  })

  it('switches between format, validate and JSON modes in the UI', () => {
    render(yamlTool)
    expectSmokeInvariants(root)
    const [input] = editableTextareas(root)

    setValue(input, 'name: demo\nitems:\n- one\n- two')
    expect(outputValue(root)).toBe('name: demo\nitems:\n  - one\n  - two')

    clickText(root, '校验')
    expect(outputValue(root)).toBe('√ 合法 YAML')
    expect(errorText(root)).toBe('')

    setValue(input, 'a:\n b: 1\n  c: 2')
    expect(outputValue(root)).toContain('第 3 行第 4 列')
    expect(errorText(root)).toContain('第 3 行第 4 列')

    setValue(input, 'a: 1\nb: true')
    clickText(root, '转 JSON')
    expect(outputValue(root)).toBe('{\n  "a": 1,\n  "b": true\n}')
  })
})

// ---------------------------------------------------------------------------
// TOML formatter
// ---------------------------------------------------------------------------

describe('toml formatter', () => {
  it('formats TOML, converts it to JSON, and reports line numbers', () => {
    expect(formatToml('title="x"\n[a]\nb=1')).toBe('title = "x"\n\n[a]\nb = 1')
    expect(tomlToJson('a=1\n[b]\nc="d"')).toBe('{\n  "a": 1,\n  "b": {\n    "c": "d"\n  }\n}')
    expect(validateToml('a=1')).toEqual({ ok: true, error: '' })

    const invalid = validateToml('a = 1\nb = [')
    expect(invalid.ok).toBe(false)
    expect(invalid.error).toContain('第 2 行第 5 列')
    expect(() => formatToml('a = [')).toThrow(/第 1 行/)
  })

  it('switches between format, validate and JSON modes in the UI', () => {
    render(tomlTool)
    expectSmokeInvariants(root)
    const [input] = editableTextareas(root)

    setValue(input, 'title="x"\n[a]\nb=1')
    expect(outputValue(root)).toBe('title = "x"\n\n[a]\nb = 1')

    clickText(root, '校验')
    expect(outputValue(root)).toBe('√ 合法 TOML')

    setValue(input, 'a = [')
    expect(outputValue(root)).toContain('第 1 行')
    expect(errorText(root)).toContain('第 1 行')

    setValue(input, 'a=1\n[b]\nc="d"')
    clickText(root, '转 JSON')
    expect(outputValue(root)).toBe('{\n  "a": 1,\n  "b": {\n    "c": "d"\n  }\n}')
  })
})

// ---------------------------------------------------------------------------
// nginx config generator
// ---------------------------------------------------------------------------

describe('nginx config generator', () => {
  const fullOptions = {
    serverName: 'api.example.com',
    listen: '443',
    root: '/srv/www',
    indexFile: 'index.html',
    proxyTarget: 'http://127.0.0.1:8080',
    enableProxy: true,
    enableGzip: true,
    enableHttps: true,
    certPath: '/etc/ssl/fullchain.pem',
    keyPath: '/etc/ssl/privkey.pem',
    spaFallback: true,
    clientMaxBodySize: '20m',
    proxyWebSocket: true
  }

  it('builds HTTPS, gzip, SPA and WebSocket blocks', () => {
    const config = buildNginxConfig(fullOptions)
    expect(config).toContain('listen 443 ssl;')
    expect(config).toContain('server_name api.example.com;')
    expect(config).toContain('ssl_certificate /etc/ssl/fullchain.pem;')
    expect(config).toContain('ssl_certificate_key /etc/ssl/privkey.pem;')
    expect(config).toContain('gzip on;')
    expect(config).toContain('try_files $uri $uri/ /index.html;')
    expect(config).toContain('proxy_pass http://127.0.0.1:8080;')
    expect(config).toContain('proxy_set_header Upgrade $http_upgrade;')
    expect(config).toContain('proxy_set_header Connection "upgrade";')
    expect(config).toContain('client_max_body_size 20m;')
  })

  it('omits TLS and WebSocket directives when they are disabled', () => {
    const config = buildNginxConfig({
      ...fullOptions,
      listen: '80',
      enableHttps: false,
      enableGzip: false,
      proxyWebSocket: false,
      spaFallback: false
    })
    expect(config).toContain('listen 80;')
    expect(config).not.toContain('ssl_certificate')
    expect(config).not.toContain('gzip on;')
    expect(config).not.toContain('Upgrade')
    expect(config).toContain('try_files $uri $uri/ =404;')
  })

  it('validates the domain and proxy target', () => {
    expect(() => buildNginxConfig({ serverName: ' ' })).toThrow(/站点域名/)
    expect(() => buildNginxConfig({ serverName: 'x.test', enableProxy: true, proxyTarget: '' })).toThrow(/代理目标/)
  })

  it('regenerates live and surfaces validation errors', () => {
    render(nginxTool)
    expectSmokeInvariants(root)
    expect(outputValue(root)).toContain('server_name example.com;')
    expect(outputValue(root)).toContain('try_files $uri $uri/ /index.html;')

    const serverName = root.querySelector('input[aria-label="站点域名"]')
    setValue(serverName, '')
    expect(outputValue(root)).toBe('')
    expect(errorText(root)).toContain('站点域名')

    setValue(serverName, 'demo.test')
    const proxyTarget = root.querySelector('input[aria-label="反向代理目标"]')
    setValue(proxyTarget, '')
    expect(errorText(root)).toContain('代理目标')

    setValue(proxyTarget, 'http://127.0.0.1:9000')
    setCheckbox(root, '启用 HTTPS', true)
    expect(root.querySelector('select[aria-label="监听端口"]').value).toBe('443')
    expect(outputValue(root)).toContain('ssl_certificate /etc/nginx/ssl/example.com.crt;')

    setCheckbox(root, '启用 WebSocket 代理', true)
    expect(outputValue(root)).toContain('proxy_set_header Connection "upgrade";')
  })
})

// ---------------------------------------------------------------------------
// crontab ↔ systemd
// ---------------------------------------------------------------------------

describe('crontab ↔ systemd', () => {
  it('maps the documented cron patterns onto OnCalendar', () => {
    const mappings = [
      ['* * * * *', '*-*-* *:*:00'],
      ['*/5 * * * *', '*-*-* *:0/5'],
      ['0 3 * * *', '*-*-* 03:00:00'],
      ['0 9 * * 1-5', 'Mon..Fri *-*-* 09:00:00'],
      ['0 0 1 * *', '*-*-01 00:00:00']
    ]
    for (const [expression, calendar] of mappings) {
      expect(cronToSystemd(expression), expression).toContain(`OnCalendar=${calendar}`)
    }

    const unit = cronToSystemd('0 9 * * 1-5', {
      command: '/usr/local/bin/backup.sh',
      user: 'www-data',
      description: '工作日备份'
    })
    expect(unit).toContain('Description=工作日备份')
    expect(unit).toContain('User=www-data')
    expect(unit).toContain('ExecStart=/usr/local/bin/backup.sh')
    expect(describeCron('0 9 * * 1-5')).toContain('周一至周五')

    expect(cronToSystemd('@reboot')).toContain('无法精确映射')
    expect(cronToSystemd('0 0 */2 * *')).toContain('日/月')
  })

  it('parses common OnCalendar forms back to cron', () => {
    expect(systemdToCron('*-*-* 03:00:00')).toBe('0 3 * * *')
    expect(systemdToCron('Mon..Fri *-*-* 09:00:00')).toBe('0 9 * * 1-5')
    expect(systemdToCron('*:0/5')).toBe('*/5 * * * *')
    expect(systemdToCron('*-*-01 00:00:00')).toBe('0 0 1 * *')
    expect(systemdToCron('daily')).toBe('0 0 * * *')
    expect(systemdToCron('hourly')).toBe('0 * * * *')
    expect(systemdToCron('weekly')).toBe('0 0 * * 0')
    expect(systemdToCron('Sun *-*-* 00:00:00')).toBe('0 0 * * 0')
    expect(systemdToCron('[Timer]\nOnCalendar=Mon..Fri *-*-* 09:00:00')).toBe('0 9 * * 1-5')

    const calendar = cronToSystemd('0 0 1 * *').match(/^OnCalendar=(.+)$/m)[1]
    expect(systemdToCron(calendar)).toBe('0 0 1 * *')
  })

  it('converts in both directions through the UI', () => {
    render(crontabTool)
    expectSmokeInvariants(root)
    const [input] = editableTextareas(root)

    setValue(input, '*/5 * * * *')
    clickText(root, '转换')
    expect(outputValue(root)).toContain('OnCalendar=*-*-* *:0/5')
    expect(outputValue(root)).toContain('ExecStart=/usr/local/bin/backup.sh')

    clickText(root, 'systemd → Cron')
    setValue(input, 'Mon..Fri *-*-* 09:00:00')
    clickText(root, '转换')
    expect(outputValue(root)).toBe('0 9 * * 1-5')
    expect(errorText(root)).toBe('')

    setValue(input, 'not a calendar')
    clickText(root, '转换')
    expect(outputValue(root)).toBe('')
    expect(errorText(root)).toContain('无法解析')
  })
})
