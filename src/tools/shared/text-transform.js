import { createElement, createSection } from '../../utils/dom.js'

export function renderTextTransform(container, {
  inputTitle = '输入',
  outputTitle = '输出',
  inputPlaceholder = '请输入内容...',
  outputPlaceholder = '处理结果将显示在此...',
  actionLabel = '转换',
  sample,
  transform,
  options = [],
  rows = 12,
  live = false
}) {
  const input = createElement('textarea', {
    className: 'textarea',
    placeholder: inputPlaceholder,
    rows
  })
  const output = createElement('textarea', {
    className: 'textarea',
    placeholder: outputPlaceholder,
    rows,
    readOnly: true
  })
  const error = createElement('div', { className: 'error-text' })

  const run = () => {
    error.textContent = ''
    try {
      const result = transform(input.value)
      output.value = result == null ? '' : String(result)
    } catch (cause) {
      output.value = ''
      error.textContent = cause instanceof Error ? cause.message : String(cause)
    }
  }

  const actions = [
    createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: actionLabel,
      onClick: run
    })
  ]

  if (sample !== undefined) {
    actions.push(createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = typeof sample === 'function' ? sample() : sample
        run()
      }
    }))
  }

  const optionNodes = Array.isArray(options) ? options : [options]
  container.append(
    ...optionNodes.filter(Boolean),
    createElement('div', { className: 'btn-group form-action-row' }, actions),
    error,
    createSection(inputTitle, input),
    createSection(outputTitle, output)
  )

  if (live) input.addEventListener('input', run)
  return { input, output, error, run }
}
