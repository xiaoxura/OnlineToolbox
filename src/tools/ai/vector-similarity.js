import { createElement, createSection, createTableScroll } from '../../utils/dom.js'

// Accept either a JSON array or a bare list separated by commas / whitespace /
// newlines — embeddings get pasted from both styles.
export function parseVector(text) {
  const trimmed = String(text).trim()
  if (!trimmed) throw new Error('向量为空')
  let values
  if (trimmed.startsWith('[')) {
    try {
      values = JSON.parse(trimmed)
    } catch (cause) {
      throw new Error(`JSON 解析失败：${cause.message}`)
    }
  } else {
    values = trimmed.split(/[\s,;]+/).filter(Boolean)
  }
  if (!Array.isArray(values) || !values.length) throw new Error('未能解析出向量分量')
  return values.map((value, index) => {
    const number = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(number)) throw new Error(`第 ${index + 1} 个分量不是有效数字`)
    return number
  })
}

export function assertSameLength(a, b) {
  if (a.length !== b.length) throw new Error(`两个向量维度不一致：${a.length} 与 ${b.length}`)
}

export function dotProduct(a, b) {
  assertSameLength(a, b)
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

export function magnitude(a) {
  return Math.sqrt(a.reduce((sum, value) => sum + value * value, 0))
}

export function cosineSimilarity(a, b) {
  const denominator = magnitude(a) * magnitude(b)
  // A zero vector has no direction, so the angle — and the similarity — is
  // undefined rather than 0. Say so instead of returning a NaN downstream.
  if (denominator === 0) throw new Error('存在零向量，余弦相似度无定义')
  return dotProduct(a, b) / denominator
}

export function euclideanDistance(a, b) {
  assertSameLength(a, b)
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

export function manhattanDistance(a, b) {
  assertSameLength(a, b)
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum
}

const SAMPLE_A = '[0.12, -0.98, 0.44, 0.31, 0.07]'
const SAMPLE_B = '[0.15, -0.91, 0.40, 0.35, 0.02]'

const trim = value => Number(value.toPrecision(6))

function vectorSummary(label, vector) {
  return [
    [label, `${vector.length} 维`],
    [`${label} 模长`, trim(magnitude(vector)).toString()],
    [`${label} 是否归一化`, Math.abs(magnitude(vector) - 1) < 1e-3 ? '是' : '否']
  ]
}

export default {
  id: 'vector-similarity',
  name: '向量相似度计算',
  description: '计算两个 embedding 向量的余弦相似度、点积和欧氏距离',
  category: 'ai',
  icon: 'ai-vector',
  render(container) {
    const vectorA = createElement('textarea', {
      className: 'textarea',
      placeholder: '[0.12, -0.98, 0.44] 或 0.12, -0.98, 0.44',
      rows: 6
    })
    const vectorB = createElement('textarea', {
      className: 'textarea',
      placeholder: '[0.15, -0.91, 0.40]',
      rows: 6
    })
    const error = createElement('div', { className: 'error-text' })
    const statsEl = createElement('div', { className: 'stats-row' })
    const resultHost = createElement('div')

    function run() {
      error.textContent = ''
      statsEl.replaceChildren()
      resultHost.replaceChildren()
      if (!vectorA.value.trim() || !vectorB.value.trim()) return
      try {
        const a = parseVector(vectorA.value)
        const b = parseVector(vectorB.value)
        assertSameLength(a, b)

        const cosine = cosineSimilarity(a, b)
        const rows = [
          ['余弦相似度', trim(cosine).toString(), '1 表示方向完全一致，0 表示正交'],
          ['点积', trim(dotProduct(a, b)).toString(), '未归一化向量的内积'],
          ['欧氏距离', trim(euclideanDistance(a, b)).toString(), '越小越接近'],
          ['曼哈顿距离', trim(manhattanDistance(a, b)).toString(), '各分量差值绝对值之和']
        ]

        const table = createElement('table', { className: 'result-table' })
        table.append(
          createElement('thead', {}, [
            createElement('tr', {}, [
              createElement('th', { textContent: '指标' }),
              createElement('th', { textContent: '数值' }),
              createElement('th', { textContent: '说明' })
            ])
          ]),
          createElement('tbody', {}, rows.map(([name, value, note]) => createElement('tr', {}, [
            createElement('td', { textContent: name }),
            createElement('td', { className: 'code-text', textContent: value }),
            createElement('td', { textContent: note })
          ])))
        )
        const host = createElement('div')
        host.appendChild(table)
        createTableScroll(table, '相似度指标表，可横向滚动')

        const summary = [...vectorSummary('向量 A', a), ...vectorSummary('向量 B', b)]
        statsEl.append(...summary.map(([label, value]) => {
          const card = createElement('div', { className: 'stat-item' })
          card.append(
            createElement('div', { className: 'stat-value', textContent: String(value) }),
            createElement('div', { className: 'stat-label', textContent: label })
          )
          return card
        }))
        resultHost.replaceChildren(host)
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    vectorA.addEventListener('input', run)
    vectorB.addEventListener('input', run)

    vectorA.value = SAMPLE_A
    vectorB.value = SAMPLE_B
    run()

    container.append(
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '计算相似度',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            vectorA.value = SAMPLE_A
            vectorB.value = SAMPLE_B
            run()
          }
        })
      ]),
      error,
      createSection('向量 A', vectorA),
      createSection('向量 B', vectorB),
      createSection('向量信息', statsEl),
      createSection('相似度指标', resultHost)
    )
  }
}
