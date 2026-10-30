// Register the offline service worker only in production builds. The manifest
// URL is the stable root marker, so this also works for sub-path deployments.
export function setupServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    const manifest = document.querySelector('link[rel="manifest"]')
    const base = manifest?.href || window.location.href
    navigator.serviceWorker.register(new URL('sw.js', base), { scope: new URL('./', base).pathname })
      .catch(error => console.warn('Service worker registration failed', error))
  })
}
