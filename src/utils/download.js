import { showToast } from './dom.js'

// Trigger a browser download for a Blob and release the object URL afterwards.
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Revoke on the next tick so the download has a chance to start in all browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
  showToast(`已下载 ${filename}`)
}

// Convenience wrapper for text results (the common case for tool output).
export function downloadText(filename, text, mimeType = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type: mimeType }))
}
