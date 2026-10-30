const routes = new Map()

export function registerRoute(path, handler) {
  routes.set(path, handler)
}

export function navigate(path) {
  window.location.hash = path
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/'
  const path = hash.startsWith('/') ? hash : '/' + hash

  if (routes.has(path)) {
    routes.get(path)()
  } else {
    // Unknown hashes fall back to a rendered home page instead of a blank screen.
    routes.get('/')?.()
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`)
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute)
  handleRoute()
}
