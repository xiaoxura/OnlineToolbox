import { createElement, createCopyButton, createSegmentedGroup } from '../../utils/dom.js'

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------

// Split "userName" / "user_name" / "user-name" into ["user", "Name"] so every
// naming style can be rebuilt from the same word list.
function splitWords(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''
}

export function pascalCase(name, fallback = 'Type') {
  const parts = splitWords(name).map(capitalize)
  const joined = parts.join('')
  if (!joined) return fallback
  return /^[0-9]/.test(joined) ? `T${joined}` : joined
}

export function camelCase(name, fallback = 'value') {
  const parts = splitWords(name)
  if (!parts.length) return fallback
  const joined = parts.map((part, index) => (index === 0 ? part.toLowerCase() : capitalize(part))).join('')
  return /^[0-9]/.test(joined) ? `${fallback}${pascalCase(joined)}` : joined
}

export function snakeCase(name, fallback = 'value') {
  const parts = splitWords(name)
  if (!parts.length) return fallback
  const joined = parts.join('_').toLowerCase()
  return /^[0-9]/.test(joined) ? `${fallback}_${joined}` : joined
}

// Keys that are not valid identifiers keep their readable spelling and only
// swap the illegal characters for underscores (Python / PHP style).
function sanitizeIdentifier(name, reserved = new Set(), fallback = 'field') {
  let text = String(name ?? '').replace(/[^A-Za-z0-9_]/g, '_')
  if (!text) text = fallback
  if (/^[0-9]/.test(text)) text = `_${text}`
  while (reserved.has(text)) text = `${text}_`
  return text
}

// Words that change the meaning of a leading "-s": never singularise them.
const SINGULAR_EXCEPTIONS = new Set(['status', 'address', 'news', 'data', 'series', 'species', 'info', 'metadata', 'media'])

export function singularize(name) {
  const text = String(name ?? '')
  if (!text || SINGULAR_EXCEPTIONS.has(text.toLowerCase())) return text
  if (/ies$/i.test(text)) return text.replace(/ies$/i, 'y')
  if (/(ss|sh|ch|x|z)es$/i.test(text)) return text.replace(/es$/i, '')
  if (/[^s]s$/i.test(text) && !/ss$/i.test(text)) return text.slice(0, -1)
  return text
}

const PYTHON_RESERVED = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield', 'match', 'case', 'self'])
const JAVA_RESERVED = new Set(['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'var', 'void', 'volatile', 'while', 'record', 'yield'])
const RUST_RESERVED = new Set(['as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while', 'abstract', 'become', 'box', 'do', 'final', 'macro', 'override', 'priv', 'try', 'typeof', 'unsized', 'virtual', 'yield'])

// ---------------------------------------------------------------------------
// Schema inference
// ---------------------------------------------------------------------------

// Schema nodes:
//   { kind: 'object',  nullable, fields: [{ key, optional, schema }] }
//   { kind: 'array',   nullable, element: schema | null }
//   { kind: 'union',   nullable, options: [schema, ...] }
//   { kind: 'string' | 'number' | 'boolean' | 'null' | 'unknown', nullable }
// `optional` on a field means the key was missing from at least one object of
// the merged array; `nullable` means a JSON null was observed for that slot.

function schemaOf(value) {
  if (value === null) return { kind: 'null', nullable: true }
  if (Array.isArray(value)) {
    if (!value.length) return { kind: 'array', nullable: false, element: null }
    let element = schemaOf(value[0])
    for (let index = 1; index < value.length; index++) element = mergeSchemas(element, schemaOf(value[index]))
    return { kind: 'array', nullable: false, element }
  }
  if (typeof value === 'object') {
    return {
      kind: 'object',
      nullable: false,
      fields: Object.entries(value).map(([key, item]) => ({ key, optional: false, schema: schemaOf(item) }))
    }
  }
  if (typeof value === 'number') return { kind: 'number', nullable: false, integer: Number.isInteger(value) }
  if (typeof value === 'boolean') return { kind: 'boolean', nullable: false }
  if (typeof value === 'string') return { kind: 'string', nullable: false }
  return { kind: 'unknown', nullable: false }
}

export function inferSchema(value) {
  return schemaOf(value)
}

function mergeSameKind(left, right) {
  if (left.kind === 'object') {
    const keys = [...new Set([...left.fields.map(field => field.key), ...right.fields.map(field => field.key)])]
    const fields = keys.map(key => {
      const leftField = left.fields.find(field => field.key === key)
      const rightField = right.fields.find(field => field.key === key)
      if (leftField && rightField) {
        return {
          key,
          optional: leftField.optional || rightField.optional,
          schema: mergeSchemas(leftField.schema, rightField.schema)
        }
      }
      const only = leftField || rightField
      return { key, optional: true, schema: only.schema }
    })
    return { kind: 'object', nullable: false, fields }
  }
  if (left.kind === 'array') {
    const element = left.element && right.element
      ? mergeSchemas(left.element, right.element)
      : left.element || right.element
    return { kind: 'array', nullable: false, element }
  }
  if (left.kind === 'number') {
    return { kind: 'number', nullable: false, integer: Boolean(left.integer && right.integer) }
  }
  return { ...left }
}

function finishUnion(options, nullable) {
  const merged = []
  for (const option of options) {
    const index = merged.findIndex(existing => existing.kind === option.kind)
    if (index < 0) merged.push(option)
    else {
      merged[index] = {
        ...mergeSameKind(merged[index], option),
        nullable: Boolean(merged[index].nullable || option.nullable)
      }
    }
  }
  if (merged.length === 1) return { ...merged[0], nullable: Boolean(nullable || merged[0].nullable) }
  return { kind: 'union', nullable: Boolean(nullable), options: merged }
}

// Merge two inferred shapes. Every array element and every repeated key goes
// through here, so the result covers all observed values rather than just the
// first one.
export function mergeSchemas(left, right) {
  if (!left) return right
  if (!right) return left
  const nullable = Boolean(left.nullable || right.nullable)
  const leftBase = left.kind === 'null' ? null : left
  const rightBase = right.kind === 'null' ? null : right
  if (!leftBase && !rightBase) return { kind: 'null', nullable: true }
  if (!leftBase) return { ...rightBase, nullable: true }
  if (!rightBase) return { ...leftBase, nullable: true }
  if (leftBase.kind === 'union' || rightBase.kind === 'union') {
    const options = []
    const push = node => {
      if (node.kind === 'union') node.options.forEach(push)
      else options.push(node)
    }
    push(leftBase)
    push(rightBase)
    return finishUnion(options, nullable)
  }
  if (leftBase.kind === rightBase.kind) return { ...mergeSameKind(leftBase, rightBase), nullable }
  return finishUnion([leftBase, rightBase], nullable)
}

function schemaSignature(schema) {
  if (!schema) return 'null'
  const suffix = schema.nullable ? '?' : ''
  switch (schema.kind) {
    case 'object':
      return `{${schema.fields
        .map(field => `${field.key}${field.optional ? '?' : ''}:${schemaSignature(field.schema)}`)
        .sort()
        .join(',')}}${suffix}`
    case 'array':
      return `[${schemaSignature(schema.element)}]${suffix}`
    case 'union':
      return `(${schema.options.map(schemaSignature).sort().join('|')})${suffix}`
    case 'number':
      return `number${schema.integer ? ':int' : ''}${suffix}`
    default:
      return `${schema.kind}${suffix}`
  }
}

// ---------------------------------------------------------------------------
// Named-type registry — one entry per distinct object shape
// ---------------------------------------------------------------------------

function createRegistry() {
  const types = []
  const bySignature = new Map()
  const objectNames = new Map()
  const usedNames = new Set()

  function reserve(base) {
    let name = base || 'Type'
    if (usedNames.has(name)) {
      let index = 2
      while (usedNames.has(`${base}${index}`)) index++
      name = `${base}${index}`
    }
    usedNames.add(name)
    return name
  }

  function register(schema, preferred) {
    const signature = schemaSignature(schema)
    const existing = bySignature.get(signature)
    if (existing) {
      // Same shape seen under another key — reuse the name, but remember this
      // node so emitters can resolve it by identity too.
      objectNames.set(schema, existing)
      return existing
    }
    const name = reserve(pascalCase(preferred))
    bySignature.set(signature, name)
    objectNames.set(schema, name)
    const entry = { name, schema, fields: [] }
    for (const field of schema.fields) {
      entry.fields.push({
        key: field.key,
        optional: field.optional,
        schema: field.schema,
        ref: registerNested(field.schema, field.key)
      })
    }
    types.push(entry)
    return name
  }

  // Walk past array nesting so `matrix: [[{…}]]` still yields one named type.
  function registerNested(schema, key) {
    if (!schema) return null
    if (schema.kind === 'object') return register(schema, key)
    if (schema.kind === 'array') {
      if (!schema.element) return null
      return registerNested(schema.element, singularize(key))
    }
    return null
  }

  return { types, register, registerNested, objectNames }
}

function createContext(value, options) {
  const registry = createRegistry()
  const rootSchema = schemaOf(value)
  const requestedName = pascalCase(options.rootName || 'Root')
  let rootName = requestedName
  if (rootSchema.kind === 'object') rootName = registry.register(rootSchema, requestedName)
  else if (rootSchema.kind === 'array' && rootSchema.element) registry.registerNested(rootSchema.element, `${requestedName}Item`)
  return {
    types: registry.types,
    rootName,
    rootSchema,
    options,
    nameOf: node => (node && node.kind === 'object' ? registry.objectNames.get(node) || null : null)
  }
}

// Nullable slots come from an explicit JSON null; a key missing from one of the
// array elements only counts when the user asks for it.
function isOptionalField(field, options) {
  if (field.schema && field.schema.nullable) return true
  return Boolean(field.optional) && options.optionalFields !== false
}

function fieldNames(fields, toName) {
  const used = new Set()
  return fields.map(field => {
    const base = toName(field.key) || 'field'
    let name = base
    let index = 2
    while (used.has(name)) name = `${base}${index++}`
    used.add(name)
    return name
  })
}

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

function goBaseType(node, context) {
  switch (node.kind) {
    case 'object':
      return context.nameOf(node) || 'map[string]interface{}'
    case 'array':
      return node.element ? `[]${goBaseType(node.element, context)}` : '[]interface{}'
    case 'string':
      return 'string'
    case 'number':
      return node.integer ? 'int64' : 'float64'
    case 'boolean':
      return 'bool'
    default:
      return 'interface{}'
  }
}

function goFieldType(field, context) {
  const base = goBaseType(field.schema, context)
  const pointerable = field.schema.kind !== 'array' && field.schema.kind !== 'union' && base !== 'interface{}'
  return pointerable && isOptionalField(field, context.options) ? `*${base}` : base
}

export function toGo(value, options = {}) {
  const context = createContext(value, options)
  const blocks = context.types.map(entry => {
    const names = fieldNames(entry.fields, key => pascalCase(key, 'Field'))
    const lines = entry.fields.map((field, index) => {
      const optional = isOptionalField(field, context.options)
      const tag = optional ? `${field.key},omitempty` : field.key
      return `\t${names[index]} ${goFieldType(field, context)} \`json:"${tag}"\``
    })
    return `type ${entry.name} struct {\n${lines.join('\n')}\n}`
  })
  if (context.rootSchema.kind !== 'object') blocks.push(`type ${context.rootName} ${goBaseType(context.rootSchema, context)}`)
  return blocks.join('\n\n') + '\n'
}

// ---------------------------------------------------------------------------
// Python (dataclasses)
// ---------------------------------------------------------------------------

function pythonType(node, context) {
  switch (node.kind) {
    case 'object':
      return context.nameOf(node) || 'Any'
    case 'array':
      return `List[${node.element ? pythonType(node.element, context) : 'Any'}]`
    case 'string':
      return 'str'
    case 'number':
      return node.integer ? 'int' : 'float'
    case 'boolean':
      return 'bool'
    default:
      return 'Any'
  }
}

export function toPython(value, options = {}) {
  const context = createContext(value, options)
  const blocks = context.types.map(entry => {
    // Python has no per-field rename hook, so the JSON key is kept as-is once
    // it is a legal identifier.
    const names = fieldNames(entry.fields, key => sanitizeIdentifier(key, PYTHON_RESERVED))
    const lines = entry.fields.map((field, index) => {
      const base = pythonType(field.schema, context)
      if (!isOptionalField(field, context.options)) return `    ${names[index]}: ${base}`
      const wrapped = base.startsWith('Optional[') ? base : `Optional[${base}]`
      return `    ${names[index]}: ${wrapped} = None`
    })
    return `@dataclass\nclass ${entry.name}:\n${lines.length ? lines.join('\n') : '    pass'}`
  })
  if (context.rootSchema.kind !== 'object') blocks.push(`${context.rootName} = ${pythonType(context.rootSchema, context)}`)
  const header = 'from dataclasses import dataclass\nfrom typing import Any, List, Optional'
  return `${header}\n\n\n${blocks.join('\n\n\n')}\n`
}

// ---------------------------------------------------------------------------
// Java (records)
// ---------------------------------------------------------------------------

function javaType(node, context) {
  switch (node.kind) {
    case 'object':
      return context.nameOf(node) || 'Object'
    case 'array':
      return `List<${node.element ? javaType(node.element, context) : 'Object'}>`
    case 'string':
      return 'String'
    case 'number':
      return node.integer ? 'Long' : 'Double'
    case 'boolean':
      return 'Boolean'
    default:
      return 'Object'
  }
}

export function toJava(value, options = {}) {
  const context = createContext(value, options)
  const blocks = context.types.map(entry => {
    const names = fieldNames(entry.fields, key => camelCase(key, 'value'))
    const components = entry.fields.map((field, index) => {
      const name = names[index]
      const annotation = name === field.key ? '' : `@JsonProperty("${field.key}") `
      const type = javaType(field.schema, context)
      return `    ${annotation}${type} ${avoidJavaKeyword(name)}`
    })
    return `public record ${entry.name}(\n${components.join(',\n')}\n) {}`
  })
  if (context.rootSchema.kind !== 'object') blocks.push(`// ${context.rootName} => ${javaType(context.rootSchema, context)}`)
  const body = blocks.join('\n\n')
  const imports = ['import com.fasterxml.jackson.annotation.JsonProperty;']
  if (body.includes('List<')) imports.push('import java.util.List;')
  return `${imports.join('\n')}\n\n${body}\n`
}

function avoidJavaKeyword(name) {
  let text = name
  while (JAVA_RESERVED.has(text)) text = `${text}_`
  return text
}

// ---------------------------------------------------------------------------
// C#
// ---------------------------------------------------------------------------

function csharpType(node, context) {
  switch (node.kind) {
    case 'object':
      return context.nameOf(node) || 'object'
    case 'array':
      return `List<${node.element ? csharpType(node.element, context) : 'object'}>`
    case 'string':
      return 'string'
    case 'number':
      return node.integer ? 'long' : 'double'
    case 'boolean':
      return 'bool'
    default:
      return 'object'
  }
}

const CSHARP_VALUE_TYPES = new Set(['long', 'double', 'bool'])

export function toCSharp(value, options = {}) {
  const context = createContext(value, options)
  const blocks = context.types.map(entry => {
    const names = fieldNames(entry.fields, key => pascalCase(key, 'Value'))
    const members = entry.fields.map((field, index) => {
      const base = csharpType(field.schema, context)
      const type = isOptionalField(field, context.options) && CSHARP_VALUE_TYPES.has(base) ? `${base}?` : base
      return `    [JsonPropertyName("${field.key}")]\n    public ${type} ${names[index]} { get; set; }`
    })
    return `public class ${entry.name}\n{\n${members.join('\n\n')}\n}`
  })
  if (context.rootSchema.kind !== 'object') blocks.push(`// ${context.rootName} => ${csharpType(context.rootSchema, context)}`)
  return `using System.Collections.Generic;\nusing System.Text.Json.Serialization;\n\n${blocks.join('\n\n')}\n`
}

// ---------------------------------------------------------------------------
// PHP 8
// ---------------------------------------------------------------------------

function phpType(node, context) {
  switch (node.kind) {
    case 'object':
      return context.nameOf(node) || 'mixed'
    case 'array':
      return 'array'
    case 'string':
      return 'string'
    case 'number':
      return node.integer ? 'int' : 'float'
    case 'boolean':
      return 'bool'
    default:
      return 'mixed'
  }
}

function phpDocType(node, context) {
  if (node.kind !== 'array') return null
  if (!node.element) return 'array'
  const inner = phpDocType(node.element, context) || phpType(node.element, context)
  return inner === 'mixed' ? null : `${inner}[]`
}

export function toPhp(value, options = {}) {
  const context = createContext(value, options)
  const blocks = context.types.map(entry => {
    const names = fieldNames(entry.fields, key => sanitizeIdentifier(key, new Set(), 'field'))
    const properties = []
    for (let index = 0; index < entry.fields.length; index++) {
      const field = entry.fields[index]
      const name = names[index]
      const optional = isOptionalField(field, context.options)
      const base = phpType(field.schema, context)
      const doc = phpDocType(field.schema, context)
      if (doc) properties.push(`    /** @var ${doc} */`)
      const type = optional && base !== 'mixed' ? `?${base}` : base
      properties.push(`    public ${type} $${name}${optional ? ' = null' : ''};`)
    }
    return `class ${entry.name}\n{\n${properties.join('\n')}\n}`
  })
  if (context.rootSchema.kind !== 'object') blocks.push(`// ${context.rootName} => ${phpType(context.rootSchema, context)}`)
  return `<?php\n\n${blocks.join('\n\n')}\n`
}

// ---------------------------------------------------------------------------
// Rust (serde)
// ---------------------------------------------------------------------------

function rustType(node, context) {
  switch (node.kind) {
    case 'object':
      return context.nameOf(node) || 'Value'
    case 'array':
      return `Vec<${node.element ? rustType(node.element, context) : 'Value'}>`
    case 'string':
      return 'String'
    case 'number':
      return node.integer ? 'i64' : 'f64'
    case 'boolean':
      return 'bool'
    default:
      return 'Value'
  }
}

export function toRust(value, options = {}) {
  const context = createContext(value, options)
  let usesValue = false
  const blocks = context.types.map(entry => {
    const names = fieldNames(entry.fields, key => sanitizeIdentifier(snakeCase(key), RUST_RESERVED))
    const lines = entry.fields.map((field, index) => {
      const name = names[index]
      const optional = isOptionalField(field, context.options)
      let base = rustType(field.schema, context)
      if (base === 'Value' || base.includes('<Value>')) usesValue = true
      const type = optional && !base.startsWith('Option<') ? `Option<${base}>` : base
      const attributes = []
      if (camelCase(field.key) !== field.key) attributes.push(`rename = "${field.key}"`)
      if (optional) {
        attributes.push('default')
        attributes.push('skip_serializing_if = "Option::is_none"')
      }
      return `${attributes.length ? `    #[serde(${attributes.join(', ')})]\n` : ''}    pub ${name}: ${type},`
    })
    return `#[derive(Debug, Clone, Serialize, Deserialize)]\n#[serde(rename_all = "camelCase")]\npub struct ${entry.name} {\n${lines.join('\n')}\n}`
  })
  if (context.rootSchema.kind !== 'object') {
    const alias = rustType(context.rootSchema, context)
    if (alias === 'Value' || alias.includes('<Value>')) usesValue = true
    blocks.push(`pub type ${context.rootName} = ${alias};`)
  }
  const imports = ['use serde::{Deserialize, Serialize};']
  if (usesValue) imports.push('use serde_json::Value;')
  return `${imports.join('\n')}\n\n${blocks.join('\n\n')}\n`
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export const LANGUAGES = [
  { value: 'go', label: 'Go' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'rust', label: 'Rust' }
]

const EMITTERS = {
  go: toGo,
  python: toPython,
  java: toJava,
  csharp: toCSharp,
  php: toPhp,
  rust: toRust
}

export function generateCode(json, language = 'go', options = {}) {
  const emitter = EMITTERS[language]
  if (!emitter) throw new Error(`不支持的目标语言：${language}`)
  const value = typeof json === 'string' ? JSON.parse(json) : json
  if (value === undefined) throw new Error('没有可转换的 JSON 数据')
  return emitter(value, options)
}

const SAMPLE = {
  id: 1024,
  name: 'Ada Lovelace',
  email: null,
  score: 98.5,
  active: true,
  tags: ['math', 'pioneer'],
  profile: {
    avatar: 'https://example.com/avatar.png',
    location: { city: 'London', country: 'UK' }
  },
  orders: [
    { orderId: 'A-1', total: 12.5, items: [{ sku: 'X1', qty: 2 }] },
    { orderId: 'A-2', total: 7, coupon: 'SALE' }
  ],
  mixed: [1, 'two', null],
  emptyList: [],
  'weird-key': 'value'
}

export default {
  id: 'json-to-code',
  name: 'JSON 转代码',
  description: '将 JSON 转换为 Go、Python、Java、C#、PHP 或 Rust 结构体代码',
  category: 'converter',
  icon: 'json',
  keywords: ['json', 'struct', 'pojo', 'dataclass', 'record', '代码生成', 'go', 'rust'],
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      placeholder: '粘贴 JSON 数据，例如 {"id":1,"tags":["a"]}…'
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      readOnly: true,
      placeholder: '生成的结构体代码将显示在此…'
    })
    const rootNameInput = createElement('input', {
      className: 'input',
      value: 'Root',
      placeholder: '例如 Root'
    })
    const optionalCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    optionalCheckbox.checked = true
    const optionalOption = createElement('label', { className: 'option-item' }, [
      optionalCheckbox,
      createElement('span', { textContent: '缺失字段标记为可选' })
    ])
    const error = createElement('div', { className: 'error-text' })

    const language = createSegmentedGroup(LANGUAGES, () => run(), { label: '目标语言' })

    function run() {
      error.textContent = ''
      if (!input.value.trim()) {
        output.value = ''
        return
      }
      let parsed
      try {
        parsed = JSON.parse(input.value)
      } catch (cause) {
        output.value = ''
        error.textContent = `JSON 解析失败：${cause.message}`
        return
      }
      try {
        output.value = generateCode(parsed, language.getValue(), {
          rootName: rootNameInput.value,
          optionalFields: optionalCheckbox.checked
        })
      } catch (cause) {
        output.value = ''
        error.textContent = `生成失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '目标语言' }),
          language
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '根类型名' }),
          rootNameInput
        ]),
        createElement('div', { className: 'form-group option-control-group' }, [optionalOption])
      ]),
      createElement('div', { className: 'btn-group' }, [
        createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '生成代码', onClick: run }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            input.value = JSON.stringify(SAMPLE, null, 2)
            rootNameInput.value = 'Root'
            run()
          }
        }),
        createCopyButton(() => output.value)
      ]),
      error,
      createElement('div', { className: 'grid-2' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: 'JSON 输入' }),
          input
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '代码输出' }),
          output
        ])
      ])
    )
  }
}
