// bcrypt is intentionally slow; run it here so a high cost setting cannot
// freeze the page. The UI falls back to the synchronous helper when Workers
// are unavailable (jsdom, older browsers).
import bcrypt from 'bcryptjs'

self.onmessage = async event => {
  const { id, type, password, cost, salt, hash } = event.data || {}
  try {
    if (type === 'hash') {
      const result = salt
        ? await bcrypt.hash(String(password ?? ''), salt)
        : await bcrypt.hash(String(password ?? ''), await bcrypt.genSalt(Number(cost) || 10))
      self.postMessage({ id, type: 'done', result })
      return
    }
    if (type === 'verify') {
      const matched = await bcrypt.compare(String(password ?? ''), String(hash ?? ''))
      self.postMessage({ id, type: 'done', result: matched })
      return
    }
    throw new Error('未知的 bcrypt 任务')
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
