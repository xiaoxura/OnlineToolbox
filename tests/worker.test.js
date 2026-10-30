import { afterEach, describe, expect, it, vi } from 'vitest'
import { runInWorker, supportsWorker } from '../src/utils/worker.js'

class FakeWorker {
  constructor(url) {
    this.url = url
    this.listeners = new Map()
    this.terminated = false
    this.messages = []
    FakeWorker.instances.push(this)
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type).push(listener)
  }

  postMessage(message) {
    this.messages.push(message)
  }

  terminate() {
    this.terminated = true
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) || []) listener(event)
  }
}
FakeWorker.instances = []

const originalWorker = globalThis.Worker
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL

function installFakeWorker() {
  FakeWorker.instances = []
  globalThis.Worker = FakeWorker
  URL.createObjectURL = vi.fn(() => 'blob:worker')
  URL.revokeObjectURL = vi.fn()
}

afterEach(() => {
  globalThis.Worker = originalWorker
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

describe('runInWorker', () => {
  it('runs inline when Worker is unavailable', async () => {
    const original = globalThis.Worker
    try {
      delete globalThis.Worker
      expect(supportsWorker()).toBe(false)
      await expect(runInWorker(value => value * 2, 21)).resolves.toBe(42)
    } finally {
      globalThis.Worker = original
    }
  })

  it('posts the job to a worker and resolves its result', async () => {
    installFakeWorker()
    expect(supportsWorker()).toBe(true)
    const promise = runInWorker(value => value + 1, 41)
    expect(FakeWorker.instances).toHaveLength(1)
    const worker = FakeWorker.instances[0]
    expect(worker.messages[0]).toBe(41)
    worker.emit('message', { data: { type: 'done', result: 42 } })
    await expect(promise).resolves.toBe(42)
    expect(worker.terminated).toBe(true)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worker')
  })

  it('rejects when the worker reports an error or crashes', async () => {
    installFakeWorker()
    const failed = runInWorker(() => 1, null)
    FakeWorker.instances[0].emit('message', { data: { type: 'error', message: 'boom' } })
    await expect(failed).rejects.toThrow('boom')

    const crashed = runInWorker(() => 1, null)
    FakeWorker.instances[1].emit('error', new Error('worker crash'))
    await expect(crashed).rejects.toThrow('后台计算失败')
  })
})
