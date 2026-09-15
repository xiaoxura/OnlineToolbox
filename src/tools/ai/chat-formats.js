// Shared conversion layer between the three chat message shapes.
//
// Every format parses into one neutral representation and every format is
// generated from it, so adding a fourth format costs two functions instead of
// six pairwise converters.
//
//   IR = {
//     system: string,
//     messages: [{ role: 'user' | 'assistant', parts: Part[] }]
//   }
//   Part = { type: 'text', text }
//        | { type: 'tool_call', id, name, args }
//        | { type: 'tool_result', id, name?, content }

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

const textPart = text => ({ type: 'text', text: String(text ?? '') })

function parseArgs(value) {
  if (value === undefined || value === null || value === '') return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function stringifyArgs(value) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? {})
}

// Flatten a content field that may be a string, a block array, or null.
function contentToText(content) {
  if (content === null || content === undefined) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (typeof block === 'string') return block
        if (isObject(block) && typeof block.text === 'string') return block.text
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

// Append parts, merging into the previous message when the role repeats —
// all three APIs treat consecutive same-role turns as one turn anyway.
function pushMessage(ir, role, parts) {
  const clean = parts.filter(Boolean)
  if (!clean.length) return
  const last = ir.messages[ir.messages.length - 1]
  if (last && last.role === role) {
    last.parts.push(...clean)
    return
  }
  ir.messages.push({ role, parts: clean })
}

// --- Parsers ---------------------------------------------------------------

export function fromOpenAI(input) {
  const list = Array.isArray(input) ? input : input?.messages
  if (!Array.isArray(list)) throw new Error('OpenAI 格式需要一个消息数组，或带 messages 字段的对象')
  const ir = { system: '', messages: [] }

  list.forEach((message, index) => {
    if (!isObject(message)) throw new Error(`第 ${index + 1} 条消息不是对象`)
    const label = `第 ${index + 1} 条消息`
    switch (message.role) {
      case 'system':
      case 'developer': {
        const text = contentToText(message.content)
        ir.system = ir.system ? `${ir.system}\n\n${text}` : text
        break
      }
      case 'user':
        pushMessage(ir, 'user', [textPart(contentToText(message.content))])
        break
      case 'assistant': {
        const parts = []
        const text = contentToText(message.content)
        if (text) parts.push(textPart(text))
        const calls = Array.isArray(message.tool_calls) ? message.tool_calls : []
        calls.forEach((call, callIndex) => {
          const fn = call?.function || {}
          parts.push({
            type: 'tool_call',
            id: call?.id || `call_${index + 1}_${callIndex + 1}`,
            name: fn.name || 'unknown',
            args: parseArgs(fn.arguments)
          })
        })
        pushMessage(ir, 'assistant', parts)
        break
      }
      case 'tool':
      case 'function':
        pushMessage(ir, 'user', [{
          type: 'tool_result',
          id: message.tool_call_id || message.name || `call_${index + 1}`,
          name: message.name,
          content: contentToText(message.content)
        }])
        break
      default:
        throw new Error(`${label}的 role 不支持：${message.role}`)
    }
  })
  return ir
}

export function fromAnthropic(input) {
  if (!isObject(input)) throw new Error('Anthropic 格式需要一个对象，包含 system 和 messages')
  const ir = { system: contentToText(input.system), messages: [] }
  const list = input.messages
  if (!Array.isArray(list)) throw new Error('Anthropic 格式缺少 messages 数组')

  list.forEach((message, index) => {
    if (!isObject(message)) throw new Error(`第 ${index + 1} 条消息不是对象`)
    const role = message.role === 'assistant' ? 'assistant' : 'user'
    const blocks = Array.isArray(message.content) ? message.content : [message.content]
    const parts = []
    blocks.forEach(block => {
      if (typeof block === 'string') { parts.push(textPart(block)); return }
      if (!isObject(block)) return
      if (block.type === 'text') parts.push(textPart(block.text))
      else if (block.type === 'tool_use') {
        parts.push({ type: 'tool_call', id: block.id, name: block.name, args: block.input })
      } else if (block.type === 'tool_result') {
        parts.push({
          type: 'tool_result',
          id: block.tool_use_id,
          content: contentToText(block.content)
        })
      }
      // thinking / redacted_thinking blocks carry no portable meaning here.
    })
    pushMessage(ir, role, parts)
  })
  return ir
}

export function fromGemini(input) {
  if (!isObject(input)) throw new Error('Gemini 格式需要一个对象，包含 contents')
  const ir = { system: contentToText(input.systemInstruction?.parts), messages: [] }
  const list = input.contents
  if (!Array.isArray(list)) throw new Error('Gemini 格式缺少 contents 数组')

  list.forEach((content, index) => {
    if (!isObject(content)) throw new Error(`第 ${index + 1} 条 content 不是对象`)
    const role = content.role === 'model' ? 'assistant' : 'user'
    const parts = []
    for (const part of content.parts || []) {
      if (!isObject(part)) continue
      if (typeof part.text === 'string') parts.push(textPart(part.text))
      else if (part.functionCall) {
        parts.push({
          type: 'tool_call',
          // Gemini has no call id — key on the name so a matching
          // functionResponse can be paired back up.
          id: `call_${part.functionCall.name}`,
          name: part.functionCall.name,
          args: part.functionCall.args ?? {}
        })
      } else if (part.functionResponse) {
        parts.push({
          type: 'tool_result',
          id: `call_${part.functionResponse.name}`,
          name: part.functionResponse.name,
          content: JSON.stringify(part.functionResponse.response ?? {}, null, 2)
        })
      }
    }
    pushMessage(ir, role, parts)
  })
  return ir
}

// --- Generators ------------------------------------------------------------

export function toOpenAI(ir) {
  const out = []
  if (ir.system) out.push({ role: 'system', content: ir.system })
  for (const message of ir.messages) {
    const texts = message.parts.filter(part => part.type === 'text')
    const calls = message.parts.filter(part => part.type === 'tool_call')
    const results = message.parts.filter(part => part.type === 'tool_result')

    if (message.role === 'assistant') {
      const entry = { role: 'assistant', content: texts.map(part => part.text).join('\n') || null }
      if (calls.length) {
        entry.tool_calls = calls.map(call => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: stringifyArgs(call.args) }
        }))
      }
      out.push(entry)
      continue
    }

    if (texts.length) out.push({ role: 'user', content: texts.map(part => part.text).join('\n') })
    for (const result of results) {
      out.push({ role: 'tool', tool_call_id: result.id, content: result.content })
    }
  }
  return out
}

export function toAnthropic(ir) {
  const messages = ir.messages.map(message => ({
    role: message.role,
    content: message.parts.map(part => {
      if (part.type === 'text') return { type: 'text', text: part.text }
      if (part.type === 'tool_call') return { type: 'tool_use', id: part.id, name: part.name, input: part.args }
      return { type: 'tool_result', tool_use_id: part.id, content: part.content }
    })
  }))
  return ir.system ? { system: ir.system, messages } : { messages }
}

export function toGemini(ir) {
  // functionResponse is matched by name, so recover the name from the call.
  const nameById = new Map()
  for (const message of ir.messages) {
    for (const part of message.parts) {
      if (part.type === 'tool_call') nameById.set(part.id, part.name)
    }
  }
  const contents = ir.messages.map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: message.parts.map(part => {
      if (part.type === 'text') return { text: part.text }
      if (part.type === 'tool_call') return { functionCall: { name: part.name, args: part.args ?? {} } }
      const name = part.name || nameById.get(part.id) || 'unknown'
      let response
      try {
        response = { result: JSON.parse(part.content) }
      } catch {
        response = { result: part.content }
      }
      return { functionResponse: { name, response } }
    })
  }))
  return ir.system
    ? { systemInstruction: { parts: [{ text: ir.system }] }, contents }
    : { contents }
}

// --- Format registry -------------------------------------------------------

export const chatFormats = [
  { id: 'openai', label: 'OpenAI', parse: fromOpenAI, generate: toOpenAI },
  { id: 'anthropic', label: 'Anthropic', parse: fromAnthropic, generate: toAnthropic },
  { id: 'gemini', label: 'Gemini', parse: fromGemini, generate: toGemini }
]

export const formatById = id => chatFormats.find(format => format.id === id)

export function convertChat(text, fromId, toId) {
  const source = formatById(fromId)
  const target = formatById(toId)
  if (!source || !target) throw new Error('未知的消息格式')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new Error(`不是合法的 JSON：${cause.message}`)
  }
  return target.generate(source.parse(parsed))
}
