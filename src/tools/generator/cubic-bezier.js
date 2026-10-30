import '../../styles/tools/bezier.css'
import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

// CSS cubic-bezier editor. Evaluation uses the standard Newton-Raphson solver
// with a bisection fallback, matching the algorithm used by browser engines.

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function toNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatNumber(value) {
  return String(Number(Number(value).toFixed(4)))
}

function bezierCoordinate(t, first, second) {
  const inverse = 1 - t
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t
}

function bezierDerivative(t, first, second) {
  const inverse = 1 - t
  return 3 * inverse * inverse * first + 6 * inverse * t * (second - first) + 3 * t * t * (1 - second)
}

export function cubicBezier(x1, y1, x2, y2) {
  const p1x = clamp(toNumber(x1, 0), 0, 1)
  const p2x = clamp(toNumber(x2, 1), 0, 1)
  const p1y = toNumber(y1, 0)
  const p2y = toNumber(y2, 1)

  function solveT(x) {
    let t = x
    for (let iteration = 0; iteration < 8; iteration++) {
      const difference = bezierCoordinate(t, p1x, p2x) - x
      if (Math.abs(difference) < 1e-6) return t
      const derivative = bezierDerivative(t, p1x, p2x)
      if (Math.abs(derivative) < 1e-6) break
      t -= difference / derivative
      if (t < 0 || t > 1) break
    }

    let low = 0
    let high = 1
    t = x
    for (let iteration = 0; iteration < 30; iteration++) {
      const current = bezierCoordinate(t, p1x, p2x)
      if (Math.abs(current - x) < 1e-6) return t
      if (current < x) low = t
      else high = t
      t = (low + high) / 2
    }
    return t
  }

  function at(progress) {
    const t = clamp(toNumber(progress, 0), 0, 1)
    if (t === 0) return 0
    if (t === 1) return 1
    return bezierCoordinate(solveT(t), p1y, p2y)
  }

  return { at, css: `cubic-bezier(${formatNumber(p1x)}, ${formatNumber(p1y)}, ${formatNumber(p2x)}, ${formatNumber(p2y)})` }
}

export function bezierPath(x1, y1, x2, y2, size = 100) {
  const dimension = Math.max(1, toNumber(size, 100))
  const p1x = clamp(toNumber(x1, 0), 0, 1) * dimension
  const p1y = dimension - toNumber(y1, 0) * dimension
  const p2x = clamp(toNumber(x2, 1), 0, 1) * dimension
  const p2y = dimension - toNumber(y2, 1) * dimension
  const round = value => Number(value.toFixed(3))
  return `M 0 ${round(dimension)} C ${round(p1x)} ${round(p1y)}, ${round(p2x)} ${round(p2y)}, ${round(dimension)} 0`
}

export function sampleBezier(x1, y1, x2, y2, steps = 10) {
  const p1x = clamp(toNumber(x1, 0), 0, 1)
  const p2x = clamp(toNumber(x2, 1), 0, 1)
  const p1y = toNumber(y1, 0)
  const p2y = toNumber(y2, 1)
  const total = Math.max(1, Math.round(toNumber(steps, 10)))
  const samples = []
  for (let index = 0; index <= total; index++) {
    const t = index / total
    samples.push({
      x: bezierCoordinate(t, p1x, p2x),
      y: bezierCoordinate(t, p1y, p2y)
    })
  }
  return samples
}

const PRESETS = [
  { label: 'ease', values: [0.25, 0.1, 0.25, 1] },
  { label: 'ease-in', values: [0.42, 0, 1, 1] },
  { label: 'ease-out', values: [0, 0, 0.58, 1] },
  { label: 'ease-in-out', values: [0.42, 0, 0.58, 1] },
  { label: '回弹', values: [0.34, 1.56, 0.64, 1] },
  { label: '快出慢入', values: [0.16, 1, 0.3, 1] }
]

export default {
  render(container) {
    const x1Input = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cb-x1',
      min: '0',
      max: '1',
      step: '0.01',
      value: '0.25',
      onInput: update
    })
    const y1Input = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cb-y1',
      min: '-2',
      max: '3',
      step: '0.01',
      value: '0.1',
      onInput: update
    })
    const x2Input = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cb-x2',
      min: '0',
      max: '1',
      step: '0.01',
      value: '0.25',
      onInput: update
    })
    const y2Input = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cb-y2',
      min: '-2',
      max: '3',
      step: '0.01',
      value: '1',
      onInput: update
    })
    const inputs = [x1Input, y1Input, x2Input, y2Input]

    const numberRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'cb-x1', textContent: 'P1 X（0-1）' }),
        x1Input
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'cb-y1', textContent: 'P1 Y（可回弹）' }),
        y1Input
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'cb-x2', textContent: 'P2 X（0-1）' }),
        x2Input
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'cb-y2', textContent: 'P2 Y（可回弹）' }),
        y2Input
      ])
    ])

    const graph = createElement('svg', {
      attrs: {
        class: 'bezier-graph',
        viewBox: '0 0 100 100',
        role: 'img',
        'aria-label': '贝塞尔曲线控制点图，可拖拽 P1 和 P2'
      }
    })
    const grid = createElement('g', { attrs: { class: 'bezier-grid', 'aria-hidden': 'true' } })
    for (const position of [0, 25, 50, 75, 100]) {
      grid.append(
        createElement('line', { x1: '0', y1: String(position), x2: '100', y2: String(position) }),
        createElement('line', { x1: String(position), y1: '0', x2: String(position), y2: '100' })
      )
    }
    const guideOne = createElement('line', { attrs: { class: 'bezier-guide' } })
    const guideTwo = createElement('line', { attrs: { class: 'bezier-guide' } })
    const curve = createElement('path', { attrs: { class: 'bezier-curve' } })
    const handleOne = createElement('circle', {
      attrs: {
        class: 'bezier-handle',
        r: '4',
        tabindex: '0',
        role: 'slider',
        'aria-label': '控制点 P1',
        'aria-valuemin': '0',
        'aria-valuemax': '1'
      }
    })
    const handleTwo = createElement('circle', {
      attrs: {
        class: 'bezier-handle',
        r: '4',
        tabindex: '0',
        role: 'slider',
        'aria-label': '控制点 P2',
        'aria-valuemin': '0',
        'aria-valuemax': '1'
      }
    })
    graph.append(grid, guideOne, guideTwo, curve, handleOne, handleTwo)

    const track = createElement('div', { className: 'bezier-track' }, [
      createElement('span', { className: 'bezier-ball', 'aria-hidden': 'true' })
    ])
    const ball = track.firstElementChild
    const playButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '播放预览',
      onClick: () => (playing ? stopPlayback() : startPlayback())
    })
    const replayButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '重播',
      onClick: () => startPlayback()
    })
    const previewHint = createElement('div', {
      className: 'form-hint',
      textContent: '小球按当前缓动函数移动；回弹曲线会让小球短暂越过终点。'
    })

    const cssOutput = createElement('textarea', {
      className: 'textarea',
      rows: '3',
      readOnly: true,
      'aria-label': 'CSS 缓动函数'
    })
    const copyButton = createCopyButton(() => cssOutput.value)

    const presetRow = createElement('div', { className: 'bezier-presets' })
    for (const preset of PRESETS) {
      presetRow.appendChild(
        createElement('button', {
          className: 'btn btn-secondary btn-sm',
          type: 'button',
          textContent: preset.label,
          onClick: () => {
            preset.values.forEach((value, index) => {
              inputs[index].value = String(value)
            })
            update()
          }
        })
      )
    }

    let playing = false
    let frameId = 0
    let animationStart = 0
    const requestFrame = callback =>
      globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(callback) : setTimeout(() => callback(performance.now()), 16)
    const cancelFrame = id => (globalThis.cancelAnimationFrame ? globalThis.cancelAnimationFrame(id) : clearTimeout(id))

    function currentCurve() {
      return cubicBezier(x1Input.value, y1Input.value, x2Input.value, y2Input.value)
    }

    function update() {
      for (const input of [x1Input, x2Input]) {
        const value = clamp(toNumber(input.value, 0), 0, 1)
        if (String(value) !== input.value) input.value = String(value)
      }
      const curveValue = currentCurve()
      const css = curveValue.css
      const x1 = clamp(toNumber(x1Input.value, 0), 0, 1)
      const y1 = toNumber(y1Input.value, 0)
      const x2 = clamp(toNumber(x2Input.value, 0), 0, 1)
      const y2 = toNumber(y2Input.value, 1)
      curve.setAttribute('d', bezierPath(x1, y1, x2, y2, 100))
      const firstX = x1 * 100
      const firstY = 100 - y1 * 100
      const secondX = x2 * 100
      const secondY = 100 - y2 * 100
      guideOne.setAttribute('x1', '0')
      guideOne.setAttribute('y1', '100')
      guideOne.setAttribute('x2', String(firstX))
      guideOne.setAttribute('y2', String(firstY))
      guideTwo.setAttribute('x1', '100')
      guideTwo.setAttribute('y1', '0')
      guideTwo.setAttribute('x2', String(secondX))
      guideTwo.setAttribute('y2', String(secondY))
      handleOne.setAttribute('cx', String(firstX))
      handleOne.setAttribute('cy', String(firstY))
      handleOne.setAttribute('aria-valuenow', String(x1))
      handleTwo.setAttribute('cx', String(secondX))
      handleTwo.setAttribute('cy', String(secondY))
      handleTwo.setAttribute('aria-valuenow', String(x2))
      cssOutput.value = css
    }

    function stopPlayback() {
      playing = false
      cancelFrame(frameId)
      playButton.textContent = '播放预览'
    }

    function startPlayback() {
      cancelFrame(frameId)
      animationStart = 0
      playing = true
      ball.style.left = '0%'
      playButton.textContent = '停止'
      const duration = 1200
      const frame = timestamp => {
        if (!playing) return
        if (!animationStart) animationStart = timestamp
        const progress = Math.min(1, (timestamp - animationStart) / duration)
        const eased = currentCurve().at(progress)
        ball.style.left = `${eased * 100}%`
        if (progress < 1) frameId = requestFrame(frame)
        else {
          playing = false
          playButton.textContent = '重播'
        }
      }
      frameId = requestFrame(frame)
    }

    let activeHandle = null

    function moveHandle(handleIndex, event) {
      const rect = graph.getBoundingClientRect()
      const width = rect.width || 100
      const height = rect.height || 100
      const x = clamp((event.clientX - rect.left) / width, 0, 1)
      const y = clamp(1 - (event.clientY - rect.top) / height, 0, 1)
      if (handleIndex === 0) {
        x1Input.value = x.toFixed(2)
        y1Input.value = y.toFixed(2)
      } else {
        x2Input.value = x.toFixed(2)
        y2Input.value = y.toFixed(2)
      }
      update()
    }

    for (const [index, handle] of [handleOne, handleTwo].entries()) {
      handle.addEventListener('pointerdown', event => {
        activeHandle = index
        event.preventDefault?.()
        handle.setPointerCapture?.(event.pointerId)
      })
      handle.addEventListener('keydown', event => {
        const deltas = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, 0.01], ArrowDown: [0, -0.01] }
        if (!deltas[event.key]) return
        event.preventDefault()
        const [deltaX, deltaY] = deltas[event.key]
        const xInput = index === 0 ? x1Input : x2Input
        const yInput = index === 0 ? y1Input : y2Input
        xInput.value = String(clamp(toNumber(xInput.value, 0) + deltaX, 0, 1))
        yInput.value = String(toNumber(yInput.value, 0) + deltaY)
        update()
      })
    }

    graph.addEventListener('pointermove', event => {
      if (activeHandle === null) return
      moveHandle(activeHandle, event)
    })
    graph.addEventListener('pointerup', () => {
      activeHandle = null
    })
    graph.addEventListener('pointercancel', () => {
      activeHandle = null
    })

    update()

    container.append(
      createSection(
        '曲线控制',
        createElement('div', { className: 'tool-stack' }, [
          numberRow,
          createElement('div', { className: 'bezier-presets-wrap' }, [
            createElement('span', { className: 'sub-label', textContent: '预设' }),
            presetRow
          ]),
          createElement('div', { className: 'bezier-graph-wrap' }, [graph])
        ])
      ),
      createSection(
        '动画预览',
        createElement('div', { className: 'tool-stack' }, [
          track,
          createElement('div', { className: 'btn-group' }, [playButton, replayButton]),
          previewHint
        ])
      ),
      createSection('CSS 输出', createElement('div', { className: 'tool-stack' }, [cssOutput]), [copyButton])
    )
  }
}
