import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

// BPE encodings, loaded on demand. Each one pulls a ~1MB (gzip) vocabulary
// chunk, so a run only pays for the encoding it actually asks for and the
// chunk never reaches the first paint.
const ENCODINGS = [
  { value: 'o200k_base', label: 'o200k_base', chatModel: 'gpt-4o' },
  { value: 'cl100k_base', label: 'cl100k_base', chatModel: 'gpt-4' }
]

const ENCODING_HINTS = {
  o200k_base: 'GPT-4o / GPT-5 / o 系列 / DeepSeek 等较新模型',
  cl100k_base: 'GPT-4 / GPT-3.5 / text-embedding-3'
}

const MODES = [
  { value: 'text', label: '纯文本' },
  { value: 'chat', label: '对话消息' }
]

const SAMPLE_TEXT = 'Token 计数直接影响上下文长度和 API 花费。\nHello, world! 你好，世界。'
const SAMPLE_CHAT = JSON.stringify([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: '你好，介绍一下你自己' }
], null, 2)

const tokenizerPromises = {}

function loadTokenizer(encoding) {
  if (!tokenizerPromises[encoding]) {
    tokenizerPromises[encoding] = encoding === 'cl100k_base'
      ? import('gpt-tokenizer/encoding/cl100k_base')
      : import('gpt-tokenizer/encoding/o200k_base')
  }
  return tokenizerPromises[encoding]
}

const VALID_ROLES = new Set(['system', 'user', 'assistant', 'tool', 'function', 'developer'])

// Parse the chat-mode textarea into a message array, failing loudly enough that
// the user can see which field is wrong rather than getting a bogus count.
export function parseChatMessages(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new Error(`不是合法的 JSON：${cause.message}`)
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.messages
  if (!Array.isArray(list)) throw new Error('需要一个消息数组，或带 messages 字段的对象')
  if (!list.length) throw new Error('消息数组为空')
  return list.map((message, index) => {
    if (!message || typeof message !== 'object') throw new Error(`第 ${index + 1} 条消息不是对象`)
    const { role, content } = message
    if (typeof role !== 'string' || !role.trim()) throw new Error(`第 ${index + 1} 条消息缺少 role`)
    if (!VALID_ROLES.has(role)) throw new Error(`第 ${index + 1} 条消息的 role 无效：${role}`)
    if (content !== undefined && content !== null && typeof content !== 'string') {
      throw new Error(`第 ${index + 1} 条消息的 content 需要是字符串`)
    }
    return { role, content: content ?? '' }
  })
}

// Render one token id as its literal text. A byte-level BPE token can be half
// of a multi-byte character, which decodes to a replacement char — show the
// raw bytes then instead of a row of indistinguishable "�".
function tokenPiece(tokenizer, id) {
  try {
    const text = tokenizer.decode([id])
    if (!text || text.includes('�')) return `<0x${id.toString(16).toUpperCase()}>`
    return text
  } catch {
    return `<0x${id.toString(16).toUpperCase()}>`
  }
}

function statCard(label, value) {
  const card = createElement('div', { className: 'stat-item' })
  card.append(
    createElement('div', { className: 'stat-value', textContent: String(value) }),
    createElement('div', { className: 'stat-label', textContent: label })
  )
  return card
}

function utf8Bytes(text) {
  return new TextEncoder().encode(text).length
}

export default {
  id: 'token-counter',
  name: 'Token 计数器',
  description: '按 BPE 分词器精确计算文本或对话消息的 token 数',
  category: 'ai',
  icon: 'ai-token',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      placeholder: '粘贴要计数的文本…',
      rows: 12
    })
    const status = createElement('div', { className: 'form-hint' })
    const error = createElement('div', { className: 'error-text' })
    const statsEl = createElement('div', { className: 'stats-row' })
    const tableHost = createElement('div')
    const tableHint = createElement('div', { className: 'form-hint' })

    const encodingHint = createElement('div', { className: 'form-hint', textContent: ENCODING_HINTS.o200k_base })

    const encodingGroup = createSegmentedGroup(ENCODINGS, value => {
      encodingHint.textContent = ENCODING_HINTS[value]
      schedule()
    }, { label: '分词编码' })

    const modeGroup = createSegmentedGroup(MODES, value => {
      const chat = value === 'chat'
      input.placeholder = chat ? '粘贴消息数组，如 [{"role":"user","content":"你好"}]' : '粘贴要计数的文本…'
      tableHint.textContent = ''
      schedule()
    }, { label: '计数模式' })

    const currentMode = () => modeGroup.getValue()
    const currentEncoding = () => encodingGroup.getValue()

    let runId = 0
    let timer = null

    async function run() {
      const id = ++runId
      error.textContent = ''
      statsEl.replaceChildren()
      tableHost.replaceChildren()
      tableHint.textContent = ''

      const mode = currentMode()
      const encoding = currentEncoding()
      const text = input.value
      if (!text.trim()) {
        status.textContent = ''
        return
      }

      let tokenizer
      try {
        status.textContent = '正在加载分词器…'
        tokenizer = await loadTokenizer(encoding)
      } catch (cause) {
        status.textContent = ''
        error.textContent = `分词器加载失败：${cause.message}`
        return
      }
      // A slower earlier run must not overwrite a newer one.
      if (id !== runId) return
      status.textContent = ''

      let ids
      let stats
      try {
        if (mode === 'chat') {
          const messages = parseChatMessages(text)
          ids = tokenizer.encodeChat(messages, ENCODINGS.find(item => item.value === encoding).chatModel)
          const plain = tokenizer.countTokens(messages.map(message => message.content).join('\n'))
          stats = [
            ['Token 数', ids.length],
            ['消息数', messages.length],
            ['纯拼接对比', plain],
            ['每条消息开销', messages.length ? ((ids.length - plain) / messages.length).toFixed(2) : '—']
          ]
        } else {
          ids = tokenizer.encode(text)
          stats = [
            ['Token 数', ids.length],
            ['字符数', [...text].length],
            ['字节数(UTF-8)', utf8Bytes(text)],
            ['字符 / Token', ids.length ? (([...text].length) / ids.length).toFixed(2) : '—']
          ]
        }
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : String(cause)
        return
      }
      if (id !== runId) return

      statsEl.append(...stats.map(([label, value]) => statCard(label, value)))

      // The per-token table is a debugging aid, not the headline — skip it for
      // inputs big enough that materializing every row would jank the page.
      const LIMIT = 400
      if (ids.length > LIMIT) {
        tableHint.textContent = `共 ${ids.length} 个 token，仅显示前 ${LIMIT} 个。`
      }
      const rows = ids.slice(0, LIMIT)
      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement('tr', {}, [
            createElement('th', { textContent: '#' }),
            createElement('th', { textContent: 'Token ID' }),
            createElement('th', { textContent: '片段' })
          ])
        ]),
        createElement('tbody', {}, rows.map((tokenId, index) => createElement('tr', {}, [
          createElement('td', { textContent: String(index + 1) }),
          createElement('td', { textContent: String(tokenId) }),
          createElement('td', { className: 'code-text', textContent: tokenPiece(tokenizer, tokenId) })
        ])))
      )
      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, 'Token 明细表，可横向滚动')
      tableHost.replaceChildren(host)
    }

    function schedule() {
      clearTimeout(timer)
      timer = setTimeout(run, 350)
    }

    input.addEventListener('input', schedule)

    const runButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '计算 Token',
      onClick: run
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = currentMode() === 'chat' ? SAMPLE_CHAT : SAMPLE_TEXT
        run()
      }
    })

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '分词编码' }),
          encodingGroup
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '计数模式' }),
          modeGroup
        ])
      ]),
      encodingHint,
      createElement('div', { className: 'btn-group form-action-row' }, [runButton, sampleButton]),
      status,
      error,
      createSection('输入', input),
      createSection('统计结果', statsEl),
      createSection('Token 明细', createElement('div', {}, [tableHost, tableHint]))
    )
  }
}
