import '../../styles/tools/embedding-cost.css'
import { createElement, createSection, createTableScroll } from '../../utils/dom.js'

export const DATA_UPDATED = '2026-10-30'

// USD per 1,000,000 input tokens, read from the vendors' pricing pages on
// DATA_UPDATED. Self-hosted and free-tier rows are kept at 0 so the calculator
// still shows the token cost, with the caveat spelled out in `note`.
export const EMBEDDING_MODELS = [
  {
    id: 'text-embedding-3-small',
    name: 'text-embedding-3-small',
    provider: 'OpenAI',
    dims: 1536,
    pricePerMillion: 0.02,
    maxTokens: 8191,
    note: '通用检索，性价比高'
  },
  {
    id: 'text-embedding-3-large',
    name: 'text-embedding-3-large',
    provider: 'OpenAI',
    dims: 3072,
    pricePerMillion: 0.13,
    maxTokens: 8191,
    note: '最高精度，可裁剪维度'
  },
  {
    id: 'text-embedding-ada-002',
    name: 'text-embedding-ada-002',
    provider: 'OpenAI',
    dims: 1536,
    pricePerMillion: 0.1,
    maxTokens: 8191,
    note: '旧版模型，逐步被 v3 取代'
  },
  {
    id: 'embed-multilingual-v3.0',
    name: 'embed-multilingual-v3.0',
    provider: 'Cohere',
    dims: 1024,
    pricePerMillion: 0.1,
    maxTokens: 512,
    note: '多语言检索，单条 512 token 上限'
  },
  {
    id: 'bge-m3',
    name: 'BGE-M3',
    provider: 'BAAI / 智源',
    dims: 1024,
    pricePerMillion: 0,
    maxTokens: 8192,
    note: '自托管开源模型，API 费用为 0，不含算力成本'
  },
  {
    id: 'text-embedding-v3',
    name: 'text-embedding-v3',
    provider: '阿里云百炼',
    dims: 1024,
    pricePerMillion: 0.07,
    maxTokens: 8192,
    note: '支持中文与多语言，维度可调'
  },
  {
    id: 'text-embedding-004',
    name: 'text-embedding-004',
    provider: 'Google Gemini',
    dims: 768,
    pricePerMillion: 0,
    maxTokens: 2048,
    note: '免费额度内 $0，超出后按官方价计费'
  },
  {
    id: 'voyage-3',
    name: 'voyage-3',
    provider: 'Voyage AI',
    dims: 1024,
    pricePerMillion: 0.06,
    maxTokens: 32000,
    note: '长文本检索，支持 32K 输入'
  }
]

const PRECISIONS = [
  { value: '4', label: 'float32（4 字节 / 维）' },
  { value: '2', label: 'float16（2 字节 / 维）' },
  { value: '1', label: 'int8（1 字节 / 维）' }
]

const PRECISION_BYTES = {
  float32: 4,
  fp32: 4,
  f32: 4,
  4: 4,
  float16: 2,
  fp16: 2,
  f16: 2,
  2: 2,
  int8: 1,
  i8: 1,
  1: 1
}

const SOURCES = [
  { name: 'OpenAI 定价', url: 'https://openai.com/api/pricing/' },
  { name: 'Cohere 定价', url: 'https://cohere.com/pricing' },
  { name: 'BGE-M3（BAAI）', url: 'https://huggingface.co/BAAI/bge-m3' },
  { name: '阿里云百炼 Embedding', url: 'https://help.aliyun.com/zh/model-studio/embedding' },
  { name: 'Google Gemini 定价', url: 'https://ai.google.dev/gemini-api/docs/pricing' },
  { name: 'Voyage AI 定价', url: 'https://docs.voyageai.com/docs/pricing' }
]

const trimZeros = value => value.replace(/0+$/, '').replace(/\.$/, '')

const numberValue = value => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export function embeddingCost({ tokens, pricePerMillion } = {}) {
  return (numberValue(tokens) * numberValue(pricePerMillion)) / 1_000_000
}

export function formatCost(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return '—'
  if (number === 0) return '$0'
  if (number < 0.0001) return `$${number.toExponential(2)}`
  if (number < 0.01) return `$${trimZeros(number.toFixed(6))}`
  if (number < 1) return `$${trimZeros(number.toFixed(4))}`
  return `$${number.toFixed(2)}`
}

export function storageBytes({ vectors, dims, precision = 4 } = {}) {
  const vectorCount = Math.floor(numberValue(vectors))
  const dimensions = Math.floor(numberValue(dims))
  const key = typeof precision === 'string' ? precision.trim().toLowerCase() : precision
  const bytesPerValue = PRECISION_BYTES[key]
  if (!bytesPerValue) return 0
  return vectorCount * dimensions * bytesPerValue
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = unit === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${Number(value.toFixed(digits))} ${units[unit]}`
}

function field(label, control) {
  return createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: label }), control])
}

function statCard(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('div', { className: 'stat-value', textContent: value }),
    createElement('div', { className: 'stat-label', textContent: label })
  ])
}

function textLength(text) {
  return [...text].length
}

export default {
  render(container) {
    const modelSelect = createElement('select', {
      className: 'select',
      'aria-label': '选择 Embedding 模型'
    })
    for (const model of EMBEDDING_MODELS) {
      modelSelect.appendChild(
        createElement('option', {
          value: model.id,
          textContent: `${model.name} · ${model.provider}`
        })
      )
    }

    const tokensInput = createElement('input', {
      className: 'input',
      type: 'number',
      min: '0',
      step: '1',
      value: '1000',
      'aria-label': '输入 token 数'
    })
    const vectorsInput = createElement('input', {
      className: 'input',
      type: 'number',
      min: '0',
      step: '1',
      value: '1000',
      'aria-label': '向量条数'
    })
    const precisionSelect = createElement(
      'select',
      {
        className: 'select',
        'aria-label': '向量存储精度'
      },
      PRECISIONS.map(item => createElement('option', { value: item.value, textContent: item.label }))
    )

    const pasteInput = createElement('textarea', {
      className: 'textarea',
      rows: 5,
      placeholder: '粘贴文本，按字符数 / 4 估算 token…',
      'aria-label': '用于估算 token 的文本'
    })
    const pasteHint = createElement('div', { className: 'form-hint' })

    const statsEl = createElement('div', { className: 'stats-row' })
    const calcHint = createElement('div', { className: 'form-hint' })
    const compareHost = createElement('div')
    const compareHint = createElement('div', { className: 'form-hint' })
    const barsHost = createElement('div', { className: 'dim-compare' })

    function currentModel() {
      return EMBEDDING_MODELS.find(model => model.id === modelSelect.value) || EMBEDDING_MODELS[0]
    }

    function buildCompareTable() {
      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement(
            'tr',
            {},
            ['模型', '厂商', '维度', '价格 / 1M', '最大 token', '说明'].map(label => createElement('th', { textContent: label }))
          )
        ]),
        createElement(
          'tbody',
          {},
          EMBEDDING_MODELS.map(model =>
            createElement('tr', {}, [
              createElement('td', { className: 'code-text', textContent: model.name }),
              createElement('td', { textContent: model.provider }),
              createElement('td', { textContent: String(model.dims) }),
              createElement('td', { textContent: `${formatCost(model.pricePerMillion)} / 1M` }),
              createElement('td', { textContent: String(model.maxTokens) }),
              createElement('td', { textContent: model.note })
            ])
          )
        )
      )
      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, 'Embedding 模型对照表，可横向滚动')
      compareHost.replaceChildren(host)

      const maxDims = Math.max(...EMBEDDING_MODELS.map(model => model.dims))
      barsHost.replaceChildren(
        ...EMBEDDING_MODELS.map(model => {
          const fill = createElement('div', { className: 'dim-fill' })
          fill.style.width = `${(model.dims / maxDims) * 100}%`
          return createElement('div', { className: 'dim-row' }, [
            createElement('div', { className: 'dim-name', textContent: model.name }),
            createElement('div', { className: 'dim-track', title: `${model.dims} 维` }, [fill]),
            createElement('div', { className: 'dim-value', textContent: `${model.dims} 维` })
          ])
        })
      )
    }

    function compute() {
      const model = currentModel()
      const tokens = Math.floor(numberValue(tokensInput.value))
      const vectors = Math.floor(numberValue(vectorsInput.value))
      const precision = Number(precisionSelect.value)
      const cost = embeddingCost({ tokens, pricePerMillion: model.pricePerMillion })
      const bytes = storageBytes({ vectors, dims: model.dims, precision })

      statsEl.replaceChildren(
        statCard('单次请求成本', formatCost(cost)),
        statCard('模型维度', `${model.dims} 维`),
        statCard('向量存储占用', formatBytes(bytes)),
        statCard('单条请求 token', tokens.toLocaleString('en-US'))
      )

      const priceLine =
        model.pricePerMillion === 0
          ? `${model.name} 当前按 $0 计费（${model.note}）。`
          : `${model.name} 单价 ${formatCost(model.pricePerMillion)} / 1M token。`
      calcHint.textContent =
        `${priceLine} ${tokens.toLocaleString('en-US')} token × ${formatCost(model.pricePerMillion)} / 1M = ${formatCost(cost)}；` +
        `${vectors.toLocaleString('en-US')} 条 ${model.dims} 维向量按 ${precision === 4 ? 'float32' : precision === 2 ? 'float16' : 'int8'} 存储约 ${formatBytes(bytes)}。`
    }

    function estimateFromText() {
      const length = textLength(pasteInput.value)
      if (!length) {
        pasteHint.textContent = '请先粘贴文本，再按字符数 / 4 估算。'
        return
      }
      const tokens = Math.max(1, Math.ceil(length / 4))
      tokensInput.value = String(tokens)
      pasteHint.textContent = `按 ${length} 个字符 / 4 估算，约 ${tokens} token（实际分词略低，含中文时偏差更明显）。`
      compute()
    }

    pasteInput.addEventListener('input', () => {
      const length = textLength(pasteInput.value)
      pasteHint.textContent = length ? `当前 ${length} 个字符，点击「估算 token」按 /4 写入 token 数。` : ''
    })

    const estimateButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '估算 token',
      onClick: estimateFromText
    })
    const recalcButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '计算成本',
      onClick: compute
    })

    for (const control of [modelSelect, precisionSelect]) control.addEventListener('change', compute)
    for (const control of [tokensInput, vectorsInput]) control.addEventListener('input', compute)

    buildCompareTable()
    compareHint.textContent = `模型价格与维度读取于 ${DATA_UPDATED}。价格为官方标价（USD / 每百万 token），厂商会随时调价，最终以官方页面为准。`
    compute()

    const sourceList = createElement(
      'ul',
      {},
      SOURCES.map(source =>
        createElement('li', {}, [
          createElement('a', {
            href: source.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            textContent: source.name
          })
        ])
      )
    )

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 所有计算在本地完成，粘贴的文本不会上传到服务器。'
      }),
      createElement('div', { className: 'form-row' }, [field('模型', modelSelect), field('存储精度', precisionSelect)]),
      createElement('div', { className: 'form-row' }, [field('输入 token 数', tokensInput), field('向量条数', vectorsInput)]),
      createSection(
        '按文本估算 token',
        createElement('div', {}, [
          pasteInput,
          createElement('div', { className: 'btn-group form-action-row' }, [estimateButton, recalcButton]),
          pasteHint
        ])
      ),
      createSection('成本与存储', createElement('div', {}, [statsEl, calcHint])),
      createSection('模型对照', createElement('div', {}, [compareHost, compareHint])),
      createSection('维度对比', barsHost),
      createSection(
        '数据来源',
        createElement('div', {}, [
          createElement('p', {
            className: 'form-hint',
            textContent: '价格会变动，以官方页面为准；自托管模型的 $0 只表示 API 费用，不包含 GPU 算力与运维成本。'
          }),
          sourceList
        ])
      )
    )
  }
}
