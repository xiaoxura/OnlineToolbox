import { createCopyButton, createElement, createSection, createTableScroll } from '../../utils/dom.js'

const FORMAT_IDS = ['auto', 'openai', 'anthropic', 'gemini', 'plain']
const FORMAT_LABELS = {
  auto: '自动识别',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  plain: '纯 data 文本'
}

const SAMPLES = {
  auto: 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: {"choices":[{"delta":{"content":"，世界"}}]}\n\ndata: [DONE]\n\n',
  openai: 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: {"choices":[{"delta":{"content":"，世界"}}]}\n\ndata: [DONE]\n\n',
  anthropic:
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"你好"}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"，世界"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
  gemini:
    'data: {"candidates":[{"content":{"parts":[{"text":"你好"}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":"，世界"}]}}]}\n\n',
  plain: 'data: 你好\n\ndata: ，世界\n\ndata: [DONE]\n\n'
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isDone(event) {
  return event.data.trim() === '[DONE]'
}

function openaiChunk(parsed) {
  const content = parsed?.choices?.[0]?.delta?.content
  return typeof content === 'string' ? content : ''
}

function anthropicChunk(parsed) {
  const content = parsed?.delta?.text
  return typeof content === 'string' ? content : ''
}

function geminiChunk(parsed) {
  const content = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
  return typeof content === 'string' ? content : ''
}

function detectFormat(events) {
  for (const event of events) {
    if (isDone(event)) break
    if (!event.data) continue
    const parsed = parseJson(event.data)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    if (Array.isArray(parsed.choices)) return 'openai'
    if (Array.isArray(parsed.candidates)) return 'gemini'
    if (parsed.type === 'content_block_delta' || (parsed.delta && typeof parsed.delta === 'object')) return 'anthropic'
  }
  return 'plain'
}

export function parseSseStream(text) {
  const source = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
  const events = []
  for (const block of source.split(/\n{2,}/)) {
    if (!block.trim()) continue
    const event = { id: null, event: null, data: '', retry: null, index: events.length }
    const dataLines = []
    let hasField = false
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      let value = colon === -1 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'data') {
        dataLines.push(value)
        hasField = true
      } else if (field === 'id') {
        event.id = value
        hasField = true
      } else if (field === 'event') {
        event.event = value
        hasField = true
      } else if (field === 'retry') {
        const retry = Number.parseInt(value, 10)
        event.retry = Number.isFinite(retry) ? retry : null
        hasField = true
      }
    }
    if (!hasField) continue
    event.data = dataLines.join('\n')
    events.push(event)
  }
  return events
}

export function reassembleMessage(events, { format = 'auto' } = {}) {
  const requested = FORMAT_IDS.includes(format) ? format : 'auto'
  const resolved = requested === 'auto' ? detectFormat(events) : requested
  const parts = []
  let chunks = 0

  for (const event of events) {
    if (isDone(event)) break
    if (!event.data) continue
    let chunk = ''
    if (resolved === 'plain') {
      chunk = event.data
    } else {
      const parsed = parseJson(event.data)
      if (!parsed || typeof parsed !== 'object') continue
      if (resolved === 'openai') chunk = openaiChunk(parsed)
      else if (resolved === 'anthropic') chunk = anthropicChunk(parsed)
      else if (resolved === 'gemini') chunk = geminiChunk(parsed)
    }
    if (!chunk) continue
    parts.push(chunk)
    chunks += 1
  }

  return { text: parts.join(''), format: resolved, chunks }
}

function statCard(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('div', { className: 'stat-value', textContent: value }),
    createElement('div', { className: 'stat-label', textContent: label })
  ])
}

function summarizeData(data) {
  if (!data) return '（空）'
  const oneLine = data.replace(/\s*\n\s*/g, '⏎')
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine
}

function countMalformed(events, format) {
  if (format === 'plain') return 0
  return events.filter(event => {
    if (!event.data || isDone(event)) return false
    return parseJson(event.data) === null
  }).length
}

export default {
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      rows: 12,
      placeholder: '粘贴原始 SSE 数据，例如 data: {...}…',
      'aria-label': '原始 SSE 数据'
    })
    const formatSelect = createElement(
      'select',
      {
        className: 'select',
        'aria-label': 'SSE 消息格式'
      },
      FORMAT_IDS.map(id => createElement('option', { value: id, textContent: FORMAT_LABELS[id] }))
    )

    const output = createElement('textarea', {
      className: 'textarea large',
      readOnly: true,
      rows: 8,
      placeholder: '拼接后的消息将显示在此…',
      'aria-label': '拼接后的消息'
    })
    const statsEl = createElement('div', { className: 'stats-row' })
    const tableHost = createElement('div')
    const warning = createElement('div', { className: 'form-hint-warn' })
    const hint = createElement('div', {
      className: 'form-hint',
      textContent: '按空行切分事件，data: 多行会以换行拼接；注释行（以 : 开头）会被忽略，遇到 [DONE] 停止。'
    })

    function reset() {
      statsEl.replaceChildren()
      tableHost.replaceChildren()
      output.value = ''
      warning.textContent = ''
    }

    function renderEvents(events) {
      if (!events.length) {
        tableHost.replaceChildren()
        return
      }
      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement(
            'tr',
            {},
            ['序号', 'event', 'id', 'data 摘要'].map(label => createElement('th', { textContent: label }))
          )
        ]),
        createElement(
          'tbody',
          {},
          events.map(event =>
            createElement('tr', {}, [
              createElement('td', { textContent: String(event.index + 1) }),
              createElement('td', { textContent: event.event ?? '—' }),
              createElement('td', { textContent: event.id ?? '—' }),
              createElement('td', { className: 'code-text', textContent: summarizeData(event.data) })
            ])
          )
        )
      )
      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, 'SSE 事件明细表，可横向滚动')
      tableHost.replaceChildren(host)
    }

    function run() {
      reset()
      if (!input.value.trim()) {
        hint.textContent = '请粘贴 SSE 原始数据后点击「解析」。支持 OpenAI、Anthropic、Gemini 与纯 data 文本。'
        return
      }
      const events = parseSseStream(input.value)
      const dataBlocks = events.filter(event => event.data !== '').length
      const result = reassembleMessage(events, { format: formatSelect.value })
      output.value = result.text
      renderEvents(events)
      statsEl.replaceChildren(
        statCard('事件数', String(events.length)),
        statCard('数据块数', String(dataBlocks)),
        statCard('字符数', String([...result.text].length)),
        statCard('识别格式', FORMAT_LABELS[result.format])
      )

      const malformed = countMalformed(events, result.format)
      if (!events.length) {
        warning.textContent = '未解析出事件：请确认每行使用 field: value 格式，并用空行分隔事件。'
      } else if (malformed > 0) {
        warning.textContent = `有 ${malformed} 个数据块不是合法 JSON，已跳过；请检查格式选择或粘贴内容。`
      } else if (!result.text) {
        warning.textContent = '没有可拼接的文本块；如果事件不是所选格式，请切换格式或改用自动识别。'
      } else {
        warning.textContent = ''
      }
      hint.textContent =
        result.format === 'plain'
          ? '当前按纯 data 文本拼接。若内容是厂商 JSON，请选择对应格式以提取增量文本。'
          : `当前按 ${FORMAT_LABELS[result.format]} 规则提取增量文本；[DONE] 之后的内容会被忽略。`
    }

    formatSelect.addEventListener('change', () => {
      if (input.value.trim()) run()
    })

    const parseButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '解析',
      onClick: run
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '填入示例',
      onClick: () => {
        input.value = SAMPLES[formatSelect.value] || SAMPLES.auto
        run()
      }
    })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        input.value = ''
        reset()
        hint.textContent = '请粘贴 SSE 原始数据后点击「解析」。支持 OpenAI、Anthropic、Gemini 与纯 data 文本。'
      }
    })

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 SSE 内容只在本地解析，不会上传到服务器。'
      }),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '消息格式' }),
        formatSelect
      ]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '原始 SSE' }), input]),
      createElement('div', { className: 'btn-group form-action-row' }, [parseButton, sampleButton, clearButton]),
      statsEl,
      hint,
      warning,
      createSection('拼接消息', output, [createCopyButton(() => output.value)]),
      createSection('事件明细', tableHost)
    )
  }
}
