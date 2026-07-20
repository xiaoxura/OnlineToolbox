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
})
