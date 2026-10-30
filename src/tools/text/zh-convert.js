import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

// Simplified / Traditional Chinese conversion backed by opencc-js. The library
// is large, so it is only imported when the user actually converts something.

const DIRECTIONS = {
  s2t: {
    standard: ['cn', 't'],
    tw: ['cn', 'tw'],
    hk: ['cn', 'hk']
  },
  t2s: {
    standard: ['t', 'cn'],
    tw: ['tw', 'cn'],
    hk: ['hk', 'cn']
  }
}

const VARIANTS = new Set(['standard', 'tw', 'hk'])
const converterCache = new Map()
let openccPromise = null

function resolveConfig(direction, variant) {
  if (!Object.hasOwn(DIRECTIONS, direction)) throw new Error(`不支持的转换方向：${direction}（可选 s2t / t2s）`)
  if (!VARIANTS.has(variant)) throw new Error(`不支持的转换变体：${variant}（可选 standard / tw / hk）`)
  return DIRECTIONS[direction][variant]
}

async function loadOpenCC() {
  if (!openccPromise) {
    openccPromise = import('opencc-js')
      .then(module => module.default ?? module)
      .catch(() => {
        openccPromise = null
        throw new Error('繁简转换库加载失败，请稍后重试')
      })
  }
  return openccPromise
}

export async function convertChinese(text, { direction = 's2t', variant = 'standard' } = {}) {
  const value = String(text ?? '')
  const [from, to] = resolveConfig(direction, variant)
  if (!value) return ''

  const key = `${from}->${to}`
  try {
    const OpenCC = await loadOpenCC()
    let converter = converterCache.get(key)
    if (!converter) {
      converter = OpenCC.Converter({ from, to })
      converterCache.set(key, converter)
    }
    return converter(value)
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('繁简转换库加载失败')) throw cause
    throw new Error(`繁简转换失败：${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

export async function convertBatch(lines, options = {}) {
  if (!Array.isArray(lines)) throw new Error('批量转换需要字符串数组')
  // Validate before loading so an invalid direction fails fast.
  resolveConfig(options.direction ?? 's2t', options.variant ?? 'standard')
  const results = []
  for (const line of lines) results.push(await convertChinese(line, options))
  return results
}

const SAMPLE_TEXT = '头发和发财：他发现理发师在发廊里发了财，还把头发染成了黑色。'

export default {
  render(container) {
    const direction = createSegmentedGroup(
      [
        { value: 's2t', label: '简体 → 繁体' },
        { value: 't2s', label: '繁体 → 简体' }
      ],
      () => schedule(),
      { label: '转换方向' }
    )

    const variantSelect = createElement('select', { className: 'select', id: 'zh-convert-variant', 'aria-label': '转换变体' }, [
      createElement('option', { value: 'standard', textContent: '标准（大陆 ↔ 通用繁体）' }),
      createElement('option', { value: 'tw', textContent: '台湾' }),
      createElement('option', { value: 'hk', textContent: '香港' })
    ])

    const input = createElement('textarea', {
      className: 'textarea',
      id: 'zh-convert-input',
      rows: 10,
      placeholder: '请输入简体或繁体中文，例如：头发和发财',
      'aria-label': '待转换文本'
    })
    const output = createElement('textarea', {
      className: 'textarea',
      id: 'zh-convert-output',
      rows: 10,
      readOnly: true,
      placeholder: '转换结果将显示在此…',
      'aria-label': '转换结果'
    })
    const errorEl = createElement('div', { className: 'error-text' })
    const statusEl = createElement('div', {
      className: 'loading-text',
      role: 'status',
      'aria-live': 'polite'
    })
    const hint = createElement('p', {
      className: 'form-hint',
      textContent: '使用 OpenCC 词典离线转换；首次转换会按需加载词典（约数百 KB）。人名、地名等专有名词仍可能存在歧义。'
    })

    let timer = 0
    let requestId = 0

    const run = async () => {
      const id = ++requestId
      const text = input.value
      if (!text.trim()) {
        output.value = ''
        errorEl.textContent = ''
        statusEl.textContent = ''
        return
      }
      statusEl.textContent = '正在转换…'
      try {
        const result = await convertChinese(text, {
          direction: direction.getValue(),
          variant: variantSelect.value
        })
        if (id !== requestId) return
        output.value = result
        errorEl.textContent = ''
        statusEl.textContent = ''
      } catch (cause) {
        if (id !== requestId) return
        output.value = ''
        statusEl.textContent = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const schedule = () => {
      clearTimeout(timer)
      // Invalidate any in-flight request immediately so an older result can
      // never overwrite a newer one, even before the debounce fires.
      requestId += 1
      timer = setTimeout(run, 200)
    }

    variantSelect.addEventListener('change', schedule)
    input.addEventListener('input', schedule)

    const runBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '转换',
      onClick: () => {
        clearTimeout(timer)
        run()
      }
    })
    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = SAMPLE_TEXT
        clearTimeout(timer)
        run()
      }
    })
    const copyBtn = createCopyButton(() => output.value)

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '转换方向' }),
          direction
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', for: 'zh-convert-variant', textContent: '地区变体' }),
          variantSelect
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [runBtn, sampleBtn]),
      errorEl,
      statusEl,
      hint,
      createSection('原始文本', input),
      createSection('转换结果', output, [copyBtn])
    )
  }
}
