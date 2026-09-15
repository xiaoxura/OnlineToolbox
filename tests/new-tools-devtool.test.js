import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTwoColumnLayout, enhanceFormAccessibility } from '../src/utils/dom.js'
import dockerTool, {
  composeToDockerRun,
  composeToDockerRunWithNotices,
  dockerRunToCompose,
  parseDockerRun,
  shellQuote,
  tokenizeCommand
} from '../src/tools/devtool/docker-compose-converter.js'
import gitignoreTool, { buildGitignore, keysByGroup, TEMPLATES } from '../src/tools/devtool/gitignore-generator.js'
import cronTool, { buildCronExpression, describeCron, expandCronField, expressionToState } from '../src/tools/devtool/cron-builder.js'
import cspTool, { buildCsp, DIRECTIVES } from '../src/tools/devtool/csp-generator.js'
import xpathTool, { evaluateXPath, highlightMatches, nodePath, parseDocument } from '../src/tools/devtool/xpath-tester.js'

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

function outputs() {
  return [...root.querySelectorAll('textarea[readonly]')]
}

function inputTextareas() {
  return [...root.querySelectorAll('textarea:not([readonly])')]
}

function clickByText(scope, text) {
  const button = [...scope.querySelectorAll('button')].find(node => node.textContent.trim() === text)
  expect(button, `找不到按钮：${text}`).toBeTruthy()
  button.click()
  return button
}

// ---------------------------------------------------------------------------
// 1. docker run ↔ compose
// ---------------------------------------------------------------------------

const FULL_RUN_COMMAND = 'docker run -d --name web -p 8080:80 -p 443:443 -v /data:/usr/share/nginx/html:ro -e TZ=Asia/Shanghai --env-file .env --restart unless-stopped --network mynet --hostname web01 -w /app -u 1000:1000 --cap-add NET_ADMIN --cap-drop ALL --label env=prod -m 512m --cpus 1.5 --health-cmd "curl -f http://localhost/" nginx:1.27 nginx -g "daemon off;"'

describe('docker-compose-converter', () => {
  it('splits a command line into tokens, honouring quotes', () => {
    expect(tokenizeCommand('docker run -e "A=b c" -e \'D=e f\' nginx')).toEqual([
      'docker', 'run', '-e', 'A=b c', '-e', 'D=e f', 'nginx'
    ])
    expect(() => tokenizeCommand('docker run "unterminated')).toThrow(/引号未闭合/)
  })

  it('quotes values only when the shell needs it', () => {
    expect(shellQuote('nginx:1.27')).toBe('nginx:1.27')
    expect(shellQuote('daemon off;')).toBe("'daemon off;'")
    expect(shellQuote("it's")).toBe("'it'\\''s'")
  })

  it('maps every supported flag onto the compose service', () => {
    const { service, image, command, notices } = parseDockerRun(FULL_RUN_COMMAND)
    expect(notices).toEqual([])
    expect(image).toBe('nginx:1.27')
    expect(command).toEqual(['nginx', '-g', 'daemon off;'])
    expect(service).toMatchObject({
      image: 'nginx:1.27',
      container_name: 'web',
      attach: false,
      ports: ['8080:80', '443:443'],
      volumes: ['/data:/usr/share/nginx/html:ro'],
      environment: ['TZ=Asia/Shanghai'],
      env_file: ['.env'],
      restart: 'unless-stopped',
      network_mode: 'mynet',
      hostname: 'web01',
      working_dir: '/app',
      user: '1000:1000',
      cap_add: ['NET_ADMIN'],
      cap_drop: ['ALL'],
      labels: ['env=prod'],
      mem_limit: '512m',
      cpus: 1.5
    })
    expect(service.healthcheck).toEqual({ test: ['CMD-SHELL', 'curl -f http://localhost/'] })
  })

  it('emits valid YAML and handles inline short-flag values', () => {
    const yaml = dockerRunToCompose('docker run -p8080:80 -eFOO=bar -m512m --name=api nginx')
    expect(yaml).toContain('image: nginx')
    expect(yaml).toContain('container_name: api')
    expect(yaml).toContain('"8080:80"')
    expect(yaml).toContain('FOO=bar')
    // 服务名跟随 container_name，方便直接 docker compose up
    expect(yaml).toContain('api:')
  })

  it('round-trips docker run → compose → docker run', () => {
    const yaml = dockerRunToCompose(FULL_RUN_COMMAND)
    const command = composeToDockerRun(yaml)
    expect(parseDockerRun(command).service).toEqual(parseDockerRun(FULL_RUN_COMMAND).service)
    expect(parseDockerRun(command).command).toEqual(parseDockerRun(FULL_RUN_COMMAND).command)
    // A second trip is stable.
    expect(dockerRunToCompose(command)).toBe(yaml)
  })

  it('keeps environment/labels maps and entrypoint working in the reverse direction', () => {
    const yaml = [
      'services:',
      '  api:',
      '    image: my/api:2',
      '    attach: false',
      '    entrypoint: /bin/sh -c "npm start"',
      '    environment:',
      '      NODE_ENV: production',
      '      DEBUG:',
      '    labels:',
      '      owner: platform',
      '    healthcheck:',
      "      test: ['CMD', 'curl', '-f', 'http://localhost/health']",
      '    command: npm start'
    ].join('\n')
    const command = composeToDockerRun(yaml)
    expect(command).toContain('docker run -d')
    expect(command).not.toContain('--name')
    expect(command).toContain('-e NODE_ENV=production')
    expect(command).toContain('-e DEBUG')
    expect(command).toContain('--label owner=platform')
    expect(command).toContain("--entrypoint '/bin/sh -c \"npm start\"'")
    expect(command).toContain("--health-cmd 'curl -f http://localhost/health'")
    expect(command.endsWith('my/api:2 npm start')).toBe(true)
  })

  it('rejects unknown flags instead of dropping them', () => {
    expect(() => parseDockerRun('docker run --bogus nginx')).toThrow(/不支持的参数 --bogus/)
    expect(() => parseDockerRun('docker run -p')).toThrow(/缺少取值/)
    expect(() => parseDockerRun('docker run -d')).toThrow(/缺少镜像名称/)
    expect(() => parseDockerRun('docker ps')).toThrow(/仅支持 docker run/)
    expect(() => parseDockerRun('nginx')).toThrow(/必须以 docker 开头/)
  })

  it('reports the flags compose cannot express', () => {
    const { notices, service } = parseDockerRun('docker run --rm nginx')
    expect(service.rm).toBeUndefined()
    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('--rm')
  })

  it('rejects compose files it cannot translate', () => {
    expect(() => composeToDockerRun('services:\n  a: {image: nginx}\n  b: {image: redis}')).toThrow(/多个服务/)
    expect(() => composeToDockerRun('version: "3"')).toThrow(/未找到 services/)
    expect(() => composeToDockerRun('services:\n  a:\n    container_name: x')).toThrow(/缺少 image/)
    expect(() => composeToDockerRun('services:\n  a:\n    image: nginx\n    volumes:\n      - type: bind')).toThrow(/长语法/)
    expect(() => composeToDockerRun('[1, 2]')).toThrow(/格式不正确/)
    expect(() => composeToDockerRun('services: {a: {image: nginx, working_dir: /srv, user: "1000"}}')).not.toThrow()
  })

  it('reports compose keys without a docker run equivalent', () => {
    const { command, unknown } = composeToDockerRunWithNotices(
      'services:\n  a:\n    image: nginx\n    depends_on:\n      - b\n    restart: always'
    )
    expect(unknown).toEqual(['depends_on'])
    expect(command).toBe('docker run --restart always nginx')
  })

  it('converts in both directions through the UI', () => {
    render(dockerTool)
    const [input] = inputTextareas()
    const [output] = outputs()

    clickByText(root, '示例数据')
    expect(output.value).toContain('services:')
    expect(output.value).toContain('image: nginx:1.27')
    expect(root.querySelector('.error-text').textContent).toBe('')
    // -d 转为 attach: false（compose 没有 detach 键）
    expect(output.value).toContain('attach: false')

    input.value = 'docker run --rm nginx'
    clickByText(root, '转换')
    expect(root.querySelector('.form-hint-warn').textContent).toContain('--rm')

    input.value = 'docker run --nope nginx'
    clickByText(root, '转换')
    expect(root.querySelector('.error-text').textContent).toContain('不支持的参数')
    expect(output.value).toBe('')

    root.querySelector('.segmented-btn[data-value="to-run"]').click()
    expect(input.placeholder).toContain('docker-compose.yml')
    clickByText(root, '示例数据')
    expect(output.value.startsWith('docker run ')).toBe(true)
    expect(output.value).toContain('-p 8080:80')
  })
})

// ---------------------------------------------------------------------------
// 2. .gitignore 生成器
// ---------------------------------------------------------------------------

describe('gitignore-generator', () => {
  it('ships templates for every required ecosystem', () => {
    for (const key of [
      'node', 'python', 'java', 'go', 'rust', 'cpp', 'php', 'ruby', 'swift', 'kotlin',
      'react', 'vue', 'nextjs', 'django', 'flask', 'laravel', 'spring',
      'vscode', 'jetbrains', 'vim', 'sublime', 'macos', 'windows', 'linux'
    ]) {
      expect(TEMPLATES[key], `缺少模板：${key}`).toBeTruthy()
      expect(TEMPLATES[key].lines.length).toBeGreaterThan(0)
    }
    expect(keysByGroup('os')).toEqual(['macos', 'windows', 'linux'])
  })

  it('merges the selection with section headers', () => {
    const output = buildGitignore(['node', 'macos'])
    expect(output).toContain('# ===== Node.js =====')
    expect(output).toContain('# ===== macOS =====')
    expect(output).toContain('node_modules/')
    expect(output).toContain('.DS_Store')
    expect(output.indexOf('Node.js')).toBeLessThan(output.indexOf('macOS'))
  })

  it('de-duplicates patterns across templates and ignores unknown keys', () => {
    const output = buildGitignore(['vim', 'linux', 'nope'])
    expect(output.match(/^\*~$/gm)).toHaveLength(1)
    expect(buildGitignore([])).toBe('')
    expect(buildGitignore(['nope'])).toBe('')
    expect(buildGitignore(['django', 'python']).match(/^__pycache__\/$/gm)).toHaveLength(1)
  })

  it('generates the file from the checkbox grid', () => {
    render(gitignoreTool)
    const boxes = [...root.querySelectorAll('input[type="checkbox"]')]
    const [output] = outputs()
    expect(output.value).toBe('')
    expect(root.querySelector('.error-text').textContent).toContain('至少选择一个模板')

    boxes[0].checked = true
    boxes[0].dispatchEvent(new Event('change'))
    expect(output.value).toContain('node_modules/')

    clickByText(root, '全选')
    expect(boxes.every(box => box.checked)).toBe(true)
    expect(output.value).toContain('.DS_Store')

    clickByText(root, '清空')
    expect(boxes.some(box => box.checked)).toBe(false)
    expect(output.value).toBe('')

    clickByText(root, '示例数据')
    expect(output.value).toContain('# ===== VS Code =====')
    expect(output.value).toContain('Thumbs.db')
  })
})

// ---------------------------------------------------------------------------
// 3. Cron 表达式构建器
// ---------------------------------------------------------------------------

describe('cron-builder', () => {
  it('builds each field mode', () => {
    expect(buildCronExpression({
      minute: { mode: 'value', values: '30' },
      hour: { mode: 'value', values: '3' },
      day: { mode: 'every' },
      month: { mode: 'every' },
      weekday: { mode: 'every' }
    })).toBe('30 3 * * *')

    expect(buildCronExpression({
      minute: { mode: 'step', step: '15' },
      hour: { mode: 'every' },
      day: { mode: 'range', from: '1', to: '15' },
      month: { mode: 'value', values: '1,7' },
      weekday: { mode: 'value', values: '1-5' }
    })).toBe('*/15 * 1-15 1,7 1-5')

    expect(buildCronExpression({
      minute: { mode: 'step', step: '10', from: '5', to: '45' },
      hour: { mode: 'value', values: '9,18' }
    })).toBe('5-45/10 9,18 * * *')

    // 空值回退为 *
    expect(buildCronExpression({ minute: { mode: 'value', values: '  ' } })).toBe('* * * * *')
    expect(buildCronExpression()).toBe('* * * * *')
  })

  it('validates field values', () => {
    expect(() => buildCronExpression({ minute: { mode: 'value', values: '99' } })).toThrow(/取值范围是 0-59/)
    expect(() => buildCronExpression({ minute: { mode: 'value', values: 'a' } })).toThrow(/只能填写整数/)
    expect(() => buildCronExpression({ hour: { mode: 'range', from: '20', to: '5' } })).toThrow(/起点不能大于终点/)
    expect(() => buildCronExpression({ hour: { mode: 'range', from: '5' } })).toThrow(/同时填写起点和终点/)
    expect(() => buildCronExpression({ minute: { mode: 'step', step: '0' } })).toThrow(/步长必须大于 0/)
  })

  it('expands fields into values', () => {
    expect(expandCronField('*/15', 0, 59)).toEqual([0, 15, 30, 45])
    expect(expandCronField('1-5', 0, 59)).toEqual([1, 2, 3, 4, 5])
    expect(expandCronField('0,30', 0, 59)).toEqual([0, 30])
    expect(expandCronField('5-45/10', 0, 59)).toEqual([5, 15, 25, 35, 45])
    expect(() => expandCronField('70', 0, 59)).toThrow(/超出取值范围/)
  })

  it('describes expressions in Chinese', () => {
    expect(describeCron('* * * * *')).toBe('每分钟执行')
    expect(describeCron('*/5 * * * *')).toBe('每 5 分钟执行')
    expect(describeCron('0 * * * *')).toBe('每小时整点执行')
    expect(describeCron('30 * * * *')).toBe('每小时的第 30 分钟执行')
    expect(describeCron('0 3 * * *')).toBe('每天 03:00 执行')
    expect(describeCron('0 9,18 * * *')).toBe('每天 09:00、18:00 执行')
    expect(describeCron('0 */2 * * *')).toBe('每 2 小时执行')
    expect(describeCron('* 3 * * *')).toBe('每天 3 点的每一分钟执行')
    expect(describeCron('0 3 * * 1')).toBe('每周一 03:00 执行')
    expect(describeCron('15 8 * * 1-5')).toBe('每周一至周五 08:15 执行')
    expect(describeCron('0 3 1 * *')).toBe('每月 1 日 03:00 执行')
    expect(describeCron('0 3 1 6 *')).toBe('每年 6 月 1 日 03:00 执行')
    expect(describeCron('@daily')).toBe('每天 00:00 执行')
    expect(describeCron('@hourly')).toBe('每小时整点执行')
    expect(describeCron('@monthly')).toBe('每月 1 日 00:00 执行')
    // 6 字段（带秒）也接受，秒被忽略
    expect(describeCron('0 0 3 * * *')).toBe('每天 03:00 执行')
  })

  it('rejects malformed expressions', () => {
    expect(() => describeCron('0 3 *')).toThrow(/需要 5 个字段/)
    expect(() => describeCron('@nope')).toThrow(/不支持的时间别名/)
    expect(() => describeCron('')).toThrow(/请输入 Cron 表达式/)
    expect(() => describeCron('a b c d e')).toThrow(/无法解析的字段片段/)
  })

  it('maps expressions back onto field state', () => {
    const state = expressionToState('30 9 * * 1-5')
    expect(state.minute).toMatchObject({ mode: 'value', values: '30' })
    expect(state.hour).toMatchObject({ mode: 'value', values: '9' })
    expect(state.day.mode).toBe('every')
    expect(state.weekday).toMatchObject({ mode: 'range', from: '1', to: '5' })
    expect(expressionToState('*/15 * * * *').minute).toMatchObject({ mode: 'step', step: '15' })
  })

  it('drives the expression from the UI', () => {
    render(cronTool)
    const [expression] = outputs()
    const description = root.querySelector('.inline-result .result-value')
    expect(expression.value).toBe('0 3 * * *')
    expect(description.textContent).toBe('每天 03:00 执行')

    clickByText(root, '示例数据')
    expect(expression.value).toBe('30 9 * * 1-5')
    expect(description.textContent).toBe('每周一至周五 09:30 执行')

    // 编辑“分”字段的具体值
    const minutePanel = root.querySelector('[role="tabpanel"]')
    minutePanel.querySelector('.segmented-btn[data-value="value"]').click()
    const valueInput = minutePanel.querySelector('input[type="text"]')
    expect(valueInput).toBeTruthy()
    valueInput.value = '99'
    valueInput.dispatchEvent(new Event('input'))
    expect(root.querySelector('.error-text').textContent).toContain('取值范围是 0-59')
    expect(expression.value).toBe('')

    valueInput.value = '15'
    valueInput.dispatchEvent(new Event('input'))
    expect(expression.value).toBe('15 9 * * 1-5')
    expect(root.querySelector('.error-text').textContent).toBe('')

    // 时间别名
    const select = root.querySelector('select')
    select.value = '@weekly'
    select.dispatchEvent(new Event('change'))
    expect(expression.value).toBe('@weekly')
    expect(description.textContent).toBe('每周日 00:00 执行')

    select.value = ''
    select.dispatchEvent(new Event('change'))
    expect(expression.value).toBe('0 0 * * 0')
  })
})

// ---------------------------------------------------------------------------
// 4. CSP 生成器
// ---------------------------------------------------------------------------

describe('csp-generator', () => {
  it('builds the policy value, meta tag and nginx snippet', () => {
    const result = buildCsp({
      sources: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://cdn.example.com'],
        'upgrade-insecure-requests': []
      },
      flags: ['upgrade-insecure-requests'],
      reportUri: '/csp-report'
    })
    expect(result.value).toBe("default-src 'self'; script-src 'self' https://cdn.example.com; upgrade-insecure-requests; report-uri /csp-report")
    expect(result.header).toBe(`Content-Security-Policy: ${result.value}`)
    expect(result.meta).toBe(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.example.com; upgrade-insecure-requests; report-uri /csp-report">`)
    expect(result.nginx).toBe(`add_header Content-Security-Policy "${result.value}" always;`)
    expect(result.empty).toBe(false)
  })

  it('keeps the canonical directive order and drops empty lists', () => {
    const { value } = buildCsp({
      sources: {
        'img-src': ['data:'],
        'default-src': ["'self'", "'self'"],
        'script-src': []
      }
    })
    expect(value).toBe("default-src 'self'; img-src data:")
    expect(buildCsp({}).value).toBe('')
    expect(buildCsp({}).empty).toBe(true)
    expect(buildCsp().meta).toBe('<meta http-equiv="Content-Security-Policy" content="">')
  })

  it('escapes the meta tag content attribute', () => {
    const { meta } = buildCsp({ sources: { 'default-src': ['https://a.test/?x=1&y=2'] } })
    expect(meta).toContain('&amp;')
  })

  it('exposes the required directive checkboxes', () => {
    const names = DIRECTIVES.map(item => item.name)
    for (const name of [
      'default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'media-src',
      'object-src', 'frame-src', 'worker-src', 'manifest-src', 'base-uri', 'form-action',
      'frame-ancestors', 'upgrade-insecure-requests', 'block-all-mixed-content'
    ]) {
      expect(names).toContain(name)
    }
  })

  it('renders presets, chips and outputs in the UI', () => {
    render(cspTool)
    expect(root.querySelectorAll('input[type="checkbox"]')).toHaveLength(DIRECTIVES.length)
    expect(root.querySelector('.error-text').textContent).toContain('至少选择一条指令')

    clickByText(root, '示例数据（严格）')
    const [value, meta, nginx] = outputs()
    expect(value.value).toContain("default-src 'self'")
    expect(value.value).toContain('upgrade-insecure-requests')
    expect(meta.value.startsWith('<meta http-equiv="Content-Security-Policy" content="default-src')).toBe(true)
    expect(nginx.value.startsWith('add_header Content-Security-Policy "')).toBe(true)
    expect(root.querySelector('.error-text').textContent).toBe('')

    // 取消勾选 default-src 后不再输出该指令
    const defaultRow = root.querySelectorAll('.grid-2 > .form-group')[0]
    defaultRow.querySelector('input[type="checkbox"]').click()
    expect(outputs()[0].value).not.toContain('default-src')

    // 已勾选的 style-src：用 chip 追加来源、再添加自定义主机
    const styleRow = root.querySelectorAll('.grid-2 > .form-group')[2]
    expect(styleRow.querySelector('input[type="checkbox"]').checked).toBe(true)
    clickByText(styleRow, "'unsafe-inline'")
    expect(outputs()[0].value).toContain("style-src 'self' 'unsafe-inline'")

    const hostInput = styleRow.querySelector('input[type="text"]')
    hostInput.value = 'https://cdn.example.com'
    clickByText(styleRow, '添加')
    expect(outputs()[0].value).toContain("style-src 'self' 'unsafe-inline' https://cdn.example.com")
    expect(hostInput.value).toBe('')

    // 点击已选来源可以移除
    clickByText(styleRow, "'unsafe-inline' ✕")
    expect(outputs()[0].value).toContain("style-src 'self' https://cdn.example.com")

    clickByText(root, '清空')
    expect(outputs()[0].value).toBe('')
    expect(root.querySelector('.error-text').textContent).toContain('至少选择一条指令')
  })
})

// ---------------------------------------------------------------------------
// 5. XPath 测试器
// ---------------------------------------------------------------------------

const HTML_SAMPLE = '<div class="toolbox"><h1>标题</h1><ul><li>第一项</li><li>第二项</li><li>第三项</li></ul></div>'
const XML_SAMPLE = '<catalog><book id="bk101"><title>XML 入门</title></book><book id="bk102"><title>XPath 实战</title></book></catalog>'

describe('xpath-tester', () => {
  it('evaluates expressions against HTML and XML documents', () => {
    const html = evaluateXPath(HTML_SAMPLE, '//li', 'html')
    expect(html.count).toBe(3)
    expect(html.scalar).toBe(false)
    expect(html.items[0]).toEqual({
      type: 'element',
      name: 'li',
      value: '第一项',
      path: 'html > body > div > ul > li[1]'
    })
    expect(html.items[2].path).toBe('html > body > div > ul > li[3]')

    const xml = evaluateXPath(XML_SAMPLE, '//title', 'xml')
    expect(xml.count).toBe(2)
    expect(xml.items[1].value).toBe('XPath 实战')
    expect(xml.items[1].path).toBe('catalog > book[2] > title')

    const attributes = evaluateXPath(XML_SAMPLE, '//@id', 'xml')
    expect(attributes.count).toBe(2)
    expect(attributes.items[0]).toMatchObject({ type: 'attribute', name: 'id', value: 'bk101' })
    expect(attributes.items[0].path).toBe('catalog > book[1]/@id')

    const text = evaluateXPath(HTML_SAMPLE, '//h1/text()', 'html')
    expect(text.items[0]).toMatchObject({ type: 'text', name: '#text', value: '标题' })

    expect(evaluateXPath(HTML_SAMPLE, '//li[@class="none"]', 'html').count).toBe(0)
  })

  it('falls back to scalar results for count()/string()/boolean()', () => {
    expect(evaluateXPath(HTML_SAMPLE, 'count(//li)', 'html')).toMatchObject({
      count: 1,
      scalar: true,
      items: [{ type: 'scalar', name: '数值', value: '3' }]
    })
    expect(evaluateXPath(HTML_SAMPLE, 'string(//li[1])', 'html').items[0].value).toBe('第一项')
    expect(evaluateXPath(HTML_SAMPLE, 'boolean(//li)', 'html').items[0].value).toBe('true')
  })

  it('reports invalid expressions, invalid XML and empty input in Chinese', () => {
    expect(() => evaluateXPath(HTML_SAMPLE, '//[', 'html')).toThrow(/XPath 表达式无效/)
    expect(() => evaluateXPath('<a><b></a>', '//a', 'xml')).toThrow(/文档解析失败/)
    expect(() => evaluateXPath('<catalog><book></catalog>', '//book', 'xml')).toThrow(/文档解析失败/)
    expect(() => evaluateXPath('', '//a', 'html')).toThrow(/请输入 HTML 或 XML 内容/)
    expect(() => evaluateXPath(HTML_SAMPLE, '   ', 'html')).toThrow(/请输入 XPath 表达式/)
    expect(() => parseDocument('<a><b></a>', 'xml')).toThrow(/文档解析失败/)
    expect(parseDocument('<a><b/></a>', 'xml').documentElement.nodeName).toBe('a')
  })

  it('builds CSS-like node paths', () => {
    const doc = new DOMParser().parseFromString(HTML_SAMPLE, 'text/html')
    const items = doc.querySelectorAll('li')
    expect(nodePath(items[1])).toBe('html > body > div > ul > li[2]')
    expect(nodePath(doc.querySelector('ul'))).toBe('html > body > div > ul')
    expect(nodePath(doc.querySelector('li').firstChild)).toBe('html > body > div > ul > li[1]/text()')
    expect(nodePath(null)).toBe('')
  })

  it('highlights matches in a sanitized preview', () => {
    const preview = document.createElement('div')
    const hits = highlightMatches(preview, `${HTML_SAMPLE}<script>bad()</script>`, '//li', 'html')
    expect(hits).toBe(3)
    expect(preview.querySelectorAll('.xpath-hit')).toHaveLength(3)
    expect(preview.innerHTML).not.toContain('<script')

    const xmlPreview = document.createElement('div')
    expect(highlightMatches(xmlPreview, XML_SAMPLE, '//title', 'xml')).toBe(0)
    expect(xmlPreview.innerHTML).toBe('')
  })

  it('runs from the UI in both modes', () => {
    render(xpathTool)
    const [documentInput] = inputTextareas()
    const expressionInput = root.querySelector('input[type="text"]')
    const errorEl = () => root.querySelector('.error-text')

    clickByText(root, '示例数据')
    expect(documentInput.value).toContain('class="item"')
    expect(expressionInput.value).toBe('//li[@class="item"]')
    expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(3)
    expect(root.querySelector('.stat-item .stat-value').textContent).toBe('3')
    expect(root.querySelectorAll('.xpath-preview .xpath-hit')).toHaveLength(3)
    expect(errorEl().textContent).toBe('')

    // 实时编辑表达式
    expressionInput.value = '//a'
    expressionInput.dispatchEvent(new Event('input'))
    expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(1)
    expect(root.querySelectorAll('.xpath-preview .xpath-hit')).toHaveLength(1)

    expressionInput.value = '//['
    expressionInput.dispatchEvent(new Event('input'))
    expect(errorEl().textContent).toContain('XPath 表达式无效')
    expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(0)

    // 切换到 XML 模式
    root.querySelector('.segmented-btn[data-value="xml"]').click()
    clickByText(root, '示例数据')
    expect(expressionInput.value).toBe('//book/title')
    expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(2)
    const preview = root.querySelector('.xpath-preview')
    expect(preview.childElementCount).toBe(0)
    expect(preview.previousElementSibling.textContent).toContain('XML 模式')

    // 无效 XML 会给出解析错误
    root.querySelector('.segmented-btn[data-value="xml"]').click()
    documentInput.value = '<a><b></a>'
    documentInput.dispatchEvent(new Event('input'))
    expect(errorEl().textContent).toContain('文档解析失败')
  })
})

// ---------------------------------------------------------------------------
// 布局：记录每个工具的 IO 分栏决策（供 registry/io-layout 普查使用）
// ---------------------------------------------------------------------------

describe('devtool batch layout census', () => {
  const expectations = [
    [dockerTool, true],
    [gitignoreTool, false],
    [cronTool, false],
    [cspTool, false],
    [xpathTool, true]
  ]

  for (const [tool, expected] of expectations) {
    it(`${tool.id}: ${expected ? 'split' : 'stacked'}`, () => {
      tool.render(root)
      const split = applyTwoColumnLayout(root)
      enhanceFormAccessibility(root)
      expect(split).toBe(expected)
      // 幂等：第二遍不能再包一层
      expect(applyTwoColumnLayout(root)).toBe(false)

      if (split) {
        const grid = root.querySelector(':scope > .tool-io-grid')
        expect(grid).not.toBeNull()
        expect(grid.querySelectorAll(':scope > .tool-io-col')).toHaveLength(2)
        expect(grid.querySelector('.tool-io-output').childElementCount).toBeGreaterThan(0)
        expect(grid.querySelector('.tool-io-input textarea:not([readonly])')).not.toBeNull()
      } else {
        expect(root.querySelector('.tool-io-grid')).toBeNull()
      }
    })
  }
})

// ---------------------------------------------------------------------------
// 与 tests/tools-smoke.test.js 相同的规则自查（工具进入 registry 前先在这里跑）
// ---------------------------------------------------------------------------

describe('devtool batch smoke rules', () => {
  const tools = [dockerTool, gitignoreTool, cronTool, cspTool, xpathTool]

  for (const tool of tools) {
    it(`${tool.id}: metadata and rendered structure`, () => {
      expect(tool.id).toMatch(/^[a-z0-9-]+$/)
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.category).toBe('devtool')
      expect(tool.icon).toBeTruthy()
      expect(typeof tool.render).toBe('function')

      // render() 同步填满容器
      const returnValue = tool.render(root)
      expect(returnValue).toBeUndefined()
      expect(root.childElementCount).toBeGreaterThan(0)

      enhanceFormAccessibility(root)
      for (const control of root.querySelectorAll('input, textarea, select')) {
        const hasName = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
        expect(Boolean(hasName), `${tool.id}: unnamed ${control.tagName}`).toBe(true)
      }
      expect(root.querySelector('select.input'), `${tool.id}: select uses text-input styling`).toBeNull()
      expect(root.querySelector('button[class="btn"]'), `${tool.id}: button has no visual variant`).toBeNull()
      for (const choice of root.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
        expect(choice.closest('label'), `${tool.id}: choice is not wrapped by a label`).not.toBeNull()
      }
      expect(root.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box')).toBeNull()
      for (const table of root.querySelectorAll('table.result-table')) {
        expect(table.parentElement?.classList.contains('table-scroll'), `${tool.id}: result table is not scrollable`).toBe(true)
      }
      for (const tab of root.querySelectorAll('[role="tab"]')) {
        const panelId = tab.getAttribute('aria-controls')
        expect(panelId, `${tool.id}: tab without aria-controls`).toBeTruthy()
        expect(root.querySelector(`#${panelId}`)?.getAttribute('role')).toBe('tabpanel')
      }
      for (const group of root.querySelectorAll('[role="radiogroup"]')) {
        expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
      }
      for (const group of root.querySelectorAll('.filter-group')) {
        expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1)
      }
      // 规则 13：有文本输入的工具都要有“示例数据”按钮（可带预设后缀）
      if (root.querySelector('input[type="text"], textarea:not([readonly])')) {
        const labels = [...root.querySelectorAll('button')].map(button => button.textContent.trim())
        expect(labels.some(label => label.startsWith('示例数据')), `${tool.id}: 缺少示例数据按钮`).toBe(true)
      }
    })
  }
})
