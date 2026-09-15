import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'

const UNITS = [
  { value: 'char', label: '按字符' },
  { value: 'token', label: '按 Token' }
]

const tokenizerPromises = {}
function loadTokenizer(encoding) {
  if (!tokenizerPromises[encoding]) {
    tokenizerPromises[encoding] = encoding === 'cl100k_base'
      ? import('gpt-tokenizer/encoding/cl100k_base')
      : import('gpt-tokenizer/encoding/o200k_base')
  }
  return tokenizerPromises[encoding]
}

function assertOptions(size, overlap) {
  if (!Number.isInteger(size) || size <= 0) throw new Error('分块大小必须是大于 0 的整数')
  if (!Number.isInteger(overlap) || overlap < 0) throw new Error('重叠长度必须是不小于 0 的整数')
  if (overlap >= size) throw new Error('重叠长度必须小于分块大小，否则无法推进')
}

// Pull a cut point back to the nearest paragraph, then sentence, then line
// break — but never more than halfway into the chunk, so a chunk can't collapse
// to a stub just because the text has no punctuation nearby.
function snapToBoundary(text, start, end) {
  const floor = start + Math.max(1, Math.floor((end - start) / 2))
  const window = text.slice(floor, end)
  const paragraph = window.lastIndexOf('\n\n')
  if (paragraph >= 0) return floor + paragraph + 2
  const punctuation = ['。', '！', '？', '. ', '! ', '? ', '\n']
    .map(mark => window.lastIndexOf(mark))
    .reduce((best, index) => Math.max(best, index), -1)
  if (punctuation >= 0) return floor + punctuation + 1
  return end
}

export function chunkByChars(text, size, overlap, boundaryAware) {
  assertOptions(size, overlap)
  const chunks = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + size, text.length)
    if (boundaryAware && end < text.length) end = snapToBoundary(text, start, end)
    chunks.push(text.slice(start, end))
    if (end >= text.length) break
    // Never move backwards or stall, even after a boundary snap.
    start = Math.max(end - overlap, start + 1)
  }
  return chunks
}

export function chunkByTokens(tokenizer, text, size, overlap, boundaryAware) {
  assertOptions(size, overlap)
  const ids = tokenizer.encode(text)
  const chunks = []
  let start = 0
  while (start < ids.length) {
    let end = Math.min(start + size, ids.length)
    if (boundaryAware && end < ids.length) {
      const window = tokenizer.decode(ids.slice(start, end))
      const snapped = snapToBoundary(window, 0, window.length)
      // Map the character cut back to a token cut only when it is a real cut.
      if (snapped < window.length) {
        const kept = tokenizer.encode(window.slice(0, snapped)).length
        end = Math.max(start + 1, Math.min(end, start + kept))
      }
    }
    // A slice boundary can land mid-character; drop the replacement chars it
    // leaves at the edges rather than shipping them into an embedding.
    chunks.push(tokenizer.decode(ids.slice(start, end)).replace(/^�+|�+$/g, ''))
    if (end >= ids.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks
}

const SAMPLE = `检索增强生成（RAG）需要把长文档切分成适合嵌入的片段。片段太长会稀释语义，太短又会丢失上下文。

常见的做法是按固定长度切分，并让相邻片段保留一段重叠，避免关键信息正好落在切口上。

重叠过大会显著增加向量库的体积和检索成本，通常取分块大小的 10% 到 20% 即可。`

function statsFor(chunks) {
  const lengths = chunks.map(chunk => chunk.length)
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1
  return [
    ['分块数', chunks.length],
    ['平均长度', Math.round(total / (chunks.length || 1))],
    ['最短', lengths.length ? Math.min(...lengths) : 0],
    ['最长', lengths.length ? Math.max(...lengths) : 0]
  ]
}

export default {
  id: 'text-chunker',
  name: '文本分块器',
  description: '把长文本按字符或 token 切成带重叠的片段，用于 RAG 索引',
  category: 'ai',
  icon: 'ai-chunk',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      placeholder: '粘贴需要切分的长文本…',
      rows: 10
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      readOnly: true,
      placeholder: '分块结果将以 JSON 数组显示…',
      rows: 10
    })

    const sizeInput = createElement('input', { className: 'input', type: 'number', value: '500', min: '1' })
    const overlapInput = createElement('input', { className: 'input', type: 'number', value: '50', min: '0' })
    const encodingSelect = createElement('select', { className: 'select', 'aria-label': '分词编码' }, [
      createElement('option', { value: 'o200k_base', textContent: 'o200k_base' }),
      createElement('option', { value: 'cl100k_base', textContent: 'cl100k_base' })
    ])
    const boundaryToggle = createElement('input', { className: 'checkbox', type: 'checkbox', checked: true })

    const statsEl = createElement('div', { className: 'stats-row' })
    const hint = createElement('div', { className: 'form-hint' })
    const error = createElement('div', { className: 'error-text' })

    let runId = 0

    const unitGroup = createSegmentedGroup(UNITS, () => run(), { label: '分块单位' })

    async function run() {
      const id = ++runId
      error.textContent = ''
      output.value = ''
      statsEl.replaceChildren()
      if (!input.value.trim()) {
        hint.textContent = ''
        return
      }

      const unit = unitGroup.getValue()
      const size = Number(sizeInput.value)
      const overlap = Number(overlapInput.value)
      const boundaryAware = boundaryToggle.checked

      try {
        let chunks
        if (unit === 'token') {
          hint.textContent = '正在加载分词器…'
          const tokenizer = await loadTokenizer(encodingSelect.value)
          if (id !== runId) return
          hint.textContent = '按 token 切分时，块边界的多字节字符可能被截断，已自动清理残留字节。'
          chunks = chunkByTokens(tokenizer, input.value, size, overlap, boundaryAware)
        } else {
          hint.textContent = ''
          chunks = chunkByChars(input.value, size, overlap, boundaryAware)
        }
        if (id !== runId) return

        output.value = JSON.stringify(chunks, null, 2)
        statsEl.append(...statsFor(chunks).map(([label, value]) => {
          const card = createElement('div', { className: 'stat-item' })
          card.append(
            createElement('div', { className: 'stat-value', textContent: String(value) }),
            createElement('div', { className: 'stat-label', textContent: label })
          )
          return card
        }))
      } catch (cause) {
        hint.textContent = ''
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    input.addEventListener('input', run)
    sizeInput.addEventListener('input', run)
    overlapInput.addEventListener('input', run)
    encodingSelect.addEventListener('change', run)
    boundaryToggle.addEventListener('change', run)

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '分块单位' }),
          unitGroup
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '分块大小' }),
          sizeInput
        ])
      ]),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '重叠长度' }),
          overlapInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '分词编码' }),
          encodingSelect
        ])
      ]),
      createElement('label', { className: 'option-item' }, [
        boundaryToggle,
        createElement('span', { textContent: '优先在段落或句子边界切分' })
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '开始分块',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            input.value = SAMPLE
            run()
          }
        })
      ]),
      error,
      hint,
      createSection('原始文本', input),
      createSection('分块统计', statsEl),
      createSection('分块结果', output)
    )
  }
}
