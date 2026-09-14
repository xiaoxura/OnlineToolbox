import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import semver from '../src/tools/devtool/semver.js'
import ulid from '../src/tools/generator/ulid.js'
import dataUrl from '../src/tools/encoding/data-url.js'
import mimeTypes from '../src/tools/devtool/mime-types.js'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function outputTextarea() {
  return root.querySelector('textarea[readonly]')
}

function runPrimaryAction() {
  root.querySelector('.btn-primary').click()
}

describe('misc utility tools', () => {
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
