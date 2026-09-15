import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enhanceFormAccessibility } from '../src/utils/dom.js'
import jsonToCode, {
  inferSchema,
  mergeSchemas,
  toGo,
  toPython,
  toJava,
  toCSharp,
  toPhp,
  toRust,
  generateCode,
  pascalCase,
  camelCase,
  snakeCase,
  singularize
} from '../src/tools/converter/json-to-code.js'
import jsonFlatten, { flattenJson, unflattenJson } from '../src/tools/converter/json-flatten.js'
import jsonSort, { sortJsonKeys } from '../src/tools/converter/json-sort.js'
import objectIdTool, {
  parseObjectId,
  timestampToObjectId,
  objectIdToTimestamp,
  generateObjectId,
  parseObjectIds
} from '../src/tools/converter/objectid.js'
import numberToWordsTool, {
  numberToWords,
  numberToOrdinal,
  numberToCurrency,
  numberToChinese
} from '../src/tools/converter/number-to-words.js'

const TOOLS = [jsonToCode, jsonFlatten, jsonSort, objectIdTool, numberToWordsTool]

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function editableTextareas() {
  return [...root.querySelectorAll('textarea:not([readonly])')]
}

function outputTextarea() {
  return root.querySelector('textarea[readonly]')
}

function clickSegment(value) {
  root.querySelector(`.segmented-btn[data-value="${value}"]`).click()
}

function checkboxByLabel(text) {
  const label = [...root.querySelectorAll('label.option-item')].find(item => item.textContent.includes(text))
  return label.querySelector('input')
}

function findField(selector) {
  return root.querySelector(selector)
}

// The tool renders a <label class="label"> per field; walk from it to its control.
function fieldByLabel(text) {
  const label = [...root.querySelectorAll('label.label')].find(item => item.textContent.includes(text))
  return label.parentElement.querySelector('input, textarea, select')
}

// ---------------------------------------------------------------------------
// Shared render rules (mirrors tests/tools-smoke.test.js)
// ---------------------------------------------------------------------------

describe('new converter tools render rules', () => {
  for (const tool of TOOLS) {
    it(`${tool.id} renders a conforming form`, () => {
      expect(() => tool.render(root)).not.toThrow()
      enhanceFormAccessibility(root)
      expect(root.childElementCount).toBeGreaterThan(0)

      for (const control of root.querySelectorAll('input, textarea, select')) {
        const named = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
        expect(Boolean(named), `${tool.id}: unnamed ${control.tagName}`).toBe(true)
      }
      expect(root.querySelector('select.input')).toBeNull()
      expect(root.querySelector('button[class="btn"]')).toBeNull()

      for (const choice of root.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
        expect(choice.closest('label')).not.toBeNull()
      }
      for (const group of root.querySelectorAll('[role="radiogroup"]')) {
        expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
      }
      for (const table of root.querySelectorAll('table.result-table')) {
        expect(table.parentElement.classList.contains('table-scroll')).toBe(true)
      }
      expect(root.querySelector('.tool-section .tool-section, .result-box .tool-section')).toBeNull()
    })
  }
})

// ---------------------------------------------------------------------------
// JSON 转代码
// ---------------------------------------------------------------------------

describe('json-to-code schema inference', () => {
  it('normalises naming helpers', () => {
    expect(pascalCase('user_name')).toBe('UserName')
    expect(pascalCase('userName')).toBe('UserName')
    expect(pascalCase('weird-key!')).toBe('WeirdKey')
    expect(pascalCase('1st')).toBe('T1st')
    expect(camelCase('user_name')).toBe('userName')
    expect(camelCase('ID')).toBe('id')
    expect(snakeCase('userName')).toBe('user_name')
    expect(singularize('users')).toBe('user')
    expect(singularize('categories')).toBe('category')
    expect(singularize('addresses')).toBe('address')
    expect(singularize('status')).toBe('status')
  })

  it('merges the shapes of every array element', () => {
    const schema = inferSchema([{ a: 1, b: 'x' }, { a: 2, c: true }])
    expect(schema.kind).toBe('array')
    expect(schema.element.kind).toBe('object')
    const fields = Object.fromEntries(schema.element.fields.map(field => [field.key, field]))
    expect(Object.keys(fields)).toEqual(['a', 'b', 'c'])
    expect(fields.a.optional).toBe(false)
    expect(fields.b.optional).toBe(true)
    expect(fields.c.optional).toBe(true)
    expect(fields.a.schema.kind).toBe('number')
  })

  it('marks observed nulls as nullable and unrelated types as a union', () => {
    const schema = inferSchema({ nickname: null, mixed: [1, 'two'] })
    const fields = Object.fromEntries(schema.fields.map(field => [field.key, field.schema]))
    expect(fields.nickname.nullable).toBe(true)
    expect(fields.mixed.kind).toBe('array')
    expect(fields.mixed.element.kind).toBe('union')
    expect(fields.mixed.element.options.map(option => option.kind).sort()).toEqual(['number', 'string'])
  })

  it('keeps integers only while every observed value is an integer', () => {
    expect(inferSchema({ a: 1, b: [1, 2] }).fields[1].schema.element.integer).toBe(true)
    expect(inferSchema([1, 2.5]).element.integer).toBe(false)
  })

  it('narrows down a nullable of the same kind instead of a union', () => {
    const merged = mergeSchemas(inferSchema(1), inferSchema(null))
    expect(merged.kind).toBe('number')
    expect(merged.nullable).toBe(true)
  })

  it('reports an empty array without an element schema', () => {
    const schema = inferSchema({ list: [] })
    expect(schema.fields[0].schema.kind).toBe('array')
    expect(schema.fields[0].schema.element).toBeNull()
  })
})

describe('json-to-code emitters', () => {
  const value = {
    id: 1,
    name: 'Ada',
    nickname: null,
    tags: ['a', 'b'],
    profile: { city: 'London', geo: { lat: 1.5 } },
    orders: [{ orderId: 'A', total: 1.5 }, { orderId: 'B', total: 2 }],
    emptyList: [],
    'weird-key': true
  }

  it('generates Go structs with json tags and pointer nullables', () => {
    const code = toGo(value, { rootName: 'Account' })
    expect(code).toContain('type Account struct {')
    expect(code).toContain('\tId int64 `json:"id"`')
    expect(code).toContain('\tTags []string `json:"tags"`')
    expect(code).toContain('\tNickname interface{} `json:"nickname,omitempty"`')
    expect(code).toContain('\tOrders []Order `json:"orders"`')
    expect(code).toContain('type Order struct {')
    expect(code).toContain('type Geo struct {')
    expect(code).toContain('\tEmptyList []interface{} `json:"emptyList"`')
    expect(code).toContain('WeirdKey bool `json:"weird-key"`')
  })

  it('generates Python dataclasses with typing helpers', () => {
    const code = toPython(value, { rootName: 'Account' })
    expect(code).toContain('from dataclasses import dataclass')
    expect(code).toContain('from typing import Any, List, Optional')
    expect(code).toContain('@dataclass\nclass Account:')
    expect(code).toContain('    tags: List[str]')
    expect(code).toContain('    nickname: Optional[Any] = None')
    expect(code).toContain('    orders: List[Order]')
    expect(code).toContain('    weird_key: bool')
  })

  it('generates Java records with boxed types and rename annotations', () => {
    const code = toJava(value, { rootName: 'Account' })
    expect(code).toContain('public record Account(')
    expect(code).toContain('Long id')
    expect(code).toContain('List<String> tags')
    expect(code).toContain('@JsonProperty("weird-key") Boolean weirdKey')
    expect(code).toContain('import java.util.List;')
  })

  it('generates C# classes with JsonPropertyName attributes', () => {
    const code = toCSharp(value, { rootName: 'Account' })
    expect(code).toContain('[JsonPropertyName("weird-key")]')
    expect(code).toContain('public bool WeirdKey { get; set; }')
    expect(code).toContain('public List<Order> Orders { get; set; }')
    expect(code).toContain('using System.Text.Json.Serialization;')
  })

  it('generates PHP 8 typed properties', () => {
    const code = toPhp(value, { rootName: 'Account' })
    expect(code.startsWith('<?php')).toBe(true)
    expect(code).toContain('class Account')
    expect(code).toContain('public int $id;')
    expect(code).toContain('public mixed $nickname = null;')
    expect(code).toContain('/** @var Order[] */')
    expect(code).toContain('public array $orders;')
  })

  it('generates Rust structs with serde attributes', () => {
    const code = toRust(value, { rootName: 'Account' })
    expect(code).toContain('use serde::{Deserialize, Serialize};')
    expect(code).toContain('#[serde(rename_all = "camelCase")]')
    expect(code).toContain('pub struct Account {')
    expect(code).toContain('pub orders: Vec<Order>,')
    expect(code).toContain('#[serde(default, skip_serializing_if = "Option::is_none")]')
    expect(code).toContain('pub nickname: Option<Value>,')
  })

  it('renames Rust fields whose key is not the camelCase spelling', () => {
    const code = toRust({ user_name: 'a', userName: 'b' })
    expect(code).toContain('#[serde(rename = "user_name")]')
    expect(code).toContain('pub user_name: String,')
    // "userName" is the camelCase spelling of the field, so no rename is needed
    // — the second field collides on the Rust name and is de-duplicated.
    expect(code).toContain('pub user_name2: String,')
  })

  it('sanitises reserved words per language', () => {
    expect(toRust({ type: 1, fn: 2 })).toContain('pub type_: i64,')
    expect(toPython({ class: 1, from: 2 })).toContain('class_: int')
    expect(toJava({ class: 1 })).toContain('Long class_')
  })

  it('de-duplicates colliding field names and type names', () => {
    const code = toGo({ user: { name: 'a' }, user_name: { name: 'b' }, User: { id: 1 } })
    // The first two keys describe the same shape, so they share one type; the
    // third shape wants the same name and is renumbered.
    expect(code.match(/type User struct/g)).toHaveLength(1)
    expect(code).toContain('type User2 struct {')
    expect(code).toContain('\tUserName User `json:"user_name"`')
  })

  it('uses pointers, Optional and Option for observed nulls', () => {
    const rows = [{ bio: 'x' }, { bio: null }]
    expect(toGo(rows, { rootName: 'Row' })).toContain('Bio *string `json:"bio,omitempty"`')
    expect(toPython(rows, { rootName: 'Row' })).toContain('bio: Optional[str] = None')
    expect(toCSharp(rows, { rootName: 'Row' })).toContain('public string Bio { get; set; }')
    expect(toPhp(rows, { rootName: 'Row' })).toContain('public ?string $bio = null;')
    expect(toRust(rows, { rootName: 'Row' })).toContain('pub bio: Option<String>,')
  })

  it('names nested array element types after their key', () => {
    expect(toGo({ items: [{ sku: 'x' }] })).toContain('type Item struct {')
    expect(toGo({ categories: [{ id: 1 }] })).toContain('type Category struct {')
    expect(toGo({ matrix: [[{ x: 1 }]] })).toContain('[][]Matrix')
  })

  it('handles roots that are not objects', () => {
    expect(toGo([{ a: 1 }], { rootName: 'Row' })).toContain('type Row []RowItem')
    expect(toPython([1, 2], { rootName: 'Nums' })).toContain('Nums = List[int]')
    expect(toRust([1, 2], { rootName: 'Nums' })).toContain('pub type Nums = Vec<i64>;')
    expect(toGo(42, { rootName: 'Answer' })).toContain('type Answer int64')
  })

  it('marks missing keys optional only when asked', () => {
    const data = [{ a: 1 }, { a: 2, b: 'x' }]
    expect(toGo(data, { rootName: 'Row' })).toContain('B *string `json:"b,omitempty"`')
    expect(toGo(data, { rootName: 'Row', optionalFields: false })).toContain('B string `json:"b"`')
  })

  it('dispatches to every language and rejects unknown ones', () => {
    for (const language of ['go', 'python', 'java', 'csharp', 'php', 'rust']) {
      expect(generateCode({ a: 1 }, language)).toContain('a')
    }
    expect(generateCode('{"a":1}', 'go')).toBe(generateCode({ a: 1 }, 'go'))
    expect(() => generateCode({ a: 1 }, 'kotlin')).toThrow(/不支持的目标语言/)
    expect(() => generateCode('{oops', 'go')).toThrow()
  })
})

describe('json-to-code UI', () => {
  it('generates code from the sample and follows the language toggle', () => {
    jsonToCode.render(root)
    const sampleButton = [...root.querySelectorAll('.btn-secondary')].find(button => button.textContent === '示例数据')
    sampleButton.click()
    expect(outputTextarea().value).toContain('type Root struct {')
    expect(outputTextarea().value).toContain('json:"orders"')

    clickSegment('rust')
    expect(outputTextarea().value).toContain('pub struct Root {')
    expect(outputTextarea().value).toContain('#[serde(rename_all = "camelCase")]')

    clickSegment('php')
    expect(outputTextarea().value).toContain('<?php')
  })

  it('reports broken JSON instead of rendering half a result', () => {
    jsonToCode.render(root)
    editableTextareas()[0].value = '{ not json'
    findField('.btn-primary').click()
    expect(outputTextarea().value).toBe('')
    expect(findField('.error-text').textContent).toContain('JSON 解析失败')
  })

  it('honours the root type name input', () => {
    jsonToCode.render(root)
    editableTextareas()[0].value = '{"a":1}'
    findField('input.input').value = 'Envelope'
    findField('.btn-primary').click()
    expect(outputTextarea().value).toContain('type Envelope struct {')
  })
})

// ---------------------------------------------------------------------------
// JSON 扁平化
// ---------------------------------------------------------------------------

describe('json-flatten', () => {
  const nested = {
    order: 'A-1',
    customer: { id: 7, address: { city: '北京' } },
    items: [{ sku: 'X1', tags: ['hot'] }, { sku: 'X2' }],
    empty: [],
    emptyObject: {},
    remark: null
  }

  it('expands arrays into numeric path segments', () => {
    const flat = flattenJson(nested)
    expect(flat['customer.address.city']).toBe('北京')
    expect(flat['items.0.sku']).toBe('X1')
    expect(flat['items.0.tags.0']).toBe('hot')
    expect(flat['items.1.sku']).toBe('X2')
    expect(flat.empty).toEqual([])
    expect(flat.remark).toBeNull()
  })

  it('keeps arrays whole when asked to', () => {
    const flat = flattenJson(nested, { arrays: 'keep' })
    expect(flat['items']).toEqual([{ sku: 'X1', tags: ['hot'] }, { sku: 'X2' }])
    expect(flat['customer.id']).toBe(7)
  })

  it('supports a custom delimiter', () => {
    const flat = flattenJson({ a: { b: 1 } }, { delimiter: '/' })
    expect(flat['a/b']).toBe(1)
    expect(unflattenJson({ 'a/b': 1 }, { delimiter: '/' })).toEqual({ a: { b: 1 } })
  })

  it('round-trips nested documents through both array modes', () => {
    expect(unflattenJson(flattenJson(nested))).toEqual(nested)
    expect(unflattenJson(flattenJson(nested, { arrays: 'keep' }))).toEqual(nested)
  })

  it('round-trips array and scalar roots', () => {
    expect(unflattenJson(flattenJson([{ a: 1 }, { a: 2 }]))).toEqual([{ a: 1 }, { a: 2 }])
    expect(unflattenJson(flattenJson('leaf'))).toBe('leaf')
    expect(unflattenJson(flattenJson([]))).toEqual([])
  })

  it('ignores prototype-polluting paths', () => {
    const result = unflattenJson({ '__proto__.polluted': 'yes', 'constructor.prototype.bad': 'yes', 'safe': 1 })
    expect(result).toEqual({ safe: 1 })
    expect({}.polluted).toBeUndefined()
    expect(Object.prototype.bad).toBeUndefined()
  })

  it('keeps a literal __proto__ key as data', () => {
    const value = JSON.parse('{"__proto__": {"x": 1}, "safe": 2}')
    const flat = flattenJson(value)
    expect(Object.keys(flat)).toEqual(['__proto__.x', 'safe'])
    expect(flat['__proto__.x']).toBe(1)
    // Rebuilding drops the dangerous path on purpose, keeping the rest.
    expect(unflattenJson(flat)).toEqual({ safe: 2 })

    const sorted = sortJsonKeys(JSON.parse('{"b": 1, "__proto__": 2}'))
    expect(Object.getOwnPropertyDescriptor(sorted, '__proto__').value).toBe(2)
    expect(sorted.b).toBe(1)
    expect(Object.getPrototypeOf(sorted)).toBe(Object.prototype)
  })

  it('flattens and rebuilds through the UI', () => {
    jsonFlatten.render(root)
    const sampleButton = [...root.querySelectorAll('.btn-secondary')].find(button => button.textContent === '示例数据')
    sampleButton.click()
    const flat = JSON.parse(outputTextarea().value)
    expect(flat['customer.address.city']).toBe('北京')
    expect(flat['items.1.tags']).toEqual([])

    clickSegment('unflatten')
    editableTextareas()[0].value = JSON.stringify(flat)
    findField('.btn-primary').click()
    const rebuilt = JSON.parse(outputTextarea().value)
    expect(rebuilt.customer.address).toEqual({ city: '北京', zip: '100080' })
    expect(rebuilt.items).toEqual([
      { sku: 'X1', price: 12.5, tags: ['hot', 'sale'] },
      { sku: 'X2', price: 7, tags: [] }
    ])
    expect(rebuilt.remark).toBeNull()
  })

  it('surfaces JSON errors in the UI', () => {
    jsonFlatten.render(root)
    editableTextareas()[0].value = 'nope'
    findField('.btn-primary').click()
    expect(outputTextarea().value).toBe('')
    expect(findField('.error-text').textContent).not.toBe('')
  })

  it('rebuilds the flattened sample through the unflatten direction', () => {
    jsonFlatten.render(root)
    const sampleButton = [...root.querySelectorAll('.btn-secondary')].find(button => button.textContent === '示例数据')
    clickSegment('unflatten')
    sampleButton.click()
    const rebuilt = JSON.parse(outputTextarea().value)
    expect(rebuilt.customer.address.city).toBe('北京')
    expect(rebuilt.items[0].tags).toEqual(['hot', 'sale'])
    expect(rebuilt.items[1].tags).toEqual([])
    expect(rebuilt.remark).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// JSON 键排序
// ---------------------------------------------------------------------------

describe('json-sort', () => {
  const value = { b: 1, a: { d: 2, c: { f: 3, e: 4 } }, list: [3, 1, 2] }

  it('sorts keys recursively in ascending order', () => {
    expect(Object.keys(sortJsonKeys(value))).toEqual(['a', 'b', 'list'])
    const sorted = sortJsonKeys(value)
    expect(Object.keys(sorted.a)).toEqual(['c', 'd'])
    expect(Object.keys(sorted.a.c)).toEqual(['e', 'f'])
    expect(sorted.list).toEqual([3, 1, 2])
  })

  it('keeps the nested order when not recursive', () => {
    const sorted = sortJsonKeys(value, { recursive: false })
    expect(Object.keys(sorted)).toEqual(['a', 'b', 'list'])
    expect(Object.keys(sorted.a)).toEqual(['d', 'c'])
  })

  it('sorts arrays only when asked', () => {
    expect(sortJsonKeys(value, { sortArrays: true }).list).toEqual([1, 2, 3])
    expect(sortJsonKeys({ list: ['b', 'a'] }, { sortArrays: true }).list).toEqual(['a', 'b'])
    expect(sortJsonKeys({ list: [10, 9] }, { sortArrays: true }).list).toEqual([9, 10])
  })

  it('supports descending order and case-insensitive comparisons', () => {
    expect(Object.keys(sortJsonKeys({ a: 1, b: 2, c: 3 }, { order: 'desc' }))).toEqual(['c', 'b', 'a'])
    const sensitive = Object.keys(sortJsonKeys({ Mango: 1, apple: 2 }))
    const insensitive = Object.keys(sortJsonKeys({ Mango: 1, apple: 2 }, { caseSensitive: false }))
    expect(sensitive).toEqual(['Mango', 'apple'])
    expect(insensitive).toEqual(['apple', 'Mango'])
  })

  it('leaves non-object roots untouched', () => {
    expect(sortJsonKeys([1, 2])).toEqual([1, 2])
    expect(sortJsonKeys('text')).toBe('text')
    expect(sortJsonKeys(null)).toBeNull()
  })

  it('sorts the sample through the UI into pretty-printed JSON', () => {
    jsonSort.render(root)
    const sampleButton = [...root.querySelectorAll('.btn-secondary')].find(button => button.textContent === '示例数据')
    sampleButton.click()
    const text = outputTextarea().value
    expect(text.startsWith('{\n  "Mango"')).toBe(true)
    expect(Object.keys(JSON.parse(text))).toEqual(['Mango', 'apple', 'banana', 'list', 'zebra'])
  })
})

// ---------------------------------------------------------------------------
// MongoDB ObjectId
// ---------------------------------------------------------------------------

describe('objectid', () => {
  const KNOWN = '507f1f77bcf86cd799439011'

  it('parses the structure of an ObjectId', () => {
    const parsed = parseObjectId(KNOWN)
    expect(parsed.valid).toBe(true)
    expect(parsed.timestampSeconds).toBe(1350508407)
    expect(parsed.iso).toBe('2012-10-17T21:13:27.000Z')
    // 4-byte time + 5-byte random + 3-byte counter
    expect(parsed.random).toBe('bcf86cd799')
    expect(parsed.counter).toBe(parseInt('439011', 16))
    expect(parsed.timestamp).toBeInstanceOf(Date)
  })

  it('accepts uppercase hex and rejects everything else', () => {
    expect(parseObjectId(KNOWN.toUpperCase()).hex).toBe(KNOWN)
    expect(parseObjectId('').valid).toBe(false)
    expect(parseObjectId('507f1f77bcf86cd79943901').valid).toBe(false)
    expect(parseObjectId('507f1f77bcf86cd79943901z').valid).toBe(false)
    expect(parseObjectId(null).valid).toBe(false)
  })

  it('converts both ways between timestamps and ObjectIds', () => {
    const hex = timestampToObjectId(1700000000)
    expect(hex).toHaveLength(24)
    expect(hex.slice(0, 8)).toBe('6553f100')
    expect(objectIdToTimestamp(hex).getTime()).toBe(1700000000 * 1000)
    expect(objectIdToTimestamp(KNOWN).toISOString()).toBe('2012-10-17T21:13:27.000Z')
    expect(() => objectIdToTimestamp('nope')).toThrow()
  })

  it('validates the timestamp range and input type', () => {
    expect(() => timestampToObjectId(-1)).toThrow(/范围/)
    expect(() => timestampToObjectId(0x100000000)).toThrow(/范围/)
    expect(() => timestampToObjectId('abc')).toThrow()
    const fromDate = timestampToObjectId(new Date(1700000000000))
    const fromSeconds = timestampToObjectId(1700000000)
    expect(fromDate.slice(0, 8)).toBe(fromSeconds.slice(0, 8))
    expect(parseObjectId(fromDate).iso).toBe('2023-11-14T22:13:20.000Z')
  })

  it('generates unique, parseable ObjectIds', () => {
    const first = generateObjectId(new Date(1700000000000))
    const second = generateObjectId(new Date(1700000000000))
    expect(first).not.toBe(second)
    expect(parseObjectId(first).timestampSeconds).toBe(1700000000)
    expect(parseObjectId(second).valid).toBe(true)
  })

  it('parses a batch, keeping line numbers', () => {
    const rows = parseObjectIds(`${KNOWN}\n\nnot-an-id\n5f2f1c2b9a3d4e5f6a7b8c9d`)
    expect(rows).toHaveLength(3)
    expect(rows[0].line).toBe(1)
    expect(rows[1].result.valid).toBe(false)
    expect(rows[1].line).toBe(3)
    expect(rows[2].result.timestampSeconds).toBe(1596922923)
  })

  it('converts through the UI in both directions', () => {
    objectIdTool.render(root)
    findField('input.input').value = '1700000000'
    findField('.btn-primary').click()
    const cells = [...root.querySelectorAll('tbody th, tbody td')].map(cell => cell.textContent)
    expect(cells[0]).toHaveLength(24)
    expect(cells[1]).toBe('1700000000')
    expect(root.querySelectorAll('.stat-item')).toHaveLength(5)

    clickSegment('id2ts')
    editableTextareas()[0].value = `${KNOWN}\nbad-id`
    findField('.btn-primary').click()
    const rows = [...root.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('th').textContent).toBe(KNOWN)
    expect(rows[0].children[2].textContent).toBe('2012-10-17T21:13:27.000Z')
    expect(rows[1].children[1].textContent).toBe('—')
    expect(findField('.error-text').textContent).toContain('第 2 行')
  })

  it('generates a batch of ObjectIds', () => {
    objectIdTool.render(root)
    clickSegment('generate')
    const countInput = fieldByLabel('生成数量')
    countInput.value = '3'
    findField('.btn-primary').click()
    const rows = [...root.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(3)
    for (const row of rows) expect(parseObjectId(row.querySelector('th').textContent).valid).toBe(true)

    countInput.value = '0'
    findField('.btn-primary').click()
    expect(findField('.error-text').textContent).toContain('1 到 50')
  })
})

// ---------------------------------------------------------------------------
// 数字转英文
// ---------------------------------------------------------------------------

describe('number-to-words', () => {
  it('spells cardinals with correct hyphenation and scale words', () => {
    expect(numberToWords(0)).toBe('zero')
    expect(numberToWords(21)).toBe('twenty-one')
    expect(numberToWords(100)).toBe('one hundred')
    expect(numberToWords(1234)).toBe('one thousand two hundred thirty-four')
    expect(numberToWords(1000000)).toBe('one million')
    expect(numberToWords('1000000000000000000')).toBe('one quintillion')
  })

  it('adds the British "and" only when the option is on', () => {
    expect(numberToWords(105)).toBe('one hundred five')
    expect(numberToWords(105, { britishAnd: true })).toBe('one hundred and five')
    expect(numberToWords(1234, { britishAnd: true })).toBe('one thousand two hundred and thirty-four')
    expect(numberToWords(1005, { britishAnd: true })).toBe('one thousand and five')
    expect(numberToWords(1100, { britishAnd: true })).toBe('one thousand one hundred')
  })

  it('reads decimals digit by digit and handles negatives and exponents', () => {
    expect(numberToWords('1234.56')).toBe('one thousand two hundred thirty-four point five six')
    expect(numberToWords(21.05)).toBe('twenty-one point zero five')
    expect(numberToWords(-42)).toBe('minus forty-two')
    expect(numberToWords('1e3')).toBe('one thousand')
    expect(numberToWords('1.5e-7')).toBe('zero point zero zero zero zero zero zero one five')
    expect(numberToWords('1,234.5')).toBe('one thousand two hundred thirty-four point five')
    expect(() => numberToWords('abc')).toThrow()
    expect(() => numberToWords('')).toThrow()
  })

  it('builds ordinals with the irregular forms', () => {
    expect(numberToOrdinal(1)).toBe('first')
    expect(numberToOrdinal(2)).toBe('second')
    expect(numberToOrdinal(3)).toBe('third')
    expect(numberToOrdinal(4)).toBe('fourth')
    expect(numberToOrdinal(12)).toBe('twelfth')
    expect(numberToOrdinal(20)).toBe('twentieth')
    expect(numberToOrdinal(21)).toBe('twenty-first')
    expect(numberToOrdinal(100)).toBe('one hundredth')
    expect(numberToOrdinal(1000)).toBe('one thousandth')
    expect(numberToOrdinal(0)).toBe('zeroth')
    expect(() => numberToOrdinal('12.5')).toThrow(/整数/)
  })

  it('writes currency amounts with singular and plural units', () => {
    expect(numberToCurrency(123.45)).toBe('one hundred twenty-three dollars and forty-five cents')
    expect(numberToCurrency(1)).toBe('one dollar')
    expect(numberToCurrency(1.01)).toBe('one dollar and one cent')
    expect(numberToCurrency(0.5)).toBe('fifty cents')
    expect(numberToCurrency(1.005)).toBe('one dollar and one cent')
    expect(numberToCurrency(-5.25)).toBe('minus five dollars and twenty-five cents')
    expect(numberToCurrency(100, { currency: 'JPY' })).toBe('one hundred yen')
    expect(numberToCurrency(1, { currency: 'GBP' })).toBe('one pound')
    expect(numberToCurrency(2.02, { currency: 'GBP' })).toBe('two pounds and two pence')
    expect(numberToCurrency(123.45, { britishAnd: true })).toBe('one hundred and twenty-three dollars and forty-five cents')
  })

  it('writes Chinese readings in both cases', () => {
    expect(numberToChinese(12)).toBe('十二')
    expect(numberToChinese(20)).toBe('二十')
    expect(numberToChinese(101)).toBe('一百零一')
    expect(numberToChinese(10005)).toBe('一万零五')
    expect(numberToChinese(100000001)).toBe('一亿零一')
    expect(numberToChinese(123456789)).toBe('一亿二千三百四十五万六千七百八十九')
    expect(numberToChinese(-3.14)).toBe('负三点一四')
    expect(numberToChinese(1234, { uppercase: true })).toBe('壹仟贰佰叁拾肆')
  })

  it('converts through the UI and follows the mode toggle', () => {
    numberToWordsTool.render(root)
    findField('input[type="number"]').value = '1234'
    findField('.btn-primary').click()
    expect(outputTextarea().value).toBe('one thousand two hundred thirty-four')

    clickSegment('ordinal')
    expect(outputTextarea().value).toBe('one thousand two hundred thirty-fourth')

    clickSegment('currency')
    expect(outputTextarea().value).toBe('one thousand two hundred thirty-four dollars')

    checkboxByLabel('英式读法').checked = true
    findField('.btn-primary').click()
    expect(outputTextarea().value).toBe('one thousand two hundred and thirty-four dollars')

    clickSegment('chinese')
    expect(outputTextarea().value).toBe('一千二百三十四')

    checkboxByLabel('中文大写').checked = true
    findField('.btn-primary').click()
    expect(outputTextarea().value).toBe('壹仟贰佰叁拾肆')
  })

  it('supports a batch of numbers through the UI', () => {
    numberToWordsTool.render(root)
    checkboxByLabel('批量').checked = true
    checkboxByLabel('批量').dispatchEvent(new Event('change', { bubbles: true }))
    editableTextareas()[0].value = '21\n1005'
    findField('.btn-primary').click()
    expect(outputTextarea().value.split('\n')).toEqual(['twenty-one', 'one thousand five'])

    editableTextareas()[0].value = '21\nnope'
    findField('.btn-primary').click()
    expect(outputTextarea().value.split('\n')[1]).toContain('第 2 行错误')
  })

  it('reports invalid numbers from the sample-sized input', () => {
    numberToWordsTool.render(root)
    findField('input[type="number"]').value = ''
    findField('.btn-primary').click()
    expect(outputTextarea().value).toBe('')
  })
})
