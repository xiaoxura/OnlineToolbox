import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mountTool,
  editableTextareas,
  outputValue,
  setValue,
  clickText,
  clickPrimary,
  errorText,
  flush
} from '../helpers/tool-harness.js'

import { calculateCidr } from '../../src/tools/network/cidr-calculator.js'
import { calculateIPv6, compressIPv6, expandIPv6, parseIPv6 } from '../../src/tools/network/ipv6-calculator.js'
import { updateUrlParams } from '../../src/tools/network/url-params.js'
import { generateCurl } from '../../src/tools/network/curl-generator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sectionByTitle(container, title) {
  return [...container.querySelectorAll('.tool-section')].find(
    section => section.querySelector('h2')?.textContent === title
  )
}

function statMap(root) {
  const map = {}
  root.querySelectorAll('.stat-item').forEach(item => {
    const label = item.querySelector('.stat-label')?.textContent
    const value = item.querySelector('.stat-value')?.textContent
    if (label != null && value != null) map[label] = value
  })
  return map
}

function resultTableMap(container) {
  const map = {}
  container.querySelectorAll('tbody tr').forEach(row => {
    const key = row.querySelector('th')?.textContent
    const value = row.querySelector('td span')?.textContent
    if (key != null) map[key] = value
  })
  return map
}

function countStatItems(container) {
  return container.querySelectorAll('.stat-item').length
}

function press(container, label) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === label)
  if (!button) throw new Error(`calculator button not found: ${label}`)
  button.click()
}

function displayValue(container) {
  return container.querySelector('.calculator-display .stat-value')?.textContent
}

beforeEach(() => {
  document.body.replaceChildren()
  // expire any cookies left over from earlier tests
  if (document.cookie) {
    document.cookie.split(';').forEach(pair => {
      const name = pair.split('=')[0].trim()
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// network / cidr-calculator
// ---------------------------------------------------------------------------

describe('cidr-calculator', () => {
  it('calculates a /24 network exactly', () => {
    expect(calculateCidr('192.168.1.10/24')).toEqual({
      address: '192.168.1.10',
      mask: '255.255.255.0',
      network: '192.168.1.0',
      broadcast: '192.168.1.255',
      first: '192.168.1.1',
      last: '192.168.1.254',
      total: 256,
      usable: 254
    })
  })

  it('calculates /8, /30, /31 and /32 boundaries', () => {
    expect(calculateCidr('10.0.0.1/8')).toMatchObject({
      mask: '255.0.0.0',
      network: '10.0.0.0',
      broadcast: '10.255.255.255',
      total: 16777216,
      usable: 16777214
    })
    expect(calculateCidr('172.16.5.4/30')).toMatchObject({
      network: '172.16.5.4',
      broadcast: '172.16.5.7',
      first: '172.16.5.5',
      last: '172.16.5.6',
      total: 4,
      usable: 2
    })
    expect(calculateCidr('192.168.1.4/31')).toMatchObject({
      network: '192.168.1.4',
      broadcast: '192.168.1.5',
      first: '192.168.1.4',
      last: '192.168.1.5',
      total: 2,
      usable: 2
    })
    expect(calculateCidr('192.168.1.5/32')).toMatchObject({
      mask: '255.255.255.255',
      network: '192.168.1.5',
      broadcast: '192.168.1.5',
      first: '192.168.1.5',
      last: '192.168.1.5',
      total: 1,
      usable: 1
    })
  })

  it('handles the /0 default route', () => {
    expect(calculateCidr('0.0.0.0/0')).toMatchObject({
      mask: '0.0.0.0',
      network: '0.0.0.0',
      broadcast: '255.255.255.255',
      total: 4294967296,
      usable: 4294967294
    })
  })

  it('rejects malformed input', () => {
    for (const bad of ['999.1.1.1/24', '1.2.3/24', '1.2.3.4/33', '1.2.3.4', '1.2.3.4/abc']) {
      expect(() => calculateCidr(bad)).toThrow()
    }
  })

  it('renders the result table in the UI', async () => {
    const container = await mountTool('cidr-calculator')
    setValue(container.querySelector('input.input'), '192.168.1.10/24')
    clickPrimary(container)
    expect(errorText(container)).toBe('')
    const map = resultTableMap(container)
    expect(map['网络地址']).toBe('192.168.1.0')
    expect(map['广播地址']).toBe('192.168.1.255')
    expect(map['地址总数']).toBe('256')
  })
})

// ---------------------------------------------------------------------------
// network / ipv6-calculator
// ---------------------------------------------------------------------------

describe('ipv6-calculator', () => {
  it('compresses and expands addresses', () => {
    expect(compressIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1')
    expect(expandIPv6('2001:db8::1')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001')
    expect(compressIPv6('0000:0000:0000:0000:0000:0000:0000:0000')).toBe('::')
    expect(compressIPv6('0000:0000:0000:0000:0001:0000:0000:0000')).toBe('::1:0:0:0')
  })

  it('chooses the first of two equal zero runs (RFC 5952)', () => {
    expect(compressIPv6('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1')
  })

  it('calculates CIDR ranges above 2^53 exactly', () => {
    const result = calculateIPv6('2001:db8::1/64')
    expect(result).toMatchObject({
      compressed: '2001:db8::1',
      expanded: '2001:0db8:0000:0000:0000:0000:0000:0001',
      network: '2001:db8::',
      first: '2001:db8::',
      last: '2001:db8::ffff:ffff:ffff:ffff',
      total: '18446744073709551616'
    })
  })

  it('supports IPv4 tails and /0 and /128', () => {
    expect(calculateIPv6('::ffff:192.0.2.128/120')).toMatchObject({
      compressed: '::ffff:c000:280',
      network: '::ffff:c000:200',
      last: '::ffff:c000:2ff',
      total: '256'
    })
    expect(calculateIPv6('2001:db8::1/128')).toMatchObject({
      network: '2001:db8::1', first: '2001:db8::1', last: '2001:db8::1', total: '1'
    })
    expect(calculateIPv6('2001:db8::1/0')).toMatchObject({
      network: '::', last: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
      total: '340282366920938463463374607431768211456'
    })
  })

  it('rejects malformed addresses', () => {
    for (const bad of ['2001:db8::1::2', '2001:db8:0:0:0:0:0:0:1', '::ffff:192.0.2.999', '2001:db8::1/129', 'fe80::1%eth0']) {
      expect(() => parseIPv6(bad)).toThrow()
    }
  })

  it('renders the UI table', async () => {
    const container = await mountTool('ipv6-calculator')
    setValue(container.querySelector('input[type="text"]'), '2001:db8::1/64')
    clickPrimary(container)
    const map = resultTableMap(container)
    expect(map['压缩表示']).toBe('2001:db8::1')
    expect(map['网络地址']).toBe('2001:db8::')
    expect(map['地址总数']).toBe('18446744073709551616')
  })
})

// ---------------------------------------------------------------------------
// network / url-params
// ---------------------------------------------------------------------------

describe('url-params', () => {
  it('rebuilds a URL from parameter pairs', () => {
    expect(updateUrlParams('https://example.com/search?q=old#frag', [['q', 'new'], ['page', '2']]))
      .toBe('https://example.com/search?q=new&page=2#frag')
  })

  it('filters empty keys and keeps duplicate keys', () => {
    expect(updateUrlParams('https://example.com/path', [['', 'ignored'], ['a', 'b']]))
      .toBe('https://example.com/path?a=b')
    expect(updateUrlParams('https://example.com/?x=1', [['tag', 'js'], ['tag', 'css']]))
      .toBe('https://example.com/?tag=js&tag=css')
  })

  it('serializes spaces as +', () => {
    expect(updateUrlParams('https://example.com/', [['q', 'a b']])).toBe('https://example.com/?q=a+b')
  })

  it('parses a URL and regenerates it through the UI', async () => {
    const container = await mountTool('url-params')
    setValue(container.querySelector('input.input'), 'https://example.com/search?q=online+tools&page=1')
    clickText(container, '解析 URL')
    expect(outputValue(container)).toBe('https://example.com/search?q=online+tools&page=1')
  })

  it('shows an error for an invalid URL', async () => {
    const container = await mountTool('url-params')
    setValue(container.querySelector('input.input'), 'not a url')
    clickText(container, '解析 URL')
    expect(errorText(container)).not.toBe('')
  })
})

// ---------------------------------------------------------------------------
// network / curl-generator
// ---------------------------------------------------------------------------

describe('curl-generator', () => {
  it('generates a simple GET command', () => {
    expect(generateCurl({ url: 'https://example.com/api', method: 'GET' }))
      .toBe("curl -X GET 'https://example.com/api'")
  })

  it('generates headers, body and auth', () => {
    const expected = [
      "curl -X POST 'https://api.example.com/users'",
      "  -H 'Content-Type: application/json'",
      "  -H 'Accept: application/json'",
      "  --data-raw '{\"name\":\"Alice\"}'"
    ].join(' \\\n')
    expect(generateCurl({
      url: 'https://api.example.com/users',
      method: 'POST',
      headers: 'Content-Type: application/json\nAccept: application/json',
      body: '{"name":"Alice"}'
    })).toBe(expected)
  })

  it('quotes single quotes safely', () => {
    const cmd = generateCurl({ url: "https://x.test/?q=a'b", method: 'GET' })
    expect(cmd).toBe(`curl -X GET 'https://x.test/?q=a'"'"'b'`)
  })

  it('rejects missing URL and malformed headers', () => {
    expect(() => generateCurl({ url: '   ' })).toThrow()
    expect(() => generateCurl({ url: 'not a url' })).toThrow()
    expect(() => generateCurl({ url: 'https://x.test', headers: 'NoColonHere' })).toThrow()
  })

  it('renders the command in the UI', async () => {
    const container = await mountTool('curl-generator')
    const inputs = container.querySelectorAll('input.input')
    setValue(inputs[0], 'https://api.example.com/users')
    container.querySelector('select.select').value = 'POST'
    const textareas = editableTextareas(container)
    setValue(textareas[0], 'Content-Type: application/json')
    setValue(textareas[1], '{"name":"Alice"}')
    clickPrimary(container)
    expect(outputValue(container)).toContain("curl -X POST 'https://api.example.com/users'")
    expect(outputValue(container)).toContain("--data-raw '{\"name\":\"Alice\"}'")
  })
})

// ---------------------------------------------------------------------------
// network / url-parser
// ---------------------------------------------------------------------------

describe('url-parser', () => {
  it('parses all URL components', async () => {
    const container = await mountTool('url-parser')
    setValue(container.querySelector('input.input'), 'https://user:pass@example.com:8080/path/to?q=1&r=two#hash')
    clickPrimary(container)
    const map = statMap(container)
    expect(map['协议 (protocol)']).toBe('https:')
    expect(map['主机名 (hostname)']).toBe('example.com')
    expect(map['端口 (port)']).toBe('8080')
    expect(map['路径 (pathname)']).toBe('/path/to')
    expect(map['查询 (search)']).toBe('?q=1&r=two')
    expect(map['哈希 (hash)']).toBe('#hash')
    expect(map['源 (origin)']).toBe('https://example.com:8080')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('shows an error for invalid input', async () => {
    const container = await mountTool('url-parser')
    setValue(container.querySelector('input.input'), 'not a url')
    clickPrimary(container)
    expect(errorText(container)).toContain('无效的 URL')
  })
})

// ---------------------------------------------------------------------------
// network / header-parse
// ---------------------------------------------------------------------------

describe('header-parse', () => {
  it('parses a status line, headers and counts important ones', async () => {
    const container = await mountTool('header-parse')
    const raw = [
      'HTTP/1.1 200 OK',
      'Content-Type: text/html; charset=UTF-8',
      'Cache-Control: max-age=3600',
      'Set-Cookie: session=abc123; HttpOnly',
      'X-Custom: hello'
    ].join('\n')
    setValue(editableTextareas(container)[0], raw)
    clickPrimary(container)
    expect(errorText(container)).toBe('')
    const status = sectionByTitle(container, '状态行')
    expect(status.querySelector('.stat-value').textContent).toBe('HTTP/1.1 200 OK')
    const summary = statMap(sectionByTitle(container, '解析摘要'))
    expect(summary['总 Header 数']).toBe('4')
    expect(summary['重要 Header 数']).toBe('3')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('clears the result', async () => {
    const container = await mountTool('header-parse')
    setValue(editableTextareas(container)[0], 'X-A: 1')
    clickPrimary(container)
    clickText(container, '清空')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// network / port-check
// ---------------------------------------------------------------------------

describe('port-check', () => {
  it('lists all ports initially and filters by search', async () => {
    const container = await mountTool('port-check')
    expect(countStatItems(container)).toBe(19)
    setValue(container.querySelector('input.input'), 'ssh')
    expect(countStatItems(container)).toBe(1)
    expect(container.textContent).toContain('SSH')
  })

  it('filters by category', async () => {
    const container = await mountTool('port-check')
    const select = container.querySelector('select.select')
    setValue(select, 'database')
    expect(countStatItems(container)).toBe(4)
    expect(container.textContent).toContain('MySQL')
    expect(container.textContent).toContain('MongoDB')
  })

  it('reports no matches', async () => {
    const container = await mountTool('port-check')
    setValue(container.querySelector('input.input'), 'zzzzz')
    expect(errorText(container)).toContain('未找到')
  })
})

// ---------------------------------------------------------------------------
// network / cookie-viewer
// ---------------------------------------------------------------------------

describe('cookie-viewer', () => {
  it('renders cookies present on the document', async () => {
    document.cookie = 'sid=abc123'
    document.cookie = 'theme=dark'
    const container = await mountTool('cookie-viewer')
    const map = statMap(container)
    expect(map['Cookie 数量']).toBe('2')
    const rows = [...container.querySelectorAll('tbody tr')].map(r => [
      r.querySelectorAll('td')[0].textContent,
      r.querySelectorAll('td')[1].textContent
    ])
    expect(rows).toEqual(expect.arrayContaining([['sid', 'abc123'], ['theme', 'dark']]))
  })

  it('splits values containing = correctly', async () => {
    document.cookie = 'token=a=b=c'
    const container = await mountTool('cookie-viewer')
    const row = container.querySelector('tbody tr')
    expect(row.querySelectorAll('td')[1].textContent).toBe('a=b=c')
  })
})

// ---------------------------------------------------------------------------
// network / query-string
// ---------------------------------------------------------------------------

describe('query-string', () => {
  it('converts JSON to a query string including arrays', async () => {
    const container = await mountTool('query-string')
    setValue(editableTextareas(container)[0], '{"page":1,"tag":["js","css"],"draft":false}')
    clickPrimary(container)
    expect(outputValue(container)).toBe('page=1&tag=js&tag=css&draft=false')
  })

  it('converts repeated query keys back to arrays', async () => {
    const container = await mountTool('query-string')
    clickText(container, 'Query → JSON')
    setValue(editableTextareas(container)[0], 'tag=js&tag=css&page=1')
    clickPrimary(container)
    expect(JSON.parse(outputValue(container))).toEqual({ tag: ['js', 'css'], page: '1' })
  })

  it('rejects nested JSON values', async () => {
    const container = await mountTool('query-string')
    setValue(editableTextareas(container)[0], '{"filter":{"active":true}}')
    clickPrimary(container)
    expect(errorText(container)).toContain('标量')
  })
})

// ---------------------------------------------------------------------------
// network / ip-info (fetch stubbed, no real network)
// ---------------------------------------------------------------------------

describe('ip-info', () => {
  it('shows the machine public IP from the stubbed provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ip: '203.0.113.9' }) })
    vi.stubGlobal('fetch', fetchMock)
    const container = await mountTool('ip-info')
    clickText(container, '获取本机 IP')
    await flush(30)
    const section = sectionByTitle(container, '本机 IP')
    expect(section.querySelector('.stat-value').textContent).toBe('203.0.113.9')
    expect([...section.querySelectorAll('.stat-label')].map(el => el.textContent).join(' ')).toContain('ipify')
  })

  it('looks up a given IP through the primary provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ip: '8.8.8.8', country_name: 'United States', region: 'California',
        city: 'Mountain View', org: 'Google LLC', latitude: 37.4, longitude: -122.1
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const container = await mountTool('ip-info')
    setValue(container.querySelector('input.input'), '8.8.8.8')
    clickText(container, '查询')
    await flush(30)
    const map = statMap(sectionByTitle(container, 'IP 查询'))
    expect(map['IP 地址']).toBe('8.8.8.8')
    expect(map['国家']).toBe('United States')
    expect(map['数据来源']).toBe('ipapi.co')
  })

  it('falls back to the second provider when the first fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true, ip: '1.1.1.1', country: 'Australia', region: 'Queensland',
          city: 'Brisbane', connection: { org: 'Cloudflare' }, latitude: -27.4, longitude: 153.0
        })
      })
    vi.stubGlobal('fetch', fetchMock)
    const container = await mountTool('ip-info')
    setValue(container.querySelector('input.input'), '1.1.1.1')
    clickText(container, '查询')
    await flush(30)
    const map = statMap(sectionByTitle(container, 'IP 查询'))
    expect(map['IP 地址']).toBe('1.1.1.1')
    expect(map['数据来源']).toBe('ipwho.is')
  })

  it('reports an error when every provider fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const container = await mountTool('ip-info')
    setValue(container.querySelector('input.input'), '8.8.4.4')
    clickText(container, '查询')
    await flush(30)
    expect(errorText(container)).toContain('查询失败')
  })

  it('falls back on an API-level error from the primary provider', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: true, reason: 'reserved range' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, ip: '1.1.1.1', country: 'Australia' }) })
    vi.stubGlobal('fetch', fetchMock)
    const container = await mountTool('ip-info')
    setValue(container.querySelector('input.input'), '1.1.1.1')
    clickText(container, '查询')
    await flush(30)
    const map = statMap(sectionByTitle(container, 'IP 查询'))
    expect(map['IP 地址']).toBe('1.1.1.1')
    expect(map['数据来源']).toBe('ipwho.is')
  })
})

// ---------------------------------------------------------------------------
// math / calculator
// ---------------------------------------------------------------------------

describe('calculator', () => {
  it('evaluates basic arithmetic', async () => {
    const container = await mountTool('calculator')
    press(container, '7'); press(container, '+'); press(container, '8')
    expect(displayValue(container)).toBe('15')
    press(container, '=')
    expect(displayValue(container)).toBe('15')
  })

  it('uses precedence and parentheses', async () => {
    const container = await mountTool('calculator')
    for (const label of ['2', '+', '3', '×', '4']) press(container, label)
    expect(displayValue(container)).toBe('14')
  })

  it('evaluates scientific functions', async () => {
    const container = await mountTool('calculator')
    for (const label of ['√', '9', ')']) press(container, label)
    expect(displayValue(container)).toBe('3')
  })

  it('evaluates powers and squares', async () => {
    const container = await mountTool('calculator')
    for (const label of ['2', 'xⁿ', '3']) press(container, label)
    expect(displayValue(container)).toBe('8')
  })

  it('supports modulo via %', async () => {
    const container = await mountTool('calculator')
    for (const label of ['1', '0', '%', '3']) press(container, label)
    expect(displayValue(container)).toBe('1')
  })

  it('records a history entry after equals', async () => {
    const container = await mountTool('calculator')
    for (const label of ['6', '×', '7', '=']) press(container, label)
    expect(container.querySelectorAll('.calculator-history-item').length).toBe(1)
    expect(container.querySelector('.calculator-history-item').textContent).toContain('42')
  })

  it('keeps a scientific-notation result after equals', async () => {
    const container = await mountTool('calculator')
    for (const label of ['1', '÷', '1', '0', '0', '0', '0', '0', '0', '0']) press(container, label)
    press(container, '=')
    expect(displayValue(container)).toBe('1e-7')
  })

  it('percent button computes a percentage', async () => {
    const container = await mountTool('calculator')
    for (const label of ['5', '0', '%']) press(container, label)
    press(container, '=')
    expect(displayValue(container)).toBe('0.5')
  })
})

// ---------------------------------------------------------------------------
// math / big-number
// ---------------------------------------------------------------------------

describe('big-number', () => {
  it('converts big integers between bases live', async () => {
    const container = await mountTool('big-number')
    const baseSection = sectionByTitle(container, '进制转换')
    setValue(baseSection.querySelector('input.input'), '255')
    const map = statMap(baseSection)
    expect(map['2 进制:']).toBe('11111111')
    expect(map['8 进制:']).toBe('377')
    expect(map['16 进制:']).toBe('ff')
    expect(map['36 进制:']).toBe('73')
  })

  it('converts from a non-decimal input base', async () => {
    const container = await mountTool('big-number')
    const baseSection = sectionByTitle(container, '进制转换')
    const select = baseSection.querySelector('select.select')
    setValue(select, '16')
    setValue(baseSection.querySelector('input.input'), 'ff')
    expect(statMap(baseSection)['10 进制:']).toBe('255')
  })

  it('adds arbitrarily large integers exactly', async () => {
    const container = await mountTool('big-number')
    clickText(container, '大数运算')
    const arith = sectionByTitle(container, '大数运算')
    const inputs = arith.querySelectorAll('input.input')
    setValue(inputs[0], '123456789012345678901234567890')
    setValue(inputs[1], '987654321098765432109876543210')
    clickPrimary(container)
    const map = statMap(arith)
    expect(map['10 进制:']).toBe('1111111110111111111011111111100')
  })

  it('handles negative results in all bases', async () => {
    const container = await mountTool('big-number')
    clickText(container, '大数运算')
    const arith = sectionByTitle(container, '大数运算')
    const inputs = arith.querySelectorAll('input.input')
    setValue(inputs[0], '5')
    setValue(inputs[1], '8')
    setValue(arith.querySelector('select.select'), 'sub')
    clickPrimary(container)
    expect(statMap(arith)['10 进制:']).toBe('-3')
    expect(statMap(arith)['2 进制:']).toBe('-11')
  })

  it('rejects division by zero', async () => {
    const container = await mountTool('big-number')
    clickText(container, '大数运算')
    const arith = sectionByTitle(container, '大数运算')
    const inputs = arith.querySelectorAll('input.input')
    setValue(inputs[0], '5')
    setValue(inputs[1], '0')
    setValue(arith.querySelector('select.select'), 'div')
    clickPrimary(container)
    expect(errorText(arith)).toContain('除数')
  })
})
