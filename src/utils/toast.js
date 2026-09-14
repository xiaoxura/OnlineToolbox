// Lightweight toast notification. Kept dependency-free on purpose so that
// clipboard.js and download.js can use it without importing dom.js (which
// would create a circular dependency).
let toastEl = null
let toastTimer = null

export function showToast(message, duration = 2000) {
  if (!toastEl) {
    toastEl = document.createElement('div')
    toastEl.className = 'toast'
    toastEl.setAttribute('role', 'status')
    toastEl.setAttribute('aria-live', 'polite')
    toastEl.setAttribute('aria-atomic', 'true')
    document.body.appendChild(toastEl)
  }
  clearTimeout(toastTimer)
  toastEl.textContent = message
  toastEl.classList.add('show')
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show')
  }, duration)
}
