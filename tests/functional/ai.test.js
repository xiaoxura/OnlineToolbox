import { describe, expect, it } from 'vitest'
import { mountTool, outputValue, setValue, clickText, flush } from '../helpers/tool-harness.js'

import { renderTemplate, resolvePath } from '../../src/tools/ai/prompt-template.js'
import { parseChatMessages } from '../../src/tools/ai/token-counter.js'
import {
  parseVector, cosineSimilarity, dotProduct, euclideanDistance, manhattanDistance, magnitude
} from '../../src/tools/ai/vector-similarity.js'
import { chunkByChars, chunkByTokens } from '../../src/tools/ai/text-chunker.js'
import {
  fromOpenAI, fromAnthropic, fromGemini, toOpenAI, toAnthropic, toGemini, convertChat
} from '../../src/tools/ai/chat-formats.js'
import { extractJson, repairJson, parseLenient } from '../../src/tools/ai/json-repair.js'
import { inferSchema, buildToolSchema } from '../../src/tools/ai/tool-schema.js'

// A character-level stand-in for the BPE tokenizer, so the chunker's slicing
// logic can be tested without loading a 2 MB vocabulary.
const charTokenizer = {
  encode: text => [...text],
  decode: ids => ids.join('')
}

async function waitFor(predicate, { timeout = 20000, interval = 25 } = {}) {
  const start = Date.now()
  for (;;) {
    const value = predicate()
    if (value) return value
    if (Date.now() - start > timeout) throw new Error('timed out waiting for condition')
    await flush(interval)
  }
}

describe('prompt template', () => {
  it('substitutes dotted paths and array indices', () => {
    const { output } = renderTemplate('{{user.name}} 的第 {{items.0}} 项', {
      user: { name: 'Alice' },
      items: ['甲', '乙']
    })
    expect(output).toBe('Alice 的第 甲 项')
  })

  it('leaves unresolved placeholders verbatim and reports them', () => {
    const { output, missing, used } = renderTemplate('{{a}} 和 {{b}}', { a: '1' })
    expect(output).toBe('1 和 {{b}}')
    expect(missing).toEqual(['b'])
    expect(used).toEqual(['a'])
  })

  it('honours the backslash escape', () => {
    const { output, missing } = renderTemplate('\\{{a}} {{a}}', { a: 'X' })
    expect(output).toBe('{{a}} X')
    expect(missing).toEqual([])
  })

  it('renders non-string values', () => {
    expect(renderTemplate('{{n}} {{o}} {{z}}', { n: 3, o: { a: 1 }, z: null }).output)
      .toBe('3 {\n  "a": 1\n} null')
  })

  it('resolvePath tolerates missing branches instead of throwing', () => {
    expect(resolvePath({ a: 1 }, 'a.b.c')).toBeUndefined()
    expect(resolvePath(null, 'a')).toBeUndefined()
  })
})

describe('token counter chat parsing', () => {
  it('accepts an array and a {messages} wrapper', () => {
    const list = [{ role: 'user', content: 'hi' }]
    expect(parseChatMessages(JSON.stringify(list))).toEqual(list)
    expect(parseChatMessages(JSON.stringify({ messages: list }))).toEqual(list)
  })

  it('defaults a missing content to an empty string', () => {
    expect(parseChatMessages('[{"role":"assistant"}]')[0].content).toBe('')
  })

  it('rejects malformed input with a located message', () => {
    expect(() => parseChatMessages('nope')).toThrow(/不是合法的 JSON/)
    expect(() => parseChatMessages('[]')).toThrow(/为空/)
    expect(() => parseChatMessages('[{"content":"x"}]')).toThrow(/缺少 role/)
    expect(() => parseChatMessages('[{"role":"robot","content":"x"}]')).toThrow(/role 无效/)
    expect(() => parseChatMessages('[{"role":"user","content":42}]')).toThrow(/需要是字符串/)
  })
})

describe('vector similarity', () => {
  it('parses both JSON arrays and bare separated lists', () => {
    expect(parseVector('[1, 2, 3]')).toEqual([1, 2, 3])
    expect(parseVector('1, 2\n3')).toEqual([1, 2, 3])
    expect(parseVector('1 2 3')).toEqual([1, 2, 3])
  })

  it('rejects empty and non-numeric input', () => {
    expect(() => parseVector('  ')).toThrow(/为空/)
    // A bracketed payload goes through JSON, so the failure is a parse error…
    expect(() => parseVector('[1, x]')).toThrow(/JSON 解析失败/)
    // …while a bare list is checked component by component.
    expect(() => parseVector('1, x')).toThrow(/第 2 个分量不是有效数字/)
    expect(() => parseVector('{bad')).toThrow(/第 1 个分量不是有效数字/)
    // Separators with nothing between them leave no components at all.
    expect(() => parseVector(',,,')).toThrow(/未能解析出向量分量/)
  })

  it('computes the standard metrics', () => {
    expect(magnitude([3, 4])).toBe(5)
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32)
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5)
    expect(manhattanDistance([0, 0], [3, 4])).toBe(7)
  })

  it('refuses mismatched dimensions and zero vectors', () => {
    expect(() => cosineSimilarity([1, 2], [1])).toThrow(/维度不一致/)
    expect(() => cosineSimilarity([0, 0], [1, 1])).toThrow(/零向量/)
  })
})

describe('text chunker', () => {
  it('splits into overlapping windows that cover the text', () => {
    const chunks = chunkByChars('abcdefghij', 4, 2, false)
    expect(chunks).toEqual(['abcd', 'cdef', 'efgh', 'ghij'])
    // Overlap means the concatenation repeats characters, but the first chunk
    // must start at the text's start and the last must reach its end.
    expect(chunks[0][0]).toBe('a')
    expect(chunks.at(-1).at(-1)).toBe('j')
  })

  it('makes progress even with maximal overlap', () => {
    const chunks = chunkByChars('abcdef', 3, 2, false)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[chunks.length - 1]).toContain('f')
  })

  it('prefers a boundary when one is available', () => {
    const text = '一二三四。五六七八九十'
    const [first] = chunkByChars(text, 8, 0, true)
    expect(first).toBe('一二三四。')
  })

  it('rejects options that cannot advance', () => {
    expect(() => chunkByChars('abc', 0, 0, false)).toThrow(/大于 0/)
    expect(() => chunkByChars('abc', 2, 2, false)).toThrow(/小于分块大小/)
    expect(() => chunkByChars('abc', 2, -1, false)).toThrow(/不小于 0/)
  })

  it('chunks by token through a tokenizer', () => {
    const chunks = chunkByTokens(charTokenizer, 'abcdefgh', 3, 1, false)
    expect(chunks).toEqual(['abc', 'cde', 'efg', 'gh'])
  })
})

describe('chat format conversion', () => {
  const openai = [
    { role: 'system', content: 'be nice' },
    { role: 'user', content: 'weather?' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"北京"}' } }]
    },
    { role: 'tool', tool_call_id: 'call_1', content: '{"temp":26}' }
  ]

  it('merges system turns and lifts tool results into user messages', () => {
    const ir = fromOpenAI(openai)
    expect(ir.system).toBe('be nice')
    expect(ir.messages.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(ir.messages[1].parts[0]).toMatchObject({ type: 'tool_call', name: 'get_weather' })
    expect(ir.messages[1].parts[0].args).toEqual({ city: '北京' })
    expect(ir.messages[2].parts[0]).toMatchObject({ type: 'tool_result', id: 'call_1' })
  })

  it('round-trips OpenAI -> Anthropic -> OpenAI', () => {
    const anthropic = toAnthropic(fromOpenAI(openai))
    expect(anthropic.system).toBe('be nice')
    expect(anthropic.messages[1].content[0]).toMatchObject({ type: 'tool_use', id: 'call_1', name: 'get_weather' })
    expect(anthropic.messages[2].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'call_1' })

    const back = toOpenAI(fromAnthropic(anthropic))
    expect(back[0]).toEqual({ role: 'system', content: 'be nice' })
    expect(back[2].tool_calls[0].id).toBe('call_1')
    expect(back[2].tool_calls[0].function.arguments).toBe('{"city":"北京"}')
    expect(back[3]).toMatchObject({ role: 'tool', tool_call_id: 'call_1', content: '{"temp":26}' })
  })

  it('pairs Gemini functionResponse back to its call by name', () => {
    const gemini = toGemini(fromOpenAI(openai))
    const contents = gemini.contents
    expect(gemini.systemInstruction.parts[0].text).toBe('be nice')
    expect(contents[1].role).toBe('model')
    expect(contents[1].parts[0].functionCall).toEqual({ name: 'get_weather', args: { city: '北京' } })
    expect(contents[2].parts[0].functionResponse.name).toBe('get_weather')
    expect(contents[2].parts[0].functionResponse.response).toEqual({ result: { temp: 26 } })
  })

  it('parses a Gemini payload back into the neutral shape', () => {
    const ir = fromGemini({
      systemInstruction: { parts: [{ text: 'sys' }] },
      contents: [
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'model', parts: [{ functionCall: { name: 'f', args: { a: 1 } } }] }
      ]
    })
    expect(ir.system).toBe('sys')
    expect(ir.messages[0].parts[0].text).toBe('hi')
    expect(ir.messages[1].parts[0]).toMatchObject({ type: 'tool_call', name: 'f' })
  })

  it('convertChat reports JSON errors and unknown roles', () => {
    expect(() => convertChat('{oops', 'openai', 'anthropic')).toThrow(/不是合法的 JSON/)
    expect(() => convertChat('[{"role":"wizard","content":"x"}]', 'openai', 'anthropic')).toThrow(/role 不支持/)
  })
})

describe('LLM json repair', () => {
  it('prefers a fenced block over the surrounding prose', () => {
    const { json, source } = extractJson('说明\n```json\n{"a":1}\n```\n结束')
    expect(json).toBe('{"a":1}')
    expect(source).toMatch(/代码块/)
  })

  it('finds a bare structure in prose', () => {
    expect(extractJson('结果是 {"a": 1} 这样').json).toBe('{"a": 1}')
  })

  it('stops at the matching bracket, not the last one in the text', () => {
    expect(extractJson('{"a": 1} 后面还有 [1,2] 和别的').json).toBe('{"a": 1}')
  })

  it('repairs the usual model mangling', () => {
    const { json, fixes } = repairJson("{'a': 1, \"b\": [1,2,], 'c': True, 'd': None,}")
    expect(JSON.parse(json)).toEqual({ a: 1, b: [1, 2], c: true, d: null })
    expect(fixes.join()).toMatch(/单引号/)
    expect(fixes.join()).toMatch(/尾随逗号/)
    expect(fixes.join()).toMatch(/字面量/)
  })

  it('drops a trailing comma that sits before a comment', () => {
    const { json } = repairJson('{"a": 1, // 说明\n}')
    expect(JSON.parse(json)).toEqual({ a: 1 })
  })

  it('removes comments and full-width punctuation', () => {
    const { json } = repairJson('{/* x */ "a"：1}')
    expect(JSON.parse(json)).toEqual({ a: 1 })
  })

  it('does not rewrite punctuation inside a string literal', () => {
    const { json } = repairJson('{"a": "keep, this, and：that"}')
    expect(JSON.parse(json)).toEqual({ a: 'keep, this, and：that' })
  })

  it('preserves escapes inside a double-quoted literal', () => {
    const input = '{"a": "he said \\"hi\\"", "b": "back\\\\slash"}'
    expect(JSON.parse(parseLenient(input).json)).toEqual({ a: 'he said "hi"', b: 'back\\slash' })
  })

  it('unwraps a single-quoted literal with an escaped apostrophe', () => {
    const { json, fixes } = parseLenient("{'a': 'it\\'s'}")
    expect(JSON.parse(json)).toEqual({ a: "it's" })
    expect(fixes).toContain("反转义 \\'")
  })

  it('reports no fixes for already-valid JSON', () => {
    expect(parseLenient('{"a":1}').fixes).toEqual([])
  })

  it('raises a clear error when repair is not enough', () => {
    expect(() => parseLenient('{"a": ')).toThrow(/无法解析/)
  })
})

describe('tool schema generation', () => {
  it('infers nested types and marks sample keys required', () => {
    const schema = inferSchema({ a: 1, b: 1.5, c: 'x', d: true, e: null, f: [1, 2], g: { h: 'y' } })
    expect(schema.type).toBe('object')
    expect(schema.properties.a).toEqual({ type: 'integer' })
    expect(schema.properties.b).toEqual({ type: 'number' })
    expect(schema.properties.c).toEqual({ type: 'string' })
    expect(schema.properties.d).toEqual({ type: 'boolean' })
    expect(schema.properties.e).toEqual({ type: 'null' })
    expect(schema.properties.f).toEqual({ type: 'array', items: { type: 'integer' } })
    expect(schema.properties.g.properties.h).toEqual({ type: 'string' })
    expect(schema.required).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(schema.additionalProperties).toBe(false)
  })

  it('marks a key required only when every array element has it', () => {
    const schema = inferSchema([{ a: 1, b: 2 }, { a: 3 }])
    expect(schema.items.required).toEqual(['a'])
    expect(schema.items.properties.b).toEqual({ type: 'integer' })
  })

  it('leaves mixed element types open rather than guessing', () => {
    expect(inferSchema([1, 'a']).items).toEqual({})
  })

  it('emits the OpenAI and Anthropic tool shapes', () => {
    const sample = { city: '北京' }
    expect(buildToolSchema(sample, { name: 'f', description: 'd', target: 'openai' })).toEqual({
      type: 'function',
      function: {
        name: 'f',
        description: 'd',
        strict: true,
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
          additionalProperties: false
        }
      }
    })
    expect(buildToolSchema(sample, { name: 'f', target: 'anthropic' }).input_schema.type).toBe('object')
  })

  it('rejects a non-object sample', () => {
    expect(() => buildToolSchema([1, 2])).toThrow(/需要一个 JSON 对象/)
    expect(() => buildToolSchema(null)).toThrow(/需要一个 JSON 对象/)
  })
})

describe('AI tools - functional', () => {
  it('prompt-template: fills the sample and reports the used variables', async () => {
    const container = await mountTool('prompt-template')
    expect(outputValue(container)).toContain('资深后端工程师')
    expect(container.querySelector('.form-hint').textContent).toContain('已填充 4 个变量')
  })

  it('prompt-template: flags an unfilled variable', async () => {
    const container = await mountTool('prompt-template')
    const [template] = container.querySelectorAll('textarea:not([readonly])')
    setValue(template, '你好 {{nobody}}')
    expect(outputValue(container)).toBe('你好 {{nobody}}')
    expect(container.querySelector('.form-hint-warn')).not.toBeNull()
  })

  it('vector-similarity: scores the sample pair as near-identical', async () => {
    const container = await mountTool('vector-similarity')
    const rows = [...container.querySelectorAll('table.result-table tbody tr')]
    const cosine = Number(rows[0].children[1].textContent)
    expect(cosine).toBeGreaterThan(0.99)
    expect(container.querySelectorAll('.stat-item').length).toBe(6)
  })

  it('vector-similarity: surfaces a dimension mismatch', async () => {
    const container = await mountTool('vector-similarity')
    const [a] = container.querySelectorAll('textarea:not([readonly])')
    setValue(a, '[1,2,3]')
    expect(container.querySelector('.error-text').textContent).toMatch(/维度不一致/)
  })

  it('text-chunker: splits by characters with overlap', async () => {
    const container = await mountTool('text-chunker')
    const [input] = container.querySelectorAll('textarea:not([readonly])')
    setValue(input, 'abcdefghij')
    const [size, overlap] = container.querySelectorAll('input[type="number"]')
    setValue(size, '4')
    setValue(overlap, '2')
    const chunks = JSON.parse(outputValue(container))
    expect(chunks).toEqual(['abcd', 'cdef', 'efgh', 'ghij'])
    expect(container.querySelectorAll('.stat-item')[0].querySelector('.stat-value').textContent).toBe('4')
  })

  it('text-chunker: rejects an overlap that would stall', async () => {
    const container = await mountTool('text-chunker')
    const [input] = container.querySelectorAll('textarea:not([readonly])')
    setValue(input, 'abcdef')
    const [size, overlap] = container.querySelectorAll('input[type="number"]')
    setValue(overlap, '500')
    expect(size.value).toBe('500')
    expect(container.querySelector('.error-text').textContent).toMatch(/小于分块大小/)
  })

  it('llm-cost: prices the default model and follows a model change', async () => {
    const container = await mountTool('llm-cost')
    const prices = container.querySelectorAll('input[type="number"]')
    expect(container.querySelector('.stat-value').textContent).toBe('$0.0350')

    const select = container.querySelector('select')
    setValue(select, 'claude-haiku-4-5')
    expect(prices[5].value).toBe('1')
    expect(prices[6].value).toBe('5')
    expect(container.querySelector('.stat-value').textContent).toBe('$0.003500')
  })

  it('llm-cost: warns when the prompt exceeds the context window', async () => {
    const container = await mountTool('llm-cost')
    const [inputTokens] = container.querySelectorAll('input[type="number"]')
    setValue(inputTokens, '5000000')
    expect(container.querySelector('.form-hint').textContent).toMatch(/超过该模型的上下文窗口/)
  })

  it('llm-models: filters the table by vendor', async () => {
    const container = await mountTool('llm-models')
    const all = container.querySelectorAll('table.result-table tbody tr').length
    expect(all).toBeGreaterThan(20)

    clickText(container, 'OpenAI')
    const rows = container.querySelectorAll('table.result-table tbody tr')
    expect(rows.length).toBe(4)
    // Filtered to a single vendor, the redundant 厂商 column is dropped.
    expect([...rows].every(row => row.children[0].textContent.startsWith('GPT'))).toBe(true)
    expect([...container.querySelectorAll('table.result-table thead th')].map(th => th.textContent)).not.toContain('厂商')
  })

  it('message-convert: converts the OpenAI sample to Anthropic', async () => {
    const container = await mountTool('message-convert')
    clickText(container, '示例数据')
    const result = JSON.parse(outputValue(container))
    expect(result.system).toBe('你是一个天气助手。')
    expect(result.messages[1].content[0].type).toBe('tool_use')
  })

  it('message-convert: switches target to Gemini and swaps direction', async () => {
    const container = await mountTool('message-convert')
    clickText(container, '示例数据')

    const [, targetGroup] = container.querySelectorAll('.segmented-group')
    ;[...targetGroup.querySelectorAll('button')].find(b => b.textContent === 'Gemini').click()
    expect(JSON.parse(outputValue(container)).contents[1].parts[0].functionCall.name).toBe('get_weather')

    clickText(container, '交换方向')
    const groups = container.querySelectorAll('.segmented-group')
    expect([...groups[0].querySelectorAll('button')].find(b => b.getAttribute('aria-checked') === 'true').textContent).toBe('Gemini')
  })

  it('llm-json-repair: repairs the sample into valid JSON', async () => {
    const container = await mountTool('llm-json-repair')
    clickText(container, '示例数据')
    expect(JSON.parse(outputValue(container))).toEqual({
      name: '示例', count: 3, tags: ['a', 'b'], enabled: true, note: null
    })
    expect(container.querySelector('.form-hint').textContent).toMatch(/已修复/)
  })

  it('tool-schema: generates a strict schema from the sample', async () => {
    const container = await mountTool('tool-schema')
    const schema = JSON.parse(outputValue(container))
    expect(schema.type).toBe('function')
    expect(schema.function.name).toBe('get_weather')
    expect(schema.function.strict).toBe(true)
    expect(schema.function.parameters.properties.city).toEqual({ type: 'string' })
  })

  it('chat-builder: exports the seeded conversation', async () => {
    const container = await mountTool('chat-builder')
    const messages = JSON.parse(container.querySelector('.result-box').textContent)
    expect(messages[0]).toEqual({ role: 'system', content: '你是一个严谨的技术助手，回答尽量简洁。' })
    expect(messages[1].role).toBe('user')
  })

  it('chat-builder: exports to Anthropic when that format is picked', async () => {
    const container = await mountTool('chat-builder')
    const [formatGroup] = container.querySelectorAll('.segmented-group')
    ;[...formatGroup.querySelectorAll('button')].find(b => b.textContent === 'Anthropic').click()
    const result = JSON.parse(container.querySelector('.result-box').textContent)
    expect(result.system).toContain('技术助手')
    expect(result.messages[0].content[0].type).toBe('text')
  })

  it('token-counter: counts tokens for plain text', async () => {
    const container = await mountTool('token-counter')
    const [input] = container.querySelectorAll('textarea:not([readonly])')
    setValue(input, 'Hello world')
    clickText(container, '计算 Token')
    const value = await waitFor(() => {
      const text = container.querySelector('.stat-value')?.textContent
      return text === '2' ? text : null
    })
    expect(value).toBe('2')
  })

  it('token-counter: counts chat tokens with per-message overhead', async () => {
    const container = await mountTool('token-counter')
    const [, modeGroup] = container.querySelectorAll('.segmented-group')
    ;[...modeGroup.querySelectorAll('button')].find(b => b.textContent === '对话消息').click()

    const [input] = container.querySelectorAll('textarea:not([readonly])')
    setValue(input, JSON.stringify([{ role: 'user', content: 'Hello world' }]))
    clickText(container, '计算 Token')

    const stats = await waitFor(() => {
      const cards = [...container.querySelectorAll('.stat-item')]
      return cards.length >= 4 ? cards.map(card => card.querySelector('.stat-value').textContent) : null
    })
    // A chat turn costs more than its raw text: the roles and delimiters are
    // themselves tokens, which is exactly what a naive count misses.
    expect(Number(stats[0])).toBeGreaterThan(2)
    expect(Number(stats[2])).toBe(2)
    expect(stats[1]).toBe('1')
  })
})
