// Tool-only CSS is kept out of the home page bundle; the first tool route loads
// it once and the module promise caches the result.
let stylesPromise = null

export function ensureToolStyles() {
  if (!stylesPromise) stylesPromise = import('../styles/tool.css')
  return stylesPromise
}
