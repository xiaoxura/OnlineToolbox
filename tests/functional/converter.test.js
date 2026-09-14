import { describe, expect, it } from 'vitest'
import {
  mountTool,
  editableTextareas,
  outputValue,
  outputValues,
  setValue,
  clickText,
  clickPrimary,
  errorText,
  flush
} from '../helpers/tool-harness.js'

function activeUnitPanel(container) {
  return [...container.querySelectorAll('.unit-panel')].find(panel => panel.style.display === 'block')
}

describe('converter tools - functional', () => {
  it('timestamp: converts unix seconds to ISO', async () => {
    const container = await mountTool('timestamp')
    const input = container.querySelector('input[type="text"]')
    setValue(input, '0')
    expect(container.querySelector('.inline-result').textContent).toBe('1970-01-01T00:00:00.000Z')
  })

  it('timestamp: converts a millisecond timestamp from before 2001', async () => {
    const container = await mountTool('timestamp')
    const input = container.querySelector('input[type="text"]')
    // 978307200000 ms === 2001-01-01T00:00:00.000Z; must not be treated as seconds.
    setValue(input, '978307200000')
    expect(container.querySelector('.inline-result').textContent).toBe('2001-01-01T00:00:00.000Z')
  })

  it('radix: converts decimal 255 into all bases', async () => {
    const container = await mountTool('radix')
    setValue(container.querySelector('input[type="text"]'), '255')
    const values = [...container.querySelectorAll('.radix-value')].map(el => el.textContent)
    expect(values).toEqual(['11111111', '377', '255', 'FF'])
  })

  it('color: converts hex to rgb and hsl', async () => {
    const container = await mountTool('color')
    setValue(container.querySelector('[data-format="hex"]'), '#ff0000')
    expect(container.querySelector('[data-format="rgb"]').value).toBe('rgb(255, 0, 0)')
    expect(container.querySelector('[data-format="hsl"]').value).toBe('hsl(0, 100%, 50%)')
  })

  it('unit: converts length with default mm -> cm', async () => {
    const container = await mountTool('unit')
    const panel = activeUnitPanel(container)
    setValue(panel.querySelector('input[type="number"]'), '1000')
    expect(panel.querySelector('.unit-result-value').textContent).toBe('100')
  })

  it('unit: converts temperature 100C -> 212F', async () => {
    const container = await mountTool('unit')
    clickText(container, '温度')
    const panel = activeUnitPanel(container)
    setValue(panel.querySelector('input[type="number"]'), '100')
    expect(panel.querySelector('.unit-result-value').textContent).toBe('212')
  })

  it('json-yaml: JSON -> YAML', async () => {
    const container = await mountTool('json-yaml')
    setValue(editableTextareas(container)[0], '{"a":1}')
    clickText(container, 'JSON → YAML')
    expect(outputValue(container)).toBe('a: 1\n')
  })

  it('json-yaml: YAML -> JSON', async () => {
    const container = await mountTool('json-yaml')
    setValue(editableTextareas(container)[0], 'a: 1\nb:\n  - x\n  - y\n')
    clickText(container, 'YAML → JSON')
    expect(JSON.parse(outputValue(container))).toEqual({ a: 1, b: ['x', 'y'] })
  })

  it('codex-credential-converter: CLIProxyAPI -> Sub2API output', async () => {
    const container = await mountTool('codex-credential-converter')
    setValue(editableTextareas(container)[0], JSON.stringify({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      account_id: 'acc-1',
      email: 'a@b.com'
    }))
    clickText(container, '解析并转换')
    const parsed = JSON.parse(outputValue(container))
    expect(parsed.type).toBe('sub2api-data')
    expect(parsed.accounts[0].credentials.access_token).toBe('at-1')
  })

  it('toml-json: TOML -> JSON', async () => {
    const container = await mountTool('toml-json')
    setValue(editableTextareas(container)[0], 'a = 1')
    clickPrimary(container)
    expect(outputValue(container)).toBe('{\n  "a": 1\n}')
  })

  it('json-xml: JSON -> XML', async () => {
    const container = await mountTool('json-xml')
    setValue(editableTextareas(container)[0], '{"a":1}')
    clickText(container, 'JSON → XML')
    expect(editableTextareas(container)[1].value).toContain('<a>1</a>')
    expect(editableTextareas(container)[1].value).toContain('<root>')
  })

  it('json-xml: XML -> JSON accepts pasted XML', async () => {
    const container = await mountTool('json-xml')
    setValue(editableTextareas(container)[1], '<root><a>1</a></root>')
    clickText(container, 'XML → JSON')
    expect(JSON.parse(editableTextareas(container)[0].value)).toEqual({ root: { a: 1 } })
  })

  it('json-csv: array of objects -> CSV with header', async () => {
    const container = await mountTool('json-csv')
    setValue(editableTextareas(container)[0], '[{"a":1,"b":"x"}]')
    clickText(container, '转换')
    expect(outputValue(container)).toBe('a,b\n1,x')
  })

  it('json-csv: accepts null array elements without an error', async () => {
    const container = await mountTool('json-csv')
    setValue(editableTextareas(container)[0], '[null]')
    clickText(container, '转换')
    expect(errorText(container)).toBe('')
  })

  it('csv-json: CSV -> JSON array', async () => {
    const container = await mountTool('csv-json')
    setValue(editableTextareas(container)[0], 'a,b\n1,x')
    clickText(container, '转换')
    expect(JSON.parse(outputValue(container))).toEqual([{ a: 1, b: 'x' }])
  })

  it('json-path: queries a nested key', async () => {
    const container = await mountTool('json-path')
    setValue(editableTextareas(container)[0], '{"a":{"b":1},"c":2}')
    await flush(350)
    setValue(container.querySelector('input[type="text"]'), '$.a.b')
    clickText(container, '查询')
    expect(container.querySelector('.result-box').textContent).toContain('1')
  })

  it('json-path: $.* wildcard returns every child value', async () => {
    const container = await mountTool('json-path')
    setValue(editableTextareas(container)[0], '{"a":1,"b":2}')
    await flush(350)
    clickText(container, '$.*')
    const rows = [...container.querySelectorAll('.result-box .inline-result')]
    expect(rows.length).toBe(2)
  })

  it('md-to-html: converts markdown live on input', async () => {
    const container = await mountTool('md-to-html')
    setValue(container.querySelector('textarea'), '# Hi')
    expect(outputValue(container)).toContain('<h1>Hi</h1>')
    expect(outputValue(container)).toContain('<h1>')
  })

  it('html-to-jsx: rewrites class/for attributes', async () => {
    const container = await mountTool('html-to-jsx')
    setValue(container.querySelector('textarea'), '<div class="x"><label for="a">Hi</label></div>')
    clickText(container, '转换')
    expect(outputValue(container)).toContain('className="x"')
    expect(outputValue(container)).toContain('htmlFor="a"')
  })

  it('css-to-js: produces an inline style object', async () => {
    const container = await mountTool('css-to-js')
    setValue(container.querySelector('textarea'), '.box { color: red; font-size: 14px; }')
    clickText(container, '转换')
    expect(outputValues(container)[0]).toContain("color: 'red'")
    expect(outputValues(container)[0]).toContain("fontSize: '14px'")
  })

  it('json-diff: reports added and changed keys', async () => {
    const container = await mountTool('json-diff')
    const [left, right] = editableTextareas(container)
    setValue(left, '{"a":1}')
    setValue(right, '{"a":2,"b":3}')
    clickText(container, '对比差异')
    const text = container.querySelector('.json-diff-output').textContent
    expect(text).toContain('新增 1')
    expect(text).toContain('修改 1')
  })

  it('timezone: converts a datetime between zones', async () => {
    const container = await mountTool('timezone')
    setValue(container.querySelector('input[type="datetime-local"]'), '2024-01-01T12:00')
    clickText(container, '转换')
    expect(container.querySelector('.section-result').textContent).toContain('目标时间')
  })

  it('date-calc: computes the day difference', async () => {
    const container = await mountTool('date-calc')
    const [start, end] = container.querySelectorAll('input[type="date"]')
    setValue(start, '2024-01-01')
    setValue(end, '2024-01-11')
    clickPrimary(container)
    const text = container.querySelector('.section-result').textContent
    expect(text).toContain('天数差')
    expect(text).toContain('10 天')
  })

  it('json-typescript: generates an interface', async () => {
    const container = await mountTool('json-typescript')
    setValue(container.querySelector('textarea'), '{"id":1,"name":"a"}')
    clickText(container, '生成类型')
    expect(outputValue(container)).toContain('export interface Root')
    expect(outputValue(container)).toContain('id: number;')
  })

  it('amount-cn: converts a cash amount with decimal', async () => {
    const container = await mountTool('amount-cn')
    setValue(container.querySelector('input[type="text"]'), '123.45')
    clickText(container, '转换')
    expect(container.querySelector('.section-result').textContent).toContain('壹佰贰拾叁元肆角伍分')
  })

  it('amount-cn: converts a round hundred amount', async () => {
    const container = await mountTool('amount-cn')
    setValue(container.querySelector('input[type="text"]'), '100')
    clickText(container, '转换')
    expect(container.querySelector('.section-result').textContent).toContain('壹佰元整')
  })

  it('regex-visual: finds matches', async () => {
    const container = await mountTool('regex-visual')
    const [pattern] = container.querySelectorAll('input[type="text"]')
    setValue(pattern, '\\d+')
    setValue(container.querySelector('textarea'), 'abc123')
    clickText(container, '测试匹配')
    expect(container.textContent).toContain('共 1 个匹配')
    expect(errorText(container)).toBe('')
  })

  it('json-lines: JSONL -> JSON array', async () => {
    const container = await mountTool('json-lines')
    setValue(editableTextareas(container)[0], '{"id":1}\n{"id":2}')
    clickPrimary(container)
    expect(JSON.parse(outputValue(container))).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('json-pointer: resolves an RFC 6901 pointer', async () => {
    const container = await mountTool('json-pointer')
    setValue(editableTextareas(container)[0], '{"users":[{"name":"Alice"}]}')
    setValue(container.querySelector('input[type="text"]'), '/users/0/name')
    clickText(container, '查询节点')
    expect(outputValue(container)).toBe('Alice')
  })

  it('json-patch: generates replace and add operations', async () => {
    const container = await mountTool('json-patch')
    const [source, target] = editableTextareas(container)
    setValue(source, '{"a":1}')
    setValue(target, '{"a":2,"b":3}')
    clickText(container, '生成 JSON Patch')
    const patch = JSON.parse(outputValue(container))
    expect(patch).toEqual(expect.arrayContaining([
      { op: 'replace', path: '/a', value: 2 },
      { op: 'add', path: '/b', value: 3 }
    ]))
  })

  it('duration-converter: ms -> seconds by default', async () => {
    const container = await mountTool('duration-converter')
    setValue(editableTextareas(container)[0], '1000')
    clickPrimary(container)
    expect(outputValue(container)).toBe('1')
  })

  it('number-format: formats with locale grouping', async () => {
    const container = await mountTool('number-format')
    setValue(editableTextareas(container)[0], '1234567.89')
    clickPrimary(container)
    expect(outputValue(container)).toBe('1,234,567.89')
  })
})
