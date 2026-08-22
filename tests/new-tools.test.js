import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import slugify from '../src/tools/text/slugify.js'
import jsonLines from '../src/tools/converter/json-lines.js'
import jsonPointer from '../src/tools/converter/json-pointer.js'
import queryString from '../src/tools/network/query-string.js'
import semver from '../src/tools/devtool/semver.js'
import ulid from '../src/tools/generator/ulid.js'
import dataUrl from '../src/tools/encoding/data-url.js'
import mimeTypes from '../src/tools/devtool/mime-types.js'
import lineEndings from '../src/tools/text/line-endings.js'
import markdownTable from '../src/tools/text/markdown-table.js'
import textWrap from '../src/tools/text/text-wrap.js'
import tomlJson, { parseToml, stringifyToml } from '../src/tools/converter/toml-json.js'
import jsonPatch from '../src/tools/converter/json-patch.js'
import ipv6Calculator, { calculateIPv6, compressIPv6, expandIPv6, parseIPv6 } from '../src/tools/network/ipv6-calculator.js'

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

function decodeJsonPointer(pointer) {
  if (pointer === '') return []
  return pointer.slice(1).split('/').map(token => token.replaceAll('~1', '/').replaceAll('~0', '~'))
}

function applyJsonPatch(documentValue, operations) {
  let result = JSON.parse(JSON.stringify(documentValue))
  for (const operation of operations) {
    const tokens = decodeJsonPointer(operation.path)
    if (!tokens.length) {
      if (operation.op === 'remove') result = undefined
      else result = JSON.parse(JSON.stringify(operation.value))
      continue
    }

    const parent = tokens.slice(0, -1).reduce((value, token) => value[token], result)
    const token = tokens.at(-1)
    if (Array.isArray(parent)) {
      if (operation.op === 'add') {
        if (token === '-') parent.push(JSON.parse(JSON.stringify(operation.value)))
        else parent.splice(Number(token), 0, JSON.parse(JSON.stringify(operation.value)))
      } else if (operation.op === 'remove') {
        parent.splice(Number(token), 1)
      } else {
        parent[Number(token)] = JSON.parse(JSON.stringify(operation.value))
      }
    } else if (operation.op === 'remove') {
      delete parent[token]
    } else {
      parent[token] = JSON.parse(JSON.stringify(operation.value))
    }
  }
  return result
}

describe('new utility tools', () => {
  it('creates a URL-safe slug while preserving non-Latin text', () => {
    slugify.render(root)
    editableTextarea().value = 'Hello, World! 你好'
    editableTextarea().dispatchEvent(new Event('input', { bubbles: true }))
    expect(outputTextarea().value).toBe('hello-world-你好')
  })

  it('converts JSON Lines into a formatted JSON array', () => {
    jsonLines.render(root)
    editableTextarea().value = '{"id":1}\n{"id":2}'
    runPrimaryAction()
    expect(JSON.parse(outputTextarea().value)).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('resolves RFC 6901 JSON Pointer paths', () => {
    jsonPointer.render(root)
    editableTextarea().value = '{"users":[{"name":"Alice"}]}'
    root.querySelector('input[type="text"]').value = '/users/0/name'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('Alice')
  })

  it('preserves JSON Pointer whitespace and rejects invalid tokens', () => {
    jsonPointer.render(root)
    editableTextarea().value = '{"a ":1,"items":[10,20],"a~2b":3}'
    const pointer = root.querySelector('input[type="text"]')

    pointer.value = '/a '
    runPrimaryAction()
    expect(outputTextarea().value).toBe('1')

    for (const invalidPointer of ['/a~2b', '/items/length']) {
      pointer.value = invalidPointer
      runPrimaryAction()
      expect(root.querySelector('.error-text').textContent).not.toBe('')
      expect(outputTextarea().value).toBe('')
    }
  })

  it('serializes repeated query parameters from JSON arrays', () => {
    queryString.render(root)
    editableTextarea().value = '{"tag":["js","css"],"page":1}'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('tag=js&tag=css&page=1')
  })

  it('keeps special query keys and rejects nested JSON values', () => {
    queryString.render(root)
    root.querySelector('[data-value="query-to-json"]').click()
    editableTextarea().value = '__proto__=x&ok=1'
    runPrimaryAction()
    const parsed = JSON.parse(outputTextarea().value)
    expect(Object.hasOwn(parsed, '__proto__')).toBe(true)
    expect(parsed.__proto__).toBe('x')
    expect(parsed.ok).toBe('1')

    root.querySelector('[data-value="json-to-query"]').click()
    editableTextarea().value = '{"filter":{"active":true}}'
    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).toContain('仅支持标量')
  })

  it('compares semantic versions including prereleases', () => {
    semver.render(root)
    const [first, second] = root.querySelectorAll('input[type="text"]')
    first.value = '2.0.0-beta.1'
    second.value = '2.0.0'
    first.dispatchEvent(new Event('input', { bubbles: true }))
    expect(root.querySelector('.result-box').textContent).toContain('低于')
  })

  it('compares arbitrary-size SemVer numbers and rejects malformed identifiers', () => {
    semver.render(root)
    const [first, second] = root.querySelectorAll('input[type="text"]')
    first.value = '9007199254740992.0.0'
    second.value = '9007199254740993.0.0'
    first.dispatchEvent(new Event('input', { bubbles: true }))
    expect(root.querySelector('.result-box').textContent).toContain('低于')

    for (const invalidVersion of ['1.0.0-01', '1.0.0-alpha..1', '1.0.0+build..1']) {
      first.value = invalidVersion
      first.dispatchEvent(new Event('input', { bubbles: true }))
      expect(root.querySelector('.result-box').textContent).toContain('无效的 SemVer')
    }
  })

  it('generates valid 26-character ULIDs', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    ulid.render(root)
    root.querySelector('input[type="number"]').value = '2.5'
    runPrimaryAction()
    const values = outputTextarea().value.split('\n')
    expect(values).toHaveLength(2)
    expect(values.every(value => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value))).toBe(true)
    expect(values).toEqual([...values].sort())
    expect(root.querySelector('.inline-result').textContent).toBe('已生成 2 个 ULID')
  })

  it('reads a local file into a Data URL', async () => {
    dataUrl.render(root)
    const input = root.querySelector('input[type="file"]')
    Object.defineProperty(input, 'files', { value: [new File(['hello'], 'hello.txt', { type: 'text/plain' })] })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await vi.waitFor(() => expect(outputTextarea().value).toBe('data:text/plain;base64,aGVsbG8='))
  })

  it('ignores stale Data URL reads after replacement or clearing', () => {
    const readers = []
    class ControlledFileReader extends EventTarget {
      static LOADING = 1
      readyState = 0
      result = null

      readAsDataURL(file) {
        this.file = file
        this.readyState = ControlledFileReader.LOADING
        readers.push(this)
      }

      abort() {
        this.readyState = 2
      }

      complete(result) {
        this.result = result
        this.readyState = 2
        this.dispatchEvent(new Event('load'))
      }
    }
    vi.stubGlobal('FileReader', ControlledFileReader)
    dataUrl.render(root)
    const input = root.querySelector('input[type="file"]')
    let files = [new File(['old'], 'old.txt', { type: 'text/plain' })]
    Object.defineProperty(input, 'files', { configurable: true, get: () => files })

    input.dispatchEvent(new Event('change', { bubbles: true }))
    files = [new File(['new'], 'new.txt', { type: 'text/plain' })]
    input.dispatchEvent(new Event('change', { bubbles: true }))
    readers[0].complete('data:text/plain;base64,b2xk')
    expect(outputTextarea().value).toBe('')
    readers[1].complete('data:text/plain;base64,bmV3')
    expect(outputTextarea().value).toBe('data:text/plain;base64,bmV3')

    files = [new File(['late'], 'late.txt', { type: 'text/plain' })]
    input.dispatchEvent(new Event('change', { bubbles: true }))
    const clearButton = [...root.querySelectorAll('button')].find(button => button.textContent === '清空')
    clearButton.click()
    readers[2].complete('data:text/plain;base64,bGF0ZQ==')
    expect(outputTextarea().value).toBe('')
  })

  it('preserves the original count of trailing line endings', () => {
    lineEndings.render(root)
    editableTextarea().value = 'alpha'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('alpha')

    editableTextarea().value = 'alpha\n\n'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('alpha\n\n')
    const finalNewline = [...root.querySelectorAll('input[type="checkbox"]')][1]
    finalNewline.click()
    expect(outputTextarea().value).toBe('alpha')
  })

  it('converts multiline quoted CSV fields into single Markdown rows', () => {
    markdownTable.render(root)
    editableTextarea().value = 'name,note\nAlice,"line 1\nline 2"\nBob,"a ""quote"""'
    runPrimaryAction()
    expect(outputTextarea().value).toContain('Alice | line 1<br>line 2')
    expect(outputTextarea().value).toContain('Bob | a "quote"')
    expect(outputTextarea().value.split('\n')).toHaveLength(4)

    editableTextarea().value = 'name,note\nAlice,"unfinished'
    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).toContain('解析失败')
  })

  it('wraps after an unsplit long word and keeps grapheme clusters intact', () => {
    textWrap.render(root)
    const width = root.querySelector('input[type="number"]')
    const breakLong = root.querySelector('input[type="checkbox"]')
    width.value = '10'
    breakLong.click()
    editableTextarea().value = 'supercalifragilistic short words after'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('supercalifragilistic\nshort\nwords\nafter')

    breakLong.click()
    const family = '👨‍👩‍👧‍👦'
    editableTextarea().value = family.repeat(11)
    runPrimaryAction()
    expect(outputTextarea().value).toBe(`${family.repeat(10)}\n${family}`)
  })

  it('filters the MIME reference by extension or content type', () => {
    mimeTypes.render(root)
    const search = root.querySelector('input[type="search"]')
    search.value = 'webp'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const rows = [...root.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('image/webp')
  })

  it('converts TOML tables and array tables in both UI directions', () => {
    tomlJson.render(root)
    const toml = [
      'title = "Example"',
      '',
      '[owner]',
      'name = "Alice"',
      '',
      '[[servers]]',
      'name = "alpha"',
      'ports = [8000, 8001]',
      '',
      '[[servers]]',
      'name = "beta"'
    ].join('\n')
    editableTextarea().value = toml
    runPrimaryAction()
    expect(JSON.parse(outputTextarea().value)).toEqual({
      title: 'Example',
      owner: { name: 'Alice' },
      servers: [
        { name: 'alpha', ports: [8000, 8001] },
        { name: 'beta' }
      ]
    })

    root.querySelector('.segmented-btn[data-value="json-to-toml"]').click()
    const expected = {
      title: 'Example',
      owner: { name: 'Alice' },
      servers: [
        { name: 'alpha', ports: [8000, 8001] },
        { name: 'beta' }
      ]
    }
    editableTextarea().value = JSON.stringify(expected)
    runPrimaryAction()
    expect(parseToml(outputTextarea().value)).toEqual(expected)
    expect(stringifyToml(expected)).toBe(outputTextarea().value)
  })

  it('clears TOML output when malformed input would otherwise be partially converted', () => {
    tomlJson.render(root)
    editableTextarea().value = 'title = "valid"\ntitle = "duplicate"'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('')
    expect(root.querySelector('.error-text').textContent).not.toBe('')
  })

  it('keeps TOML dates and inline tables JSON-safe', () => {
    const value = parseToml([
      'created = 1979-05-27',
      'point = { x = 1, label = "origin" }',
      'mixed = [1, "two", true]'
    ].join('\n'))
    expect(value).toEqual({
      created: '1979-05-27',
      point: { x: 1, label: 'origin' },
      mixed: [1, 'two', true]
    })
    expect(JSON.stringify(value)).toContain('1979-05-27')
  })

  it('rejects unsafe TOML integers and clears the UI output', () => {
    expect(() => parseToml('value = 9007199254740992')).toThrow()

    tomlJson.render(root)
    editableTextarea().value = 'value = 9007199254740992'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('')
    expect(root.querySelector('.error-text').textContent).not.toBe('')
  })

  it('rejects values that JSON cannot represent as TOML', () => {
    expect(() => stringifyToml({ value: null })).toThrow()
    expect(() => stringifyToml({ value: undefined })).toThrow()
    expect(() => stringifyToml({ value: Number.NaN })).toThrow()
    expect(() => stringifyToml({ value: new Date() })).toThrow()
    expect(() => stringifyToml({ value: 1n })).toThrow()
    expect(() => stringifyToml({ value: 9007199254740992 })).toThrow()
    expect(() => stringifyToml({ nested: { values: [1, 9007199254740992] } })).toThrow()
  })

  it('rejects TOML date/time precision that JSON Date would truncate', () => {
    expect(() => parseToml('created = 1979-05-27T07:32:00.123456Z')).toThrow(/毫秒精度/)
    expect(() => parseToml('created = 07:32:00.123456')).toThrow(/毫秒精度/)
    expect(() => parseToml('created = "1979-05-27T07:32:00.123456Z"')).not.toThrow()
  })

  it('generates an applicable JSON Patch for nested arrays and escaped pointers', () => {
    jsonPatch.render(root)
    const [sourceInput, targetInput] = root.querySelectorAll('textarea:not([readonly])')
    const source = {
      config: { retries: 1, 'feature/flag': { enabled: false } },
      items: [{ name: 'one', tags: ['a'] }, { name: 'two' }],
      'a~b': 'old',
      removed: true
    }
    const target = {
      config: { retries: 3, 'feature/flag': { enabled: true } },
      items: [
        { name: 'one', tags: ['a', 'b'] },
        { name: 'two', enabled: true },
        { name: 'three' }
      ],
      'a~b': 'new',
      added: { value: 42 }
    }
    sourceInput.value = JSON.stringify(source)
    targetInput.value = JSON.stringify(target)
    runPrimaryAction()

    const patch = JSON.parse(outputTextarea().value)
    expect(patch).toEqual(expect.arrayContaining([
      { op: 'replace', path: '/config/retries', value: 3 },
      { op: 'replace', path: '/config/feature~1flag/enabled', value: true },
      { op: 'add', path: '/items/0/tags/1', value: 'b' },
      { op: 'add', path: '/items/2', value: { name: 'three' } },
      { op: 'replace', path: '/a~0b', value: 'new' },
      { op: 'remove', path: '/removed' }
    ]))
    expect(applyJsonPatch(source, patch)).toEqual(target)
  })

  it('renders IPv6 normalization and CIDR ranges in the UI', () => {
    ipv6Calculator.render(root)
    const input = root.querySelector('input[type="text"]')
    input.value = '2001:0db8:0000:0000:0000:ff00:0042:8329/64'
    runPrimaryAction()
    const rows = [...root.querySelectorAll('tbody tr')]
    const values = new Map(rows.map(row => [row.querySelector('th').textContent, row.querySelector('td span').textContent]))
    expect(values.get('压缩表示')).toBe('2001:db8::ff00:42:8329')
    expect(values.get('展开表示')).toBe('2001:0db8:0000:0000:0000:ff00:0042:8329')
    expect(values.get('网络地址')).toBe('2001:db8::')
    expect(values.get('最后地址')).toBe('2001:db8::ffff:ffff:ffff:ffff')
    expect(values.get('地址总数')).toBe('18446744073709551616')
  })

  it('handles IPv6 compression, IPv4 tails, /0 and /128 boundaries', () => {
    expect(compressIPv6('2001:0db8:0000:0000:0000:ff00:0042:8329')).toBe('2001:db8::ff00:42:8329')
    expect(expandIPv6('2001:db8::ff00:42:8329')).toBe('2001:0db8:0000:0000:0000:ff00:0042:8329')

    const ipv4Tail = calculateIPv6('::ffff:192.0.2.128/120')
    expect(ipv4Tail).toMatchObject({
      compressed: '::ffff:c000:280',
      expanded: '0000:0000:0000:0000:0000:ffff:c000:0280',
      prefix: 120,
      network: '::ffff:c000:200',
      first: '::ffff:c000:200',
      last: '::ffff:c000:2ff',
      total: '256'
    })

    const allAddresses = calculateIPv6('2001:db8::1/0')
    expect(allAddresses).toMatchObject({ network: '::', first: '::', last: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', total: '340282366920938463463374607431768211456' })

    const oneAddress = calculateIPv6('2001:db8::1/128')
    expect(oneAddress).toMatchObject({ network: '2001:db8::1', first: '2001:db8::1', last: '2001:db8::1', total: '1' })
  })

  it('rejects malformed IPv6 addresses without leaving stale UI results', () => {
    for (const invalid of ['2001:db8::1::2', '2001:db8:0:0:0:0:0:0:1', '::ffff:192.0.2.999', '::ffff:192.0.2.001', '2001:db8::1/129', 'fe80::1%eth0']) {
      expect(() => parseIPv6(invalid)).toThrow()
    }

    ipv6Calculator.render(root)
    const input = root.querySelector('input[type="text"]')
    input.value = '2001:db8::1::2'
    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).not.toBe('')
    expect(root.querySelectorAll('tbody tr')).toHaveLength(0)
  })
})
