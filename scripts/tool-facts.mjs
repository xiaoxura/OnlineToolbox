// Derives a factual description of every tool by *rendering it* in jsdom and
// reading back the UI it actually builds — its section titles, input labels,
// buttons, selects and toggles.
//
// The landing pages are generated from this, so their copy is a description of
// the real implementation rather than a hand-maintained (and inevitably stale)
// duplicate of it. Adding an option to a tool updates its page automatically.
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptsDir, '..')

// Tool modules import CSS; stub those before the registry is loaded.
register('./css-stub.mjs', import.meta.url)

const NETWORK_PATTERN = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket/

function createDomEnvironment() {
  // `pretendToBeVisual` is deliberately off: it starts a requestAnimationFrame
  // loop that keeps the Node event loop alive forever, hanging the build.
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://xiaoxura.github.io/OnlineToolbox/'
  })
  const { window } = dom

  const globals = [
    'window', 'document', 'navigator', 'HTMLElement', 'HTMLCanvasElement', 'HTMLInputElement',
    'HTMLTextAreaElement', 'HTMLSelectElement', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent',
    'MouseEvent', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame',
    'cancelAnimationFrame', 'DOMParser', 'XMLSerializer', 'matchMedia', 'localStorage',
    'AudioContext', 'webkitAudioContext', 'Image', 'Blob', 'File', 'FileReader', 'URL',
    'URLSearchParams', 'ResizeObserver', 'XPathResult', 'XPathEvaluator', 'NodeFilter'
  ]
  for (const key of globals) {
    if (key in window) {
      Object.defineProperty(globalThis, key, { value: window[key], writable: true, configurable: true })
    }
  }
  Object.defineProperty(globalThis, 'self', { value: window, writable: true, configurable: true })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false
    })
  })
  // Canvas is not implemented by jsdom; give tools a no-op 2D context so their
  // render() (which may draw an initial preview) cannot throw.
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'measureText') return () => ({ width: 0 })
        if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) })
        if (prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) })
        if (prop === 'canvas') return null
        return () => {}
      },
      set: () => true
    })
  })
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: () => 'data:image/png;base64,'
  })
  if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:stub'
  if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {}

  const storage = new Map()
  const storageMock = {
    getItem: key => (storage.has(String(key)) ? storage.get(String(key)) : null),
    setItem: (key, value) => storage.set(String(key), String(value)),
    removeItem: key => storage.delete(String(key)),
    clear: () => storage.clear(),
    key: index => [...storage.keys()][index] ?? null,
    get length() { return storage.size }
  }
  Object.defineProperty(window, 'localStorage', { value: storageMock, configurable: true })

  return window
}

function textOf(node) {
  return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''
}

const MAX_LABEL = 48

function clip(value) {
  const text = String(value)
    .split('\n')[0]
    .trim()
    // Field labels are usually written as "分隔符:" in the UI; the colon is
    // punctuation for the form, not part of the name.
    .replace(/[:：]\s*$/, '')
    .trim()
  if (!text) return ''
  return text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text
}

function labelFor(control, fallbackSection) {
  const placeholderLine = clip(control.getAttribute('placeholder') || '')

  const labelledBy = control.getAttribute('aria-labelledby')
  const candidates = [
    control.labels && control.labels.length ? clip(textOf(control.labels[0])) : '',
    clip(control.getAttribute('aria-label') || ''),
    labelledBy ? clip(textOf(control.ownerDocument.getElementById(labelledBy))) : ''
  ]

  // enhanceFormAccessibility back-fills labels from the placeholder when a
  // control has none of its own. That value is an example of what to type, not
  // a name for the field, so it must not win.
  for (const candidate of candidates) {
    if (candidate && candidate !== placeholderLine) return candidate
  }

  const heading = clip(textOf(control.closest('.tool-section')?.querySelector('.tool-section-header h2, h2')))
  if (heading) return heading

  return placeholderLine || fallbackSection || ''
}

// The registry entry is a one-liner `load: () => import("./cat/file.js")`; pull
// the path straight out of the function source so no separate map is needed.
function modulePathOf(descriptor) {
  const source = descriptor.load.toString()
  const match = /import\(\s*["'`](.+?)["'`]\s*\)/.exec(source)
  if (!match) return null
  const relative = match[1].replace(/^\.\//, '')
  return resolve(projectRoot, 'src/tools', relative)
}

function usesNetwork(descriptor) {
  const path = modulePathOf(descriptor)
  if (!path) return false
  try {
    return NETWORK_PATTERN.test(readFileSync(path, 'utf8'))
  } catch {
    return false
  }
}

function extractFacts(container) {
  const sections = [...container.querySelectorAll('.tool-section')]

  const sectionTitles = sections.map(section =>
    textOf(section.querySelector('.tool-section-header h2, h2'))
  ).filter(Boolean)

  const describeSection = section => textOf(section.querySelector('.tool-section-header h2, h2'))

  const editable = [...container.querySelectorAll('textarea:not([readonly])')]
  const textFields = [...container.querySelectorAll(
    'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit])'
  )]
  const inputs = [...editable, ...textFields].map(el => ({
    label: labelFor(el),
    // Kept so callers can tell two identically-titled fields apart, e.g. a
    // "差异对比" tool whose two textareas share one "输入文本" section.
    placeholder: clip(el.getAttribute('placeholder') || ''),
    kind: el.tagName === 'TEXTAREA' ? 'textarea' : (el.getAttribute('type') || 'text')
  })).filter(item => item.label)

  const readonlyTextareas = [...container.querySelectorAll('textarea[readonly]')]
  const fileInputs = [...container.querySelectorAll('input[type=file]')]

  // Covers the shared result primitives plus the bespoke containers tools use
  // when they render something richer than a textarea (diff panes, trees, grids).
  const RESULT_SELECTOR = [
    'textarea[readonly]', '.result-box', '.result-table', '.visual-preview',
    '.inline-result', '.stats-row', '.stat-item', 'canvas', '.jwt-status',
    '.diff-output', '.markdown-preview', '.json-tree-container', '.calc-grid',
    '.permission-grid', '.xpath-preview', '.credential-converter', 'pre'
  ].join(', ')
  const resultSections = sections
    .filter(section => section.querySelector(RESULT_SELECTOR))
    .map(describeSection)
    .filter(Boolean)

  const modes = []
  for (const group of container.querySelectorAll('[role="radiogroup"]')) {
    const labels = [...group.querySelectorAll('.segmented-btn, label')].map(textOf).filter(Boolean)
    if (labels.length) modes.push([...new Set(labels)])
  }

  const toggles = []
  for (const choice of container.querySelectorAll('input[type=checkbox]')) {
    const label = choice.closest('label')
    const text = textOf(label)
    if (text) toggles.push(text)
  }

  const selects = [...container.querySelectorAll('select')].map(select => ({
    label: labelFor(select),
    values: [...select.options].map(option => textOf(option)).filter(Boolean)
  })).filter(item => item.label && item.values.length)

  const actions = [...container.querySelectorAll('button')]
    .filter(button => !button.classList.contains('btn-icon'))
    .map(textOf)
    .filter(text => text && text !== '示例数据')

  return {
    sections: [...new Set(sectionTitles)],
    inputs,
    resultSections: [...new Set(resultSections)],
    hasEditableText: editable.length > 0,
    hasOutput: readonlyTextareas.length > 0,
    hasFileInput: fileInputs.length > 0,
    modes: modes.filter(group => group.length > 1),
    toggles: [...new Set(toggles)],
    selects,
    actions: [...new Set(actions)]
  }
}

export async function collectToolFacts(descriptors) {
  const window = createDomEnvironment()
  const { document } = window

  // The app runs this after every render (src/main.js), and it is what wires
  // sibling `<label>` elements to their controls. Running it here means the
  // extracted labels match the DOM a user actually gets.
  const { enhanceFormAccessibility } = await import('../src/utils/dom.js')

  const facts = new Map()
  for (const descriptor of descriptors) {
    const container = document.createElement('main')
    document.body.replaceChildren(container)
    try {
      const { default: implementation } = await descriptor.load()
      implementation.render(container)
      enhanceFormAccessibility(container)
      facts.set(descriptor.id, extractFacts(container))
    } catch (error) {
      // A tool that cannot render has no derivable copy; fall back to metadata
      // only and report it so the build surfaces the problem.
      console.warn(`[tool-facts] ${descriptor.id} failed to render: ${error.message}`)
      facts.set(descriptor.id, null)
    }
  }

  // Tools may start timers during render (e.g. the TOTP countdown). Tear the
  // window down so none of them keep the process alive.
  document.body.replaceChildren()
  window.close()

  return facts
}

export function detectNetworkUsage(descriptor) {
  return usesNetwork(descriptor)
}
