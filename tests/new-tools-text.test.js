import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import slugify from '../src/tools/text/slugify.js'
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

describe('text utility tools', () => {
  it('creates a URL-safe slug while preserving non-Latin text', () => {
    slugify.render(root)
    editableTextarea().value = 'Hello, World! 你好'
    editableTextarea().dispatchEvent(new Event('input', { bubbles: true }))
    expect(outputTextarea().value).toBe('hello-world-你好')
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
})
