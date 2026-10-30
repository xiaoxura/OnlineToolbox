import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

// Chinese → pinyin conversion. pinyin-pro is relatively large, so the module
// is imported on the first conversion instead of during render().

const HAN_RUN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g
const STYLES = new Set(['full', 'initial', 'first'])
let pinyinPromise = null

async function loadPinyin() {
  if (!pinyinPromise) {
    pinyinPromise = import('pinyin-pro')
      .then(module => module.pinyin ?? module.default?.pinyin)
      .catch(() => {
        pinyinPromise = null
        throw new Error('拼音库加载失败，请稍后重试')
      })
  }
  return pinyinPromise
}

function splitSegments(value) {
  const segments = []
  let cursor = 0
  const pattern = new RegExp(HAN_RUN.source, 'g')
  let match
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) segments.push({ type: 'text', value: value.slice(cursor, match.index) })
    segments.push({ type: 'han', value: match[0] })
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) segments.push({ type: 'text', value: value.slice(cursor) })
  return segments
}

function isWordCharacter(char) {
  return Boolean(char) && /[\p{L}\p{N}]/u.test(char)
}

function needsSpace(left, right, separator) {
  if (!left || !right) return false
  if (/\s/.test(left) || /\s/.test(right)) return false
  if (separator && left === separator) return false
  return isWordCharacter(left) && isWordCharacter(right)
}

function normalizeOutput(value, separator) {
  let text = value.replace(/[ \t\f\v]{2,}/g, ' ')
  if (separator) text = text.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
  return text.trim()
}

export async function toPinyin(text, { tone = false, separator = ' ', style = 'full' } = {}) {
  if (!STYLES.has(style)) throw new Error(`不支持的拼音风格：${style}（可选 full / initial / first）`)
  const value = String(text ?? '')
  if (!value) return ''

  const pinyin = await loadPinyin()
  const sep = String(separator ?? '')
  const toneOption = tone ? 'symbol' : 'none'

  const convertHan = run => {
    if (style === 'first') {
      return [...run]
        .map(char => {
          const readings = pinyin(char, { toneType: toneOption, multiple: true, type: 'array' })
          return readings[0] ?? char
        })
        .join(sep)
    }
    if (style === 'initial') {
      return pinyin(run, { toneType: 'none', pattern: 'initial', type: 'array' })
        .map(syllable => syllable.charAt(0).toLowerCase())
        .join(sep)
    }
    return pinyin(run, { toneType: toneOption, type: 'array' }).join(sep)
  }

  let output = ''
  for (const segment of splitSegments(value)) {
    if (segment.type === 'han') {
      const piece = convertHan(segment.value)
      if (!piece) continue
      if (needsSpace(output.at(-1), piece.charAt(0), sep)) output += ' '
      output += piece
    } else {
      const piece = segment.value.replace(/[ \t\f\v]+/g, ' ')
      if (needsSpace(output.at(-1), piece.charAt(0), sep)) output += ' '
      output += piece
    }
  }
  return normalizeOutput(output, sep)
}

const SAMPLE_TEXT = '重庆银行行长说：Hello 世界，2025 年见！'

export default {
  render(container) {
    const style = createSegmentedGroup(
      [
        { value: 'full', label: '全拼' },
        { value: 'initial', label: '首字母' },
        { value: 'first', label: '多音字首读' }
      ],
      () => schedule(),
      { label: '拼音风格' }
    )

    const toneBox = createElement('input', {
      className: 'checkbox',
      id: 'pinyin-tone',
      type: 'checkbox'
    })
    const toneOption = createElement('label', { className: 'option-item', for: 'pinyin-tone' }, [
      toneBox,
      createElement('span', { textContent: '标注声调' })
    ])

    const separatorSelect = createElement('select', { className: 'select', id: 'pinyin-separator', 'aria-label': '音节分隔符' }, [
      createElement('option', { value: ' ', textContent: '空格' }),
      createElement('option', { value: '', textContent: '无分隔' }),
      createElement('option', { value: '-', textContent: '连字符（-）' })
    ])

    const input = createElement('textarea', {
      className: 'textarea',
      id: 'pinyin-input',
      rows: 10,
      placeholder: '请输入中文，例如：重庆银行行长',
      'aria-label': '待转换文本'
    })
    const output = createElement('textarea', {
      className: 'textarea',
      id: 'pinyin-output',
      rows: 10,
      readOnly: true,
      placeholder: '拼音结果将显示在此…',
      'aria-label': '拼音结果'
    })
    const errorEl = createElement('div', { className: 'error-text' })
    const statusEl = createElement('div', {
      className: 'loading-text',
      role: 'status',
      'aria-live': 'polite'
    })
    const hint = createElement('p', {
      className: 'form-hint',
      textContent: '英文、数字与标点原样保留；“多音字首读”会在多音字中取词典里的第一个读音，不结合上下文判断。'
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
        const result = await toPinyin(text, {
          tone: toneBox.checked,
          separator: separatorSelect.value,
          style: style.getValue()
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
      requestId += 1
      timer = setTimeout(run, 150)
    }

    input.addEventListener('input', schedule)
    toneBox.addEventListener('change', schedule)
    separatorSelect.addEventListener('change', schedule)

    const runBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '转拼音',
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

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [createElement('div', { className: 'label', textContent: '拼音风格' }), style]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', for: 'pinyin-separator', textContent: '分隔符' }),
          separatorSelect
        ]),
        createElement('div', { className: 'form-group option-control-group' }, [
          createElement('div', { className: 'label', textContent: '声调' }),
          toneOption
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [runBtn, sampleBtn]),
      errorEl,
      statusEl,
      hint,
      createSection('原始文本', input),
      createSection('拼音结果', output, [createCopyButton(() => output.value)])
    )
  }
}
