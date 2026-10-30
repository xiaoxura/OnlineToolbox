import { afterEach, describe, expect, it, vi } from 'vitest'
import timestampTool from '../src/tools/converter/timestamp.js'
import calculatorTool from '../src/tools/math/calculator.js'
import { createToolLifecycle } from '../src/app/lifecycle.js'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('tool lifecycle contract', () => {
  it('lets timestamp dispose its one-second interval', () => {
    vi.useFakeTimers()
    const container = document.createElement('main')
    document.body.appendChild(container)

    const dispose = timestampTool.render(container)

    expect(typeof dispose).toBe('function')
    expect(vi.getTimerCount()).toBe(1)
    dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('disposes a tool through the shared lifecycle helper', () => {
    const lifecycle = createToolLifecycle()
    const dispose = vi.fn()
    lifecycle.set(dispose)
    lifecycle.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    lifecycle.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('accepts an object with dispose() and swallows cleanup errors', () => {
    const lifecycle = createToolLifecycle()
    const dispose = vi.fn()
    lifecycle.set({ dispose })
    lifecycle.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)

    const failing = createToolLifecycle()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    failing.set(() => { throw new Error('boom') })
    expect(() => failing.dispose()).not.toThrow()
  })

  it('lets calculator remove its document-level keyboard listener', () => {
    const container = document.createElement('main')
    document.body.appendChild(container)
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const dispose = calculatorTool.render(container)
    expect(typeof dispose).toBe('function')
    dispose()

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
