const routes = new Map()
let currentRoute = null

export function registerRoute(path, handler) {
  routes.set(path, handler)
}

export function navigate(path) {
  window.location.hash = path
}

export function getCurrentRoute() {
  return currentRoute
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/'
  const path = hash.startsWith('/') ? hash : '/' + hash

  currentRoute = path

  if (routes.has(path)) {
    routes.get(path)()
  } else if (path === '/') {
    // Home - handled by main.js
    if (routes.has('/')) {
      routes.get('/')()
    }
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute)
  handleRoute()
}
