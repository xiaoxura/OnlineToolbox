import { createElement, createSection, createCopyButton } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'text-dedup',
  name: '文本去重',
  description: '去除重复的行',
  category: 'text',
  icon: 'text-dedup',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入文本，每行一条...'
    })

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '去重结果...',
      readOnly: true
    })

    const ignoreCase = createElement('label', { className: 'checkbox-label' })
    const ignoreCaseCb = createElement('input', { type: 'checkbox' })
    ignoreCase.appendChild(ignoreCaseCb)
    ignoreCase.appendChild(document.createTextNode(' 忽略大小写'))

    const keepEmpty = createElement('label', { className: 'checkbox-label' })
    const keepEmptyCb = createElement('input', { type: 'checkbox', checked: true })
    keepEmpty.appendChild(keepEmptyCb)
    keepEmpty.appendChild(document.createTextNode(' 保留空行'))

    const optionsRow = createElement('div', {
      className: 'form-row'
    })
    optionsRow.appendChild(ignoreCase)
    optionsRow.appendChild(keepEmpty)

    const statsEl = createElement('div', {
      className: 'inline-result'
    })

    const dedupeBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '去重',
      onClick() {
        const lines = input.value.split('\n')
        const originalCount = lines.length
        const seen = new Set()
        const result = []

        lines.forEach(line => {
          const key = ignoreCaseCb.checked ? line.toLowerCase() : line
          if (line === '' && keepEmptyCb.checked) {
            result.push(line)
          } else if (!seen.has(key)) {
            seen.add(key)
            result.push(line)
          }
        })

        const dedupedCount = result.length
        const removedCount = originalCount - dedupedCount

        output.value = result.join('\n')
        statsEl.innerHTML = `<span>原始行数: <strong>${originalCount}</strong></span>
          <span>去重后行数: <strong>${dedupedCount}</strong></span>
          <span>删除行数: <strong>${removedCount}</strong></span>`
      }
    })

    const copyBtn = createCopyButton(() => output.value)

    const actionsRow = createElement('div', { className: 'btn-group' })
    actionsRow.appendChild(dedupeBtn)

    const inputSection = createSection('输入文本', input)
    const resultSection = createSection('去重结果', output, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(optionsRow)
    container.appendChild(actionsRow)
    container.appendChild(statsEl)
    container.appendChild(resultSection)
  }
}
