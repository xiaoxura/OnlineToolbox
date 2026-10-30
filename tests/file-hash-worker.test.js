import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountTool, flush } from './helpers/tool-harness.js'

const originalWorker = globalThis.Worker

class FakeWorker {
  constructor() {
    FakeWorker.last = this
    this.listeners = new Map()
  }
  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }
  terminate() {}
  postMessage(message) {
    this.message = message
  }
  emit(type, event) {
    this.listeners.get(type)?.(event)
  }
}

afterEach(() => {
  globalThis.Worker = originalWorker
  document.body.replaceChildren()
})

describe('file-hash worker path', () => {
  it('shows progress and the digest for a large file', async () => {
    globalThis.Worker = FakeWorker
    const container = await mountTool('file-hash')
    const input = container.querySelector('input[type="file"]')
    const big = {
      name: 'big.bin',
      size: 9 * 1024 * 1024,
      slice: vi.fn()
    }
    Object.defineProperty(input, 'files', { value: [big], configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    const worker = FakeWorker.last
    expect(worker.message.file).toBe(big)
    expect(worker.message.algorithm).toBe('MD5')
    worker.emit('message', { data: { id: worker.message.id, type: 'progress', loaded: 1024, total: big.size } })
    expect(container.querySelector('.file-progress').value).toBeGreaterThan(0)
    worker.emit('message', { data: { id: worker.message.id, type: 'done', digest: 'abc123' } })
    await flush(10)
    expect(container.querySelector('textarea[readonly]').value).toBe('abc123')
    expect(container.querySelector('[role="status"]').textContent).toContain('计算完成')
  })

  it('reports a worker failure', async () => {
    globalThis.Worker = FakeWorker
    const container = await mountTool('file-hash')
    const input = container.querySelector('input[type="file"]')
    const big = { name: 'big.bin', size: 9 * 1024 * 1024, slice: vi.fn() }
    Object.defineProperty(input, 'files', { value: [big], configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    const worker = FakeWorker.last
    worker.emit('message', { data: { id: worker.message.id, type: 'error', message: 'boom' } })
    await flush(10)
    expect(container.querySelector('[role="status"]').textContent).toContain('计算失败')
  })
})
