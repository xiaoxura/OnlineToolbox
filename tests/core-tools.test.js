import { describe, expect, it } from 'vitest'

describe('core tool behavior', () => {
  it('encodes and decodes UTF-8 Base64', async () => {
    const { default: tool } = await import('../src/tools/encoding/base64.js')
    const container = document.createElement('main')
    tool.render(container)
    const [input, output] = container.querySelectorAll('textarea')
    input.value = '你好 OnlineToolbox'
    input.dispatchEvent(new Event('input'))
    expect(output.value).toBe('5L2g5aW9IE9ubGluZVRvb2xib3g=')
    const encoded = output.value
    container.querySelectorAll('.tab-btn')[1].click()
    input.value = encoded
    input.dispatchEvent(new Event('input'))
    expect(output.value).toBe('你好 OnlineToolbox')
  })

  it('formats valid JSON', async () => {
    const { default: tool } = await import('../src/tools/formatter/json.js')
    const container = document.createElement('main')
    tool.render(container)
    const [input, output] = container.querySelectorAll('textarea')
    input.value = '{"ok":true,"items":[1,2]}'
    container.querySelector('.btn-primary').click()
    expect(JSON.parse(output.value)).toEqual({ ok: true, items: [1, 2] })
  })

  it('round-trips UTF-8 Base58 text', async () => {
    const { encodeBase58, decodeBase58 } = await import('../src/tools/encoding/base58.js')
    const encoded = encodeBase58('你好 OnlineToolbox')
    expect(decodeBase58(encoded)).toBe('你好 OnlineToolbox')
  })

  it('calculates IPv4 CIDR ranges', async () => {
    const { calculateCidr } = await import('../src/tools/network/cidr-calculator.js')
    expect(calculateCidr('192.168.1.10/24')).toMatchObject({
      mask: '255.255.255.0', network: '192.168.1.0', broadcast: '192.168.1.255', usable: 254
    })
  })

  it('validates chmod octal modes', async () => {
    const { permissionFromMode } = await import('../src/tools/devtool/chmod-calculator.js')
    expect(permissionFromMode('755')).toEqual([7, 5, 5])
    expect(() => permissionFromMode('888')).toThrow()
  })


  it('generates nested TypeScript types from JSON', async () => {
    const { jsonToTypeScript } = await import('../src/tools/converter/json-typescript.js')
    const result = jsonToTypeScript({ id: 1, user: { name: 'Alice' }, roles: ['admin'] }, 'ApiResult')
    expect(result).toContain('interface ApiResult')
    expect(result).toContain('user: User;')
    expect(result).toContain('roles: string[];')
  })

  it('generates safe SQL IN conditions', async () => {
    const { generateSqlIn } = await import('../src/tools/devtool/sql-in.js')
    expect(generateSqlIn("1\n2\nO'Reilly\n1", { field: 'id' })).toBe("id IN (1, 2, 'O''Reilly')")
  })

  it('performs text set operations', async () => {
    const { calculateSetOperation } = await import('../src/tools/text/set-operations.js')
    expect(calculateSetOperation('apple\nbanana', 'banana\ngrape', 'intersection')).toEqual(['banana'])
    expect(calculateSetOperation('A', 'a', 'union', false)).toEqual(['a'])
  })

  it('generates CURL commands with headers and body', async () => {
    const { generateCurl } = await import('../src/tools/network/curl-generator.js')
    const result = generateCurl({ url: 'https://example.com/api', method: 'POST', headers: 'Content-Type: application/json', body: '{"ok":true}' })
    expect(result).toContain("-X POST")
    expect(result).toContain("Content-Type: application/json")
    expect(result).toContain("--data-raw")
  })

  it('updates URL parameters without losing the URL structure', async () => {
    const { updateUrlParams } = await import('../src/tools/network/url-params.js')
    expect(updateUrlParams('https://example.com/path#part', [['q', 'hello world'], ['page', '2']])).toBe('https://example.com/path?q=hello+world&page=2#part')
  })

  it('keeps image dimensions within the requested bounds', async () => {
    const { calculateTargetSize } = await import('../src/tools/image/image-compress.js')
    expect(calculateTargetSize(4000, 2000, 1000, 1000)).toEqual({ width: 1000, height: 500 })
    expect(calculateTargetSize(400, 200, 1000, 1000)).toEqual({ width: 400, height: 200 })
  })

})
