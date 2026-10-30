// Register the offline service worker only in production builds. The manifest
// URL is the stable root marker, so this also works for sub-path deployments.
export function setupServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // A new deployment takes control as soon as it activates (skipWaiting +
  // claim). Reload once so this tab stops using the previous build's hashed
  // chunks, which may already be gone from the server. The first install has no
  // previous controller and must not trigger a reload.
  let hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (reloading) return
    reloading = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    const manifest = document.querySelector('link[rel="manifest"]')
    const base = manifest?.href || window.location.href
    navigator.serviceWorker.register(new URL('sw.js', base), {
      scope: new URL('./', base).pathname,
      // Always revalidate sw.js so a deploy is picked up on the next update check.
      updateViaCache: 'none'
    })
      .catch(error => console.warn('Service worker registration failed', error))
  })
}
