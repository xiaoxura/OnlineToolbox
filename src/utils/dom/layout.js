import { createElement } from './core.js'
import allIcons from '../../icons.js'

// --- Two-column input/output layout ---------------------------------------
// Heuristic split that runs right after a tool renders, before
// enhanceFormAccessibility. It never edits tool files: it reads the rendered
// top-level structure and, when a tool looks like "input → output", wraps the
// leading input run and the trailing output section into a `.tool-io-grid`.
// Tools that already have a custom/multi-panel/scroll layout are skipped.

// Signals that a tool already manages its own layout (or has no IO pair).
// NOTE: dynamic ".tool-stack" containers are NOT listed here on purpose — a
// runtime-filled result stack has no read-only output section at the top level,
// so the heuristic below already skips it naturally. Listing ".tool-stack" by
// name would also kill genuine IO tools (json-yaml) that merely use the class
// for vertical spacing somewhere inside.
const IO_SKIP_SELECTOR = [
  '.grid-2', '.calc-grid', '.diff-output', '.markdown-preview', '.drop-area',
  'canvas.qrcode-canvas', 'pre.code-block', '.img-preview-wrap',
  '.color-picker-wrap', '.json-tree-container', '.permission-grid', '.tab-layout'
].join(',')

// A top-level node counts as an "output" when it holds a read-only textarea /
// result box / result table, OR when it is a `.tool-section` with no editable
// field inside — i.e. a pure display section (char-count stats, radix result),
// whose body is filled at runtime and therefore has no readonly marker yet.
function isOutputNode(node) {
  if (node.nodeType !== 1) return false
  if (node.matches('textarea[readonly], .result-box, .result-table') ||
      node.querySelector('textarea[readonly], .result-box, .result-table')) return true
  if (node.matches('.tool-section') &&
      !node.querySelector('textarea:not([readonly]), input:not([type="checkbox"]):not([readonly]), select')) return true
  return false
}

// A top-level node starts the "input" run only if it IS or holds an EDITABLE
// textarea — the split exists so a large pasted input sits beside its result.
// Lookup/reference tables, generators and calculators have no such textarea
// (their inputs are search boxes / selects / config rows), so requiring a real
// textarea keeps them full-width instead of squeezing a big result into a
// narrow right column. Several crypto tools append a bare <textarea> sibling,
// so we check the node itself as well as its descendants.
function hasEditableTextarea(node) {
  if (node.nodeType !== 1) return false
  return Boolean(node.matches('textarea:not([readonly])') || node.querySelector('textarea:not([readonly])'))
}

export function applyTwoColumnLayout(container) {
  if (!container || container.dataset.ioLayout) return false
  if (container.querySelector(IO_SKIP_SELECTOR)) return false

  const children = [...container.children]
  if (children.length < 2) return false

  // The output is the LAST top-level node that looks like a result.
  let outputIndex = -1
  for (let i = children.length - 1; i >= 0; i--) {
    if (isOutputNode(children[i])) { outputIndex = i; break }
  }
  if (outputIndex < 0) return false

  // The input run starts at the FIRST node before the output that holds an
  // editable textarea.
  let inputIndex = -1
  for (let i = 0; i < outputIndex; i++) {
    if (hasEditableTextarea(children[i])) { inputIndex = i; break }
  }
  if (inputIndex < 0) return false

  // Everything strictly before the input run (e.g. a mode segmented group that
  // should span full width above the split) stays put.
  const head = children.slice(0, inputIndex)
  const inputNodes = children.slice(inputIndex, outputIndex)
  const outputNodes = children.slice(outputIndex)
  if (!inputNodes.length || !outputNodes.length) return false

  // A lone label immediately before the input run belongs inside the input
  // column, not floating above the split (e.g. "输入文本" on the hash tools).
  while (head.length && head[head.length - 1].matches?.('.label')) {
    inputNodes.unshift(head.pop())
  }

  const grid = createElement('div', { className: 'tool-io-grid' })
  const inputCol = createElement('div', { className: 'tool-io-col tool-io-input' })
  const outputCol = createElement('div', { className: 'tool-io-col tool-io-output' })
  inputCol.append(...inputNodes)
  outputCol.append(...outputNodes)

  // Keep the input card tidy: bare option rows / action buttons that sat next
  // to the input section belong inside it, not loose under the card.
  const firstInputSection = inputCol.querySelector(':scope > .tool-section')
  const firstInputBody = firstInputSection?.querySelector(':scope > .tool-section-body')
  if (firstInputBody) {
    for (const child of [...inputCol.children]) {
      if (child !== firstInputSection && !child.classList.contains('tool-section')) {
        firstInputBody.appendChild(child)
      }
    }
  }

  // When both sides hold a textarea, offer a swap control between the columns:
  // it pushes the output back into the input and re-runs the tool. For a
  // two-way tool (a binary encode/decode segmented toggle) it also flips the
  // direction, so "swap" really means "convert the result back".
  const inputTA = inputCol.querySelector('textarea:not([readonly])')
  const outputTA = outputCol.querySelector('textarea[readonly]')
  if (inputTA && outputTA) {
    const swapBtn = createElement('button', {
      className: 'io-swap-btn',
      type: 'button',
      title: '交换输入与输出',
      'aria-label': '交换输入与输出',
      innerHTML: allIcons.swap,
      onClick: () => {
        // Capture the output BEFORE flipping direction — flipping re-runs the
        // tool on the old input and would clobber the output we want to reuse.
        const outValue = outputTA.value
        // Flip a binary direction toggle so the refilled input converts back.
        const seg = container.querySelector('.segmented-group[role="radiogroup"]')
        if (seg) {
          const radios = [...seg.querySelectorAll('[role="radio"]')]
          if (radios.length === 2) {
            radios.find(r => r.getAttribute('aria-checked') !== 'true')?.click()
          }
        }
        inputTA.value = outValue
        inputTA.dispatchEvent(new Event('input', { bubbles: true }))
        inputTA.focus()
      }
    })
    const swapCol = createElement('div', { className: 'tool-io-swap' }, [swapBtn])
    grid.append(inputCol, swapCol, outputCol)
    grid.classList.add('has-swap')
  } else {
    grid.append(inputCol, outputCol)
  }

  // Reassemble: leading full-width nodes, then the split grid.
  container.append(...head, grid)
  container.dataset.ioLayout = 'split'
  return true
}
