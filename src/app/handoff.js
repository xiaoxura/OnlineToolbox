// "Send to…" handoff: a result is written to sessionStorage together with the
// target tool id, then the router opens that tool and consumes the payload into
// its first text field. sessionStorage keeps the data in the tab, so nothing is
// ever sent over the network.
const KEY = 'toolbox:handoff'
const MAX_AGE = 10 * 60 * 1000

function store() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function sendToTool(targetId, text, fromId = '') {
  const storage = store()
  if (!storage || !targetId || typeof text !== 'string') return false
  try {
    storage.setItem(KEY, JSON.stringify({ targetId, fromId, text, at: Date.now() }))
    return true
  } catch {
    return false
  }
}

export function clearHandoff() {
  store()?.removeItem(KEY)
}

/** Read (without consuming) a payload addressed to `toolId`. */
export function takeHandoff(toolId) {
  const storage = store()
  if (!storage) return null
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null')
    if (!value || typeof value.text !== 'string') return null
    if (Date.now() - Number(value.at) > MAX_AGE) {
      storage.removeItem(KEY)
      return null
    }
    if (value.targetId !== toolId) return null
    storage.removeItem(KEY)
    return { text: value.text, fromId: value.fromId || '' }
  } catch {
    storage.removeItem(KEY)
    return null
  }
}

/**
 * Put the handoff text into the tool's first editable text field and fire the
 * events tools listen to, so the result recalculates immediately.
 * Returns false when the target tool has no text input (e.g. an image tool).
 */
export function fillHandoff(container, handoff) {
  if (!container || !handoff) return false
  const field = container.querySelector('textarea:not([readonly]):not([disabled])')
    || container.querySelector('input[type="text"]:not([readonly]):not([disabled]), input[type="search"]:not([readonly]):not([disabled])')
  if (!field) return false
  field.value = handoff.text
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
  field.focus?.()
  return true
}
