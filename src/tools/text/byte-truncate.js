import { createElement, createCopyButton, createSection } from '../../utils/dom.js'

// UTF-8 byte-budget truncation that never splits a user-perceived character.
// Grapheme clusters are used instead of code units so surrogate pairs, emoji
// ZWJ sequences and combining marks stay intact.

const DEFAULT_ELLIPSIS = '…'

export function utf8ByteLength(text) {
  let bytes = 0
  for (const char of String(text ?? '')) {
    const codePoint = char.codePointAt(0)
    if (codePoint <= 0x7f) bytes += 1
    else if (codePoint <= 0x7ff) bytes += 2
    else if (codePoint <= 0xffff) bytes += 3
    else bytes += 4
  }
  return bytes
}

let segmenter = null

function fallbackGraphemes(text) {
  const clusters = []
  const extend = /\p{Mark}/u
  for (const char of text) {
    const codePoint = char.codePointAt(0)
    const attaches =
      extend.test(char) ||
      codePoint === 0x200d ||
      (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
      (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) ||
      (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
    const previous = clusters[clusters.length - 1]
    if (previous !== undefined && (attaches || previous.endsWith('\u200d'))) clusters[clusters.length - 1] = previous + char
    else clusters.push(char)
  }
  return clusters
}

export function splitGraphemes(text) {
  const value = String(text ?? '')
  if (!value) return []
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    segmenter ??= new Intl.Segmenter('zh', { granularity: 'grapheme' })
    return [...segmenter.segment(value)].map(part => part.segment)
  }
  return fallbackGraphemes(value)
}

export function countGraphemes(text) {
  return splitGraphemes(text).length
}

function takeGraphemes(clusters, byteBudget) {
  let bytes = 0
  let count = 0
  let text = ''
  for (const cluster of clusters) {
    const size = utf8ByteLength(cluster)
    if (bytes + size > byteBudget) break
    bytes += size
    count += 1
    text += cluster
  }
  return { text, bytes, count }
}

// Reserve room for the ellipsis inside the same budget. When a custom marker
// does not fit, fall back to the default one and finally to no marker at all.
function ellipsisCandidates(ellipsisText) {
  const candidates = [String(ellipsisText ?? ''), DEFAULT_ELLIPSIS, '']
  return [...new Set(candidates)]
}

export function truncateToBytes(text, maxBytes, { ellipsis = false, ellipsisText = DEFAULT_ELLIPSIS } = {}) {
  const source = String(text ?? '')
  const budget = Number(maxBytes)
  if (!Number.isFinite(budget) || budget < 0) throw new Error('最大字节数必须是非负整数')
  const limit = Math.floor(budget)
  const originalBytes = utf8ByteLength(source)
  if (originalBytes <= limit) return { text: source, bytes: originalBytes, removed: 0 }

  const clusters = splitGraphemes(source)
  if (!ellipsis) {
    const kept = takeGraphemes(clusters, limit)
    return { text: kept.text, bytes: kept.bytes, removed: clusters.length - kept.count }
  }

  for (const marker of ellipsisCandidates(ellipsisText)) {
    const markerBytes = utf8ByteLength(marker)
    if (markerBytes > limit) continue
    const kept = takeGraphemes(clusters, limit - markerBytes)
    const result = kept.text + marker
    return { text: result, bytes: utf8ByteLength(result), removed: clusters.length - kept.count }
  }

  return { text: '', bytes: 0, removed: clusters.length }
}

export function truncateWithStats(text, maxBytes, options) {
  const source = String(text ?? '')
  const result = truncateToBytes(source, maxBytes, options)
  return {
    ...result,
    originalBytes: utf8ByteLength(source),
    originalChars: countGraphemes(source),
    keptChars: countGraphemes(result.text)
  }
}

const SAMPLE_TEXT = '订单备注：请在下班前把 3 份合同扫描件发到邮箱 📧，并抄送给财务组，谢谢配合！'

function statCard(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('div', { className: 'stat-value', textContent: String(value) }),
    createElement('div', { className: 'stat-label', textContent: label })
  ])
}

export default {
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      id: 'byte-truncate-input',
      rows: 8,
      placeholder: '粘贴要截断的文本，例如：你好，世界 👋',
      'aria-label': '原始文本'
    })
    const maxField = createElement('input', {
      className: 'input',
      id: 'byte-truncate-max',
      type: 'number',
      min: '0',
      step: '1',
      value: '60',
      'aria-label': '最大字节数'
    })
    const ellipsisBox = createElement('input', {
      className: 'checkbox',
      id: 'byte-truncate-ellipsis',
      type: 'checkbox'
    })
    const ellipsisOption = createElement('label', { className: 'option-item', for: 'byte-truncate-ellipsis' }, [
      ellipsisBox,
      createElement('span', { textContent: '追加省略号（计入字节预算）' })
    ])
    const output = createElement('textarea', {
      className: 'textarea',
      id: 'byte-truncate-output',
      rows: 8,
      readOnly: true,
      placeholder: '截断结果将显示在此…',
      'aria-label': '截断结果'
    })
    const stats = createElement('div', { className: 'stats-row' })
    const errorEl = createElement('div', { className: 'error-text' })
    const hint = createElement('p', {
      className: 'form-hint',
      textContent: '按 UTF-8 字节截断，emoji、代理对与组合字符不会被拆开；省略号本身也占用预算。'
    })

    const run = () => {
      errorEl.textContent = ''
      const raw = maxField.value.trim()
      if (!raw) {
        output.value = ''
        stats.replaceChildren()
        errorEl.textContent = '请输入最大字节数'
        return
      }
      try {
        const result = truncateWithStats(input.value, Number(raw), {
          ellipsis: ellipsisBox.checked
        })
        output.value = result.text
        stats.replaceChildren(
          statCard('原始字节', result.originalBytes),
          statCard('截断后字节', result.bytes),
          statCard('截断字符数', result.removed)
        )
      } catch (cause) {
        output.value = ''
        stats.replaceChildren()
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = SAMPLE_TEXT
        maxField.value = '60'
        ellipsisBox.checked = true
        run()
      }
    })
    const runBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '截断',
      onClick: run
    })

    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'byte-truncate-max', textContent: '最大字节数（UTF-8）' }),
        maxField
      ]),
      createElement('div', { className: 'form-group option-control-group' }, [
        createElement('div', { className: 'label', textContent: '省略号' }),
        ellipsisOption
      ])
    ])

    input.addEventListener('input', run)
    maxField.addEventListener('input', run)
    ellipsisBox.addEventListener('change', run)

    container.append(
      options,
      createElement('div', { className: 'btn-group form-action-row' }, [runBtn, sampleBtn]),
      errorEl,
      hint,
      createSection('原始文本', input, [createCopyButton(() => input.value)]),
      createSection('截断结果', output, [createCopyButton(() => output.value)]),
      createSection('统计', stats)
    )
    run()
  }
}
