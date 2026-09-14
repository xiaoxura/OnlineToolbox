import { describe, expect, it } from 'vitest'
import {
  mountTool,
  editableTextareas,
  outputValue,
  setValue,
  clickText,
  clickPrimary,
  errorText
} from '../helpers/tool-harness.js'

function statValues(container) {
  return [...container.querySelectorAll('.stat-value')].map(el => el.textContent)
}

function statValueFor(container, label) {
  const item = [...container.querySelectorAll('.stat-item')].find(
    el => el.querySelector('.stat-label')?.textContent === label
  )
  return item?.querySelector('.stat-value')?.textContent
}

describe('formatter tools - functional', () => {
  it('json: beautifies, minifies and validates', async () => {
    const c = await mountTool('json')
    const input = editableTextareas(c)[0]

    setValue(input, '{"a":1,"b":[1,2]}')
    clickPrimary(c)
    expect(outputValue(c)).toBe(JSON.stringify({ a: 1, b: [1, 2] }, null, 2))

    clickText(c, '压缩')
    expect(outputValue(c)).toBe('{"a":1,"b":[1,2]}')

    clickText(c, '校验')
    expect(outputValue(c)).toBe('JSON 格式正确！')
    expect(errorText(c)).toBe('')
  })

  it('json: reports invalid JSON', async () => {
    const c = await mountTool('json')
    setValue(editableTextareas(c)[0], '{bad json}')
    clickPrimary(c)
    expect(errorText(c)).toContain('JSON 校验失败')
    expect(outputValue(c)).toBe('')
  })

  it('css: minifies css', async () => {
    const c = await mountTool('css')
    setValue(editableTextareas(c)[0], 'a:hover { color: red; }')
    clickText(c, '压缩')
    expect(outputValue(c)).toBe('a:hover{color:red}')
  })

  it('css: beautify keeps pseudo-class colons attached to the selector', async () => {
    const c = await mountTool('css')
    setValue(editableTextareas(c)[0], 'a:hover{color:red}')
    clickPrimary(c)
    expect(outputValue(c)).toContain('a:hover')
  })

  it('html: beautifies markup with the expected tags', async () => {
    const c = await mountTool('html')
    setValue(editableTextareas(c)[0], '<div class="a"><p>Hello</p></div>')
    clickPrimary(c)
    const out = outputValue(c)
    expect(out).toContain('<p>Hello</p>')
    expect(out).toContain('<div class="a">')
  })

  it('html: minifies whitespace between tags', async () => {
    const c = await mountTool('html')
    setValue(editableTextareas(c)[0], '<div>  <p>Hello</p>  </div>')
    clickText(c, '压缩')
    expect(outputValue(c)).toBe('<div><p>Hello</p></div>')
  })

  it('sql: beautifies with SELECT/FROM/WHERE clauses', async () => {
    const c = await mountTool('sql')
    setValue(editableTextareas(c)[0], 'select id, name from users where age > 18')
    clickPrimary(c)
    const out = outputValue(c)
    expect(out).toContain('SELECT')
    expect(out).toContain('FROM')
    expect(out).toContain('WHERE')
    expect(out).toContain('id,')
    expect(errorText(c)).toBe('')
  })

  it('sql: keeps multi-word JOIN clauses intact', async () => {
    const c = await mountTool('sql')
    setValue(
      editableTextareas(c)[0],
      "select * from users u left join orders o on u.id = o.user_id"
    )
    clickPrimary(c)
    expect(outputValue(c)).toContain('LEFT JOIN')
  })

  it('xml: beautifies a document', async () => {
    const c = await mountTool('xml')
    setValue(editableTextareas(c)[0], '<?xml version="1.0"?><root><item id="1">a</item></root>')
    clickPrimary(c)
    const out = outputValue(c)
    expect(out).toContain('<item id="1">a</item>')
    expect(out).toContain('<root>')
  })

  it('xml: minifies a document', async () => {
    const c = await mountTool('xml')
    setValue(editableTextareas(c)[0], '<root>  <a>1</a>  <b>2</b>  </root>')
    clickText(c, '压缩')
    expect(outputValue(c)).toBe('<root><a>1</a><b>2</b></root>')
  })

  it('xml: escapes special characters in long text nodes', async () => {
    const c = await mountTool('xml')
    const text = 'a & b ' + 'x'.repeat(90)
    const xml = `<root><node>${text.replace(/&/g, '&amp;')}</node></root>`
    setValue(editableTextareas(c)[0], xml)
    clickPrimary(c)
    const out = outputValue(c)
    expect(out).toContain('&amp;')
    expect(out).not.toContain(' & ')
  })
})

describe('devtool tools - functional', () => {
  it('cron: auto-parses the default expression and shows next runs', async () => {
    const c = await mountTool('cron')
    expect(c.querySelector('.inline-result').textContent.length).toBeGreaterThan(0)
    const boxes = c.querySelectorAll('.result-box')
    expect(boxes[1].querySelectorAll('.stat-item').length).toBe(5)
  })

  it('cron: parses a 6-field expression and rejects garbage', async () => {
    const c = await mountTool('cron')
    const input = c.querySelector('input.input')
    setValue(input, '*/5 * * * * *')
    clickPrimary(c)
    expect(errorText(c)).toBe('')
    expect(c.querySelector('.inline-result').textContent).toContain('每')

    setValue(input, 'not-a-cron')
    clickPrimary(c)
    expect(errorText(c)).toContain('格式错误')
  })

  it('http-status: searches by code and filters by category', async () => {
    const c = await mountTool('http-status')
    const search = c.querySelector('input')
    setValue(search, '404')
    let items = c.querySelectorAll('.status-code-item')
    expect(items.length).toBe(1)
    expect(items[0].textContent).toContain('Not Found')

    setValue(search, '')
    clickText(c, '2xx 成功')
    items = c.querySelectorAll('.status-code-item')
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.querySelector('.status-code-number').textContent.startsWith('2')).toBe(true)
    }
  })

  it('user-agent: parses a desktop Chrome UA', async () => {
    const c = await mountTool('user-agent')
    setValue(
      editableTextareas(c)[0],
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    const values = statValues(c)
    expect(values).toContain('Chrome')
    expect(values).toContain('120.0.0.0')
    expect(values).toContain('Windows 10')
    expect(values).toContain('桌面')
  })

  it('regex-ref: filters reference entries', async () => {
    const c = await mountTool('regex-ref')
    const input = c.querySelector('input')
    const initial = c.querySelectorAll('.stat-item').length
    expect(initial).toBeGreaterThan(0)

    setValue(input, '前瞻')
    const filtered = c.querySelectorAll('.stat-item').length
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(initial)
    expect(c.textContent).toContain('正向前瞻')
  })

  it('css-unit: converts px values into other units', async () => {
    const c = await mountTool('css-unit')
    const numbers = c.querySelectorAll('input[type="number"]')
    expect(statValueFor(c, 'px')).toBe('16')
    expect(statValueFor(c, 'em')).toBe('1')

    setValue(numbers[0], '32')
    expect(statValueFor(c, 'px')).toBe('32')
    expect(statValueFor(c, 'em')).toBe('2')

    setValue(c.querySelector('select'), 'in')
    setValue(numbers[0], '1')
    expect(statValueFor(c, 'px')).toBe('96')
  })

  it('json-schema: infers types from the default JSON', async () => {
    const c = await mountTool('json-schema')
    clickPrimary(c)
    const schema = JSON.parse(outputValue(c))
    expect(schema.type).toBe('object')
    expect(schema.properties.name.type).toBe('string')
    expect(schema.properties.age.type).toBe('integer')
    expect(schema.properties.email.format).toBe('email')
    expect(schema.properties.tags.type).toBe('array')
    expect(schema.properties.tags.items.type).toBe('string')
  })

  it('json-schema: reports invalid JSON', async () => {
    const c = await mountTool('json-schema')
    setValue(editableTextareas(c)[0], '{bad')
    clickPrimary(c)
    expect(errorText(c)).toContain('JSON 解析失败')
  })

  it('mock-data: generates rows in text and JSON formats', async () => {
    const c = await mountTool('mock-data')
    expect(outputValue(c).split('\n').length).toBe(10)

    clickText(c, 'JSON格式')
    const rows = JSON.parse(outputValue(c))
    expect(rows).toHaveLength(10)
    expect(rows[0].phone).toMatch(/^1\d{10}$/)
    expect(rows[0].email).toContain('@')
    expect(rows[0].name.length).toBeGreaterThan(1)
  })

  it('git-ref: filters commands', async () => {
    const c = await mountTool('git-ref')
    const input = c.querySelector('input')
    const initial = c.querySelectorAll('.stat-item').length
    setValue(input, 'merge')
    const filtered = c.querySelectorAll('.stat-item').length
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(initial)
    expect(c.textContent).toContain('git merge')
  })

  it('linux-ref: filters commands', async () => {
    const c = await mountTool('linux-ref')
    const input = c.querySelector('input')
    const initial = c.querySelectorAll('.stat-item').length
    setValue(input, 'grep')
    const filtered = c.querySelectorAll('.stat-item').length
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(initial)
    expect(c.textContent).toContain('grep')
  })

  it('id-card: validates a known valid number', async () => {
    const c = await mountTool('id-card')
    setValue(c.querySelector('#idc-input'), '110101199001010015')
    clickPrimary(c)
    const values = statValues(c)
    expect(values).toContain('北京')
    expect(values).toContain('男')
    expect(values).toContain('有效')
  })

  it('id-card: generated test number is a valid 18-digit id', async () => {
    const c = await mountTool('id-card')
    clickText(c, '生成测试号码')
    const value = c.querySelector('#idc-input').value
    expect(value).toMatch(/^\d{17}[\dX]$/)

    clickPrimary(c)
    expect(errorText(c)).not.toContain('必须为18位')
  })

  it('bank-card: validates a Luhn-valid card and detects the bank', async () => {
    const c = await mountTool('bank-card')
    setValue(c.querySelector('#bc-input'), '6222020000000007')
    clickPrimary(c)
    const values = statValues(c)
    expect(values).toContain('通过')
    expect(values).toContain('工商银行')
  })

  it('bank-card: flags a bad check digit', async () => {
    const c = await mountTool('bank-card')
    setValue(c.querySelector('#bc-input'), '6222020000000008')
    clickPrimary(c)
    expect(statValues(c)).toContain('未通过')
  })

  it('credit-code: validates a known enterprise code', async () => {
    const c = await mountTool('credit-code')
    setValue(c.querySelector('#crc-input'), '91350100M000100Y43')
    clickPrimary(c)
    expect(errorText(c)).toBe('')
    expect(statValues(c)).toContain('有效')
  })

  it('credit-code: reports the correct registration authority for a 9xxx code', async () => {
    const c = await mountTool('credit-code')
    setValue(c.querySelector('#crc-input'), '91350100M000100Y43')
    clickPrimary(c)
    expect(statValues(c)).toContain('工商')
  })

  it('credit-code: accepts a valid code registered with civil affairs (5xxx)', async () => {
    const c = await mountTool('credit-code')
    setValue(c.querySelector('#crc-input'), '51100000123456789Q')
    clickPrimary(c)
    expect(errorText(c)).toBe('')
    expect(statValues(c)).toContain('有效')
  })

  it('chmod-calculator: reflects octal modes and checkbox toggles', async () => {
    const c = await mountTool('chmod-calculator')
    const command = c.querySelector('input[readonly]')
    const symbolic = c.querySelector('.inline-result')
    const modeInput = c.querySelector('input.input:not([readonly])')

    expect(command.value).toBe('chmod 755 <文件>')
    expect(symbolic.textContent).toBe('rwxr-xr-x')

    setValue(modeInput, '644')
    expect(command.value).toBe('chmod 644 <文件>')
    expect(symbolic.textContent).toBe('rw-r--r--')

    const ownerRead = c.querySelector('#user-read')
    ownerRead.checked = false
    ownerRead.dispatchEvent(new Event('change', { bubbles: true }))
    expect(modeInput.value).toBe('244')
  })

  it('sql-in: builds an IN condition with quoting and dedupe', async () => {
    const c = await mountTool('sql-in')
    setValue(editableTextareas(c)[0], "1001\n1002\nO'Reilly\n1001")
    clickPrimary(c)
    expect(outputValue(c)).toBe("IN (1001, 1002, 'O''Reilly')")

    setValue(c.querySelector('input.input'), 'user_id')
    clickPrimary(c)
    expect(outputValue(c)).toBe("user_id IN (1001, 1002, 'O''Reilly')")
  })

  it('format-check: validates phones and emails', async () => {
    const c = await mountTool('format-check')
    const input = c.querySelector('#fc-input')

    setValue(input, '13800138000')
    clickPrimary(c)
    expect(c.textContent).toContain('格式正确')

    clickText(c, '邮箱')
    setValue(input, 'not-an-email')
    clickPrimary(c)
    expect(c.textContent).toContain('格式错误')

    setValue(input, 'user@example.com')
    clickPrimary(c)
    expect(c.textContent).toContain('格式正确')
    expect(c.textContent).toContain('用户名: user')
  })

  it('format-check: extracts the operator segment from a valid phone', async () => {
    const c = await mountTool('format-check')
    setValue(c.querySelector('#fc-input'), '13800138000')
    clickPrimary(c)
    expect(c.textContent).toContain('运营商号段: 138')
  })

  it('format-check: rejects an impossible calendar date', async () => {
    const c = await mountTool('format-check')
    clickText(c, '日期')
    setValue(c.querySelector('#fc-input'), '2024-02-31')
    clickPrimary(c)
    expect(c.textContent).toContain('格式错误')
  })

  it('color-contrast: computes the WCAG ratio', async () => {
    const c = await mountTool('color-contrast')
    expect(c.querySelector('.contrast-result').textContent).toContain(':1')

    setValue(c.querySelector('[aria-label="前景色十六进制值"]'), '#000000')
    expect(c.querySelector('.contrast-result').textContent).toContain('21.00:1')
  })

  it('semver: compares and upgrades versions', async () => {
    const c = await mountTool('semver')
    expect(c.querySelector('.result-box').textContent).toContain('低于')

    setValue(c.querySelector('select'), 'major')
    expect(c.querySelector('.result-box').textContent).toContain('升级结果：2.0.0')
  })

  it('mime-types: renders rows and filters on search', async () => {
    const c = await mountTool('mime-types')
    const search = c.querySelector('input[type="search"]')
    expect(c.querySelectorAll('tbody tr').length).toBeGreaterThan(0)

    setValue(search, 'webp')
    const rows = c.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('image/webp')
  })
})
