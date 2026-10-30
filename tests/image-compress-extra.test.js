import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountTool, clickPrimary, flush } from './helpers/tool-harness.js'

const originalWorker = globalThis.Worker

class FakeWorker {
  constructor() {
    FakeWorker.last = this
    this.listeners = new Map()
    this.terminated = false
  }
  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }
  postMessage(message) {
    this.message = message
  }
  terminate() {
    this.terminated = true
  }
  emit(type, event) {
    this.listeners.get(type)?.(event)
  }
}

function bigFile() {
  return { name: 'big.png', size: 3 * 1024 * 1024, type: 'image/png' }
}

function attach(input, file) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  globalThis.Worker = originalWorker
  document.body.replaceChildren()
})

describe('image-compress worker integration', () => {
  it('uses the worker result for a large file', async () => {
    globalThis.Worker = FakeWorker
    const container = await mountTool('image-compress')
    attach(container.querySelector('input[type="file"]'), bigFile())
    clickPrimary(container)
    const worker = FakeWorker.last
    worker.emit('message', {
      data: {
        id: worker.message.id,
        type: 'done',
        buffer: new ArrayBuffer(120),
        blobType: 'image/webp',
        size: 120,
        sourceWidth: 3000,
        sourceHeight: 2000,
        outputWidth: 1500,
        outputHeight: 1000
      }
    })
    await flush(20)
    expect(container.querySelector('.loading-text').textContent).toContain('3000×2000')
    expect(container.querySelector('button.btn-success').disabled).toBe(false)
    expect(worker.terminated).toBe(true)
  })

  it('falls back to the main thread when the worker fails', async () => {
    globalThis.Worker = FakeWorker
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })))
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      writable: true,
      value: vi.fn((callback, type) => callback(new Blob(['x'], { type })))
    })
    const container = await mountTool('image-compress')
    attach(container.querySelector('input[type="file"]'), bigFile())
    clickPrimary(container)
    FakeWorker.last.emit('message', { data: { id: FakeWorker.last.message.id, type: 'error', message: 'no offscreen' } })
    await flush(40)
    expect(container.querySelector('.loading-text').textContent).toContain('800×600')
  })
})
