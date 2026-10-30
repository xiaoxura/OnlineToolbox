import { createElement } from './core.js'
import { flashCopied } from './components.js'
import allIcons from '../../icons.js'
import { downloadText } from '../download.js'
import { copyToClipboard } from '../clipboard.js'

// Icons used by the result-section toolbar (sized by .btn-icon svg rules).
const resultIcons = {
  copy: allIcons.copy,
  download: allIcons.download,
  wrap: allIcons.wrap,
  collapse: allIcons.collapse,
  expand: allIcons.expand
}

// --- Result section toolbar (copy / download / wrap / collapse) ------------
// Injected into every "output" tool-section after render. Purely additive and
// idempotent — existing per-tool copy buttons are detected and left alone.

function resultContentOf(section) {
  const textarea = section.querySelector('.tool-section-body textarea[readonly]')
  if (textarea) return () => textarea.value
  const box = section.querySelector('.tool-section-body .result-box, .tool-section-body .result-table')
  if (box) {
    // Visual previews (shadow/gradient/image/calculator) have no textual
    // content, so copy/download/wrap/collapse would be meaningless noise.
    if (box.matches('.visual-preview, .placeholder-preview, .calculator-display') || box.hasAttribute('data-no-toolbar')) {
      return null
    }
    return () => box.innerText
  }
  return null
}

function toolbarButton(icon, label, onClick) {
  return createElement('button', {
    className: 'btn-icon',
    type: 'button',
    title: label,
    'aria-label': label,
    innerHTML: icon,
    onClick
  })
}

export function enhanceResultSections(container, { toolName = 'result' } = {}) {
  if (!container) return
  const sections = container.querySelectorAll('.tool-section')
  sections.forEach(section => {
    if (section.dataset.resultEnhanced) return
    const getContent = resultContentOf(section)
    if (!getContent) return

    const header = section.querySelector(':scope > .tool-section-header')
    const body = section.querySelector(':scope > .tool-section-body')
    if (!header || !body) return

    let group = header.querySelector(':scope > .btn-group')
    if (!group) {
      group = createElement('div', { className: 'btn-group' })
      header.appendChild(group)
    }

    // Copy — only when the tool didn't already provide one for this section.
    if (!group.querySelector('.btn-icon[title="复制"], .btn-icon[aria-label^="复制"]')) {
      group.appendChild(toolbarButton(resultIcons.copy, '复制', event => {
        copyToClipboard(getContent())
        flashCopied(event.currentTarget)
      }))
    }

    // Download.
    const filename = `${toolName.replace(/\s+/g, '-').toLowerCase() || 'result'}.txt`
    group.appendChild(toolbarButton(resultIcons.download, '下载为文件', () => downloadText(filename, getContent())))

    // Wrap toggle (only meaningful for a result box / pre-wrap content).
    const box = body.querySelector('.result-box')
    if (box) {
      const wrapBtn = toolbarButton(resultIcons.wrap, '切换自动换行', () => {
        const nowrap = box.classList.toggle('nowrap')
        wrapBtn.classList.toggle('active', nowrap)
        wrapBtn.setAttribute('aria-pressed', String(nowrap))
      })
      wrapBtn.setAttribute('aria-pressed', 'false')
      group.appendChild(wrapBtn)

      // Collapse / expand for long results.
      const collapseBtn = toolbarButton(resultIcons.collapse, '折叠结果', () => {
        const collapsed = box.classList.toggle('collapsed')
        collapseBtn.innerHTML = collapsed ? resultIcons.expand : resultIcons.collapse
        const label = collapsed ? '展开结果' : '折叠结果'
        collapseBtn.title = label
        collapseBtn.setAttribute('aria-label', label)
        collapseBtn.setAttribute('aria-expanded', String(!collapsed))
      })
      collapseBtn.setAttribute('aria-expanded', 'true')
      group.appendChild(collapseBtn)
    }

    section.dataset.resultEnhanced = 'true'
  })
}
