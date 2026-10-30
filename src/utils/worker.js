// Run a self-contained, CPU-heavy function in a throwaway Web Worker so a big
// input cannot freeze the page.
//
// The task is serialised with `Function.prototype.toString`, so it must not
// reference anything from its enclosing module scope (imports, constants or
// helpers). Keep it a plain function with nested helpers only. When Worker or
// Blob is unavailable (jsdom, very old browsers) it runs inline instead, which
// keeps the caller's code path identical.

export function supportsWorker() {
  return typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined'
}

export function runInWorker(task, arg, { transfer = [], timeout = 120000 } = {}) {
  if (!supportsWorker()) return Promise.resolve().then(() => task(arg))

  return new Promise((resolve, reject) => {
    const source = `self.onmessage = async event => {
      try {
        const task = (${task.toString()})
        const result = await task(event.data)
        self.postMessage({ type: 'done', result })
      } catch (error) {
        self.postMessage({ type: 'error', message: error && error.message ? error.message : String(error) })
      }
    }`
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    const worker = new Worker(url)
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(url)
      callback(value)
    }
    const timer = setTimeout(() => finish(reject, new Error('后台计算超时，请缩小输入后重试')), timeout)
    worker.addEventListener('message', event => {
      const message = event.data || {}
      if (message.type === 'done') finish(resolve, message.result)
      else if (message.type === 'error') finish(reject, new Error(message.message || '后台计算失败'))
    })
    worker.addEventListener('error', () => finish(reject, new Error('后台计算失败')))
    worker.postMessage(arg, transfer)
  })
}
