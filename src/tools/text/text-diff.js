import { createElement, createSection, createCopyButton } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import * as Diff from 'diff'

export default {
  id: 'text-diff',
  name: '文本对比',
  description: '对比两段文本的差异',
  category: 'text',
  icon: 'text-diff',
  render(container) {
    const leftInput = createElement('textarea', {
      className: 'textarea',
      placeholder: '原始文本...'
    })

    const rightInput = createElement('textarea', {
      className: 'textarea',
      placeholder: '修改后文本...'
    })

    const inputsRow = createElement('div', {
      className: 'form-row'
    })
    const leftCol = createElement('div', { className: 'form-group' })
    const rightCol = createElement('div', { className: 'form-group' })
    const leftLabel = createElement('div', { className: 'label', textContent: '原始文本' })
    const rightLabel = createElement('div', { className: 'label', textContent: '修改后文本' })
    leftCol.appendChild(leftLabel)
    leftCol.appendChild(leftInput)
    rightCol.appendChild(rightLabel)
    rightCol.appendChild(rightInput)
    inputsRow.appendChild(leftCol)
    inputsRow.appendChild(rightCol)

    const outputEl = createElement('div', { className: 'diff-output' })

    const compareBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '对比差异',
      onClick() {
        const left = leftInput.value
        const right = rightInput.value
        const diff = Diff.diffLines(left, right)

        outputEl.innerHTML = ''

        if (left === right) {
          outputEl.textContent = '两段文本完全相同，没有差异。'
          return
        }

        diff.forEach(part => {
          const lines = part.value.replace(/\n$/, '').split('\n')
          lines.forEach(line => {
            const div = document.createElement('div')
            div.className = 'diff-line'
            if (part.added) {
              div.classList.add('diff-added')
            } else if (part.removed) {
              div.classList.add('diff-removed')
            }
            div.textContent = line
            outputEl.appendChild(div)
          })
        })
      }
    })

    const copyBtn = createCopyButton(() => {
      const left = leftInput.value
      const right = rightInput.value
      const diff = Diff.diffLines(left, right)
      return diff.map(p => {
        if (p.added) return '+ ' + p.value
        if (p.removed) return '- ' + p.value
        return '  ' + p.value
      }).join('')
    })

    const actionsRow = createElement('div', { className: 'btn-group' })
    actionsRow.appendChild(compareBtn)
    actionsRow.appendChild(copyBtn)

    const inputSection = createSection('输入文本', inputsRow)
    const resultSection = createSection('差异结果', outputEl, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(actionsRow)
    container.appendChild(resultSection)
  }
}
