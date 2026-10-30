// Search/category/view live in the query string so filtered views survive a
// refresh and can be shared. The hash still owns the route.
export function readUrlState({ categories, defaults }) {
  const state = { ...defaults }
  let params
  try {
    params = new URLSearchParams(window.location.search)
  } catch {
    return state
  }
  const query = params.get('q')
  if (query) state.searchQuery = query.trim()
  const category = params.get('category')
  if (category && categories.some(item => item.id === category)) state.currentCategory = category
  const view = params.get('view')
  if (view === 'favorites' || view === 'recent' || view === 'all') state.currentView = view
  return state
}

export function syncUrlState({ searchQuery, currentCategory, currentView }) {
  const params = new URLSearchParams(window.location.search)
  if (searchQuery) params.set('q', searchQuery)
  else params.delete('q')
  if (currentCategory !== 'all') params.set('category', currentCategory)
  else params.delete('category')
  if (currentView !== 'all') params.set('view', currentView)
  else params.delete('view')
  const query = params.toString()
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== current) window.history.replaceState(null, '', next)
}
