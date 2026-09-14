import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import jsonLines from '../src/tools/converter/json-lines.js'
import jsonPointer from '../src/tools/converter/json-pointer.js'
import tomlJson, { parseToml, stringifyToml } from '../src/tools/converter/toml-json.js'
import jsonPatch from '../src/tools/converter/json-patch.js'

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

describe('converter utility tools', () => {
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
})
