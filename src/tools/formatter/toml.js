import { parse, stringify } from 'smol-toml'
import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

const MODES = [
  { value: 'format', label: '格式化' },
  { value: 'validate', label: '校验' },
  { value: 'json', label: '转 JSON' }
]

const SAMPLE_TOML = `title = "OnlineToolbox"
version = "1.0.0"

[features]
formatter = true
converter = true

[limits]
max_size = 1024`

function tomlErrorText(cause) {
  if (cause && Number.isInteger(cause.line) && Number.isInteger(cause.column)) {
    const summary = String(cause.message || '').split('\n')[0]
    return `第 ${cause.line} 行第 ${cause.column} 列：${summary}`
  }
  return cause instanceof Error ? cause.message : String(cause)
}

function parseToml(text) {
  const source = String(text ?? '')
  if (!source.trim()) throw new Error('请输入 TOML 文本')
  try {
    return parse(source)
  } catch (cause) {
    throw new Error(tomlErrorText(cause))
  }
}

export function formatToml(text, indent = 2) {
  const width = Number(indent)
  if (!Number.isInteger(width) || width < 1 || width > 8) {
    throw new Error('缩进需要是 1-8 之间的整数')
  }
  // smol-toml 的 stringify 没有缩进参数，输出本身是规范的 TOML；保留 indent
  // 让 API 与 YAML 工具一致，同时避免把缩进误解成排序。
  void width
  return stringify(parseToml(text)).trimEnd()
}

export function validateToml(text) {
  const source = String(text ?? '')
  if (!source.trim()) return { ok: false, error: '请输入 TOML 文本' }
  try {
    parse(source)
    return { ok: true, error: '' }
  } catch (cause) {
    return { ok: false, error: tomlErrorText(cause) }
  }
}

export function tomlToJson(text) {
  const parsed = parseToml(text)
  return JSON.stringify(parsed, null, 2)
}

export default {
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      rows: 12,
      placeholder: '粘贴 TOML 文本…',
      'aria-label': 'TOML 输入'
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      rows: 14,
      readOnly: true,
      placeholder: '结果将显示在这里…',
      'aria-label': 'TOML 处理结果'
    })
    const errorEl = createElement('div', { className: 'error-text' })

    let currentMode = 'format'

    const modeGroup = createSegmentedGroup(
      MODES,
      value => {
        currentMode = value
        run()
      },
      { label: '处理模式' }
    )

    function run() {
      errorEl.textContent = ''
      const text = input.value
      if (!text.trim()) {
        output.value = ''
        return
      }
      try {
        if (currentMode === 'format') {
          output.value = formatToml(text)
        } else if (currentMode === 'validate') {
          const result = validateToml(text)
          if (result.ok) {
            output.value = '√ 合法 TOML'
          } else {
            output.value = `✗ ${result.error}`
            errorEl.textContent = result.error
          }
        } else {
          output.value = tomlToJson(text)
        }
      } catch (cause) {
        output.value = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = SAMPLE_TOML
        run()
      }
    })

    const copyButton = createCopyButton(() => output.value)

    input.addEventListener('input', run)

    container.append(
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '处理模式' }),
        modeGroup
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [sampleButton]),
      errorEl,
      createSection('输入 TOML', input),
      createSection('输出结果', output, [copyButton])
    )
  }
}
