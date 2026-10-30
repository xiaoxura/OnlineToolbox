// Owns the optional cleanup function returned by a tool's render(). Keeping it
// in one place makes route changes and re-renders tear down timers, listeners
// and in-flight requests consistently.
export function createToolLifecycle() {
  let cleanup = null

  function dispose() {
    const current = cleanup
    cleanup = null
    if (typeof current !== 'function') return
    try {
      current()
    } catch (error) {
      console.error('Failed to clean up tool', error)
    }
  }

  function set(value) {
    if (typeof value === 'function') cleanup = value
    else if (typeof value?.dispose === 'function') cleanup = () => value.dispose()
    else cleanup = null
  }

  return { set, dispose }
}
