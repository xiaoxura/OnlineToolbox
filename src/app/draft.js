// Automatic draft persistence for tool inputs.
//
// Tools are deliberately stateless: refreshing the page or jumping to another
// tool used to throw away a long paste. This module snapshots editable fields
// per tool into sessionStorage (so the draft dies with the tab) and restores
// them on the next visit. Secrets and password-like tools opt out: persisting
// them would put credentials at rest in browser storage for no user benefit.
const PREFIX = 'toolbox:draft:'
const DEBOUNCE_MS = 400

// Tools whose input is a secret or a one-shot credential.
const SENSITIVE_TOOLS = new Set([
  'aes', 'des', 'text-encrypt', 'hmac', 'jwt', 'jwt-sign',
  'bcrypt', 'htpasswd-generator', 'totp', 'bip39',
  'key-pair-generator', 'password', 'password-strength',
  'codex-credential-converter'
])

const FIELD_SELECTOR = [
  'textarea:not([readonly]):not([disabled])',
  'input:not([type="file"]):not([type="password"]):not([type="checkbox"]):not([type="radio"]):not([readonly]):not([disabled])',
  'select:not([disabled])'
].join(', ')

function storage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function isDraftable(toolId) {
  return !SENSITIVE_TOOLS.has(toolId)
}

function fieldsOf(container) {
  return [...container.querySelectorAll(FIELD_SELECTOR)]
    .filter(field => field.dataset.draft !== 'off' && !field.closest('[data-draft="off"]'))
}

function snapshot(fields) {
  const values = {}
  fields.forEach((field, index) => {
    const key = field.dataset.draftKey || field.name || field.id || String(index)
    values[key] = field.value
  })
  return values
}

function hasValue(values) {
  return Object.values(values).some(value => value !== '' && value !== undefined && value !== null)
}

function apply(values, fields) {
  let restored = 0
  fields.forEach((field, index) => {
    const key = field.dataset.draftKey || field.name || field.id || String(index)
    if (!Object.hasOwn(values, key)) return
    const value = values[key]
    if (field.value === value) return
    field.value = value ?? ''
    restored += 1
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  })
  return restored
}

/**
 * Wire draft saving/restoring for one rendered tool.
 * Returns a cleanup function (the next render calls it through the router).
 */
export function setupDraftPersistence(container, toolId) {
  if (!container || !toolId || !isDraftable(toolId)) return () => {}
  const store = storage()
  if (!store) return () => {}

  const key = `${PREFIX}${toolId}`
  const fields = fieldsOf(container)
  if (!fields.length) return () => {}

  let restoredNotice = null
  let timer = null
  let disposed = false

  try {
    const saved = JSON.parse(store.getItem(key) || 'null')
    if (saved && saved.toolId === toolId && saved.values) {
      const count = apply(saved.values, fields)
      if (count) {
        restoredNotice = document.createElement('div')
        restoredNotice.className = 'draft-notice'
        restoredNotice.setAttribute('role', 'status')
        const text = document.createElement('span')
        text.textContent = '已恢复上次输入（草稿仅保存在当前标签页）'
        const clear = document.createElement('button')
        clear.type = 'button'
        clear.className = 'draft-clear'
        clear.textContent = '清除草稿'
        clear.addEventListener('click', () => {
          store.removeItem(key)
          fields.forEach(field => {
            field.value = ''
            field.dispatchEvent(new Event('input', { bubbles: true }))
          })
          restoredNotice?.remove()
          restoredNotice = null
        })
        restoredNotice.append(text, clear)
        container.prepend(restoredNotice)
      }
    }
  } catch {
    // A corrupt draft must never block the tool from rendering.
    store.removeItem(key)
  }

  const save = () => {
    if (disposed) return
    const values = snapshot(fields)
    try {
      if (hasValue(values)) {
        store.setItem(key, JSON.stringify({ toolId, values, savedAt: Date.now() }))
      } else {
        store.removeItem(key)
      }
    } catch {
      // Quota exceeded: drafts are a convenience, not a requirement.
    }
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(save, DEBOUNCE_MS)
  }

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') save()
  }
  const onPageHide = () => save()

  container.addEventListener('input', schedule)
  container.addEventListener('change', schedule)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)

  return () => {
    clearTimeout(timer)
    container.removeEventListener('input', schedule)
    container.removeEventListener('change', schedule)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    // Persist the last keystrokes before the container is thrown away.
    save()
    disposed = true
  }
}

/** Remove a saved draft (used by tests and future "reset" affordances). */
export function clearDraft(toolId) {
  storage()?.removeItem(`${PREFIX}${toolId}`)
}
