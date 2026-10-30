// Small localStorage helpers. Storage can throw in private/embedded contexts, so
// every access is guarded and corrupt JSON falls back to an empty list.
export function readStoredList(key, isValid = () => true) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter(isValid) : []
  } catch {
    return []
  }
}

export function storeList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable.
  }
}
