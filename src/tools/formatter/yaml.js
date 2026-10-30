import { load, dump, YAMLException } from 'js-yaml'
import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

const MODES = [
  { value: 'format', label: '格式化' },
  { value: 'validate', label: '校验' },
  { value: 'json', label: '转 JSON' }
]

const SAMPLE_YAML = `name: OnlineToolbox
version: 1.0.0
features:
  - formatter
  - converter
config:
  enabled: true
  retries: 3`

function yamlErrorText(cause) {
  if (cause instanceof YAMLException && cause.mark && Number.isInteger(cause.mark.line)) {
    const line = cause.mark.line + 1
    const column = cause.mark.column + 1
    const reason = cause.reason || String(cause.message).split('\n')[0]
    return `第 ${line} 行第 ${column} 列：${reason}`
  }
  return cause instanceof Error ? cause.message : String(cause)
}

function parseYaml(text) {
  const source = String(text ?? '')
  if (!source.trim()) throw new Error('请输入 YAML 文本')
  try {
    return load(source)
  } catch (cause) {
    throw new Error(yamlErrorText(cause))
  }
}

export function formatYaml(text, indent = 2) {
  const width = Number(indent)
  if (!Number.isInteger(width) || width < 1 || width > 8) {
    throw new Error('缩进需要是 1-8 之间的整数')
  }
  const parsed = parseYaml(text)
  return dump(parsed, { indent: width, lineWidth: -1, noRefs: true, sortKeys: false }).trimEnd()
}

export function validateYaml(text) {
  const source = String(text ?? '')
  if (!source.trim()) return { ok: false, error: '请输入 YAML 文本' }
  try {
    load(source)
    return { ok: true, error: '' }
  } catch (cause) {
    return { ok: false, error: yamlErrorText(cause) }
  }
}

export function yamlToJson(text) {
  const parsed = parseYaml(text)
  const json = JSON.stringify(parsed, null, 2)
  return json === undefined ? 'null' : json
}

export default {
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      rows: 12,
      placeholder: '粘贴 YAML 文本…',
      'aria-label': 'YAML 输入'
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      rows: 14,
      readOnly: true,
      placeholder: '结果将显示在这里…',
      'aria-label': 'YAML 处理结果'
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
          output.value = formatYaml(text)
        } else if (currentMode === 'validate') {
          const result = validateYaml(text)
          if (result.ok) {
            output.value = '√ 合法 YAML'
          } else {
            output.value = `✗ ${result.error}`
            errorEl.textContent = result.error
          }
        } else {
          output.value = yamlToJson(text)
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
        input.value = SAMPLE_YAML
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
      createSection('输入 YAML', input),
      createSection('输出结果', output, [copyButton])
    )
  }
}
