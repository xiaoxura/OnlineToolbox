import '../../styles/tools/clamp.css'
import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

// Fluid type helper. The preferred value is a calc() mixing a rem intercept
// with a vw slope so the clamp still respects the user's root font size.

function formatNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return '0'
  return String(Number(value.toFixed(digits)))
}

function toFiniteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`${label}必须是有效数字`)
  return number
}

export function buildClamp({ minSize, maxSize, minViewport, maxViewport, rootFontSize = 16, lineHeight = 1.5 } = {}) {
  const min = toFiniteNumber(minSize, '最小字号')
  const max = toFiniteNumber(maxSize, '最大字号')
  const minVp = toFiniteNumber(minViewport, '最小视口')
  const maxVp = toFiniteNumber(maxViewport, '最大视口')
  const root = toFiniteNumber(rootFontSize, '根字号')
  const lineHeightValue = toFiniteNumber(lineHeight, '行高倍率')

  if (min <= 0 || max <= 0) throw new Error('字号必须大于 0')
  if (min > max) throw new Error('最小字号不能大于最大字号')
  if (minVp < 0) throw new Error('最小视口不能小于 0')
  if (maxVp <= minVp) throw new Error('最大视口必须大于最小视口')
  if (root <= 0) throw new Error('根字号必须大于 0')
  if (lineHeightValue <= 0) throw new Error('行高倍率必须大于 0')

  const slope = (max - min) / (maxVp - minVp)
  const intercept = min - slope * minVp
  const preferredRem = intercept / root
  const preferredVw = slope * 100
  const sign = preferredVw < 0 ? '-' : '+'
  const preferred = `calc(${formatNumber(preferredRem)}rem ${sign} ${formatNumber(Math.abs(preferredVw))}vw)`

  return {
    min,
    max,
    preferred,
    slope,
    intercept,
    clamp: `clamp(${formatNumber(min)}px, ${preferred}, ${formatNumber(max)}px)`,
    lineHeight: lineHeightValue
  }
}

export default {
  render(container) {
    const minSize = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cg-min-size',
      min: '1',
      step: '1',
      value: '16',
      onInput: update
    })
    const maxSize = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cg-max-size',
      min: '1',
      step: '1',
      value: '24',
      onInput: update
    })
    const minViewport = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cg-min-vp',
      min: '0',
      step: '1',
      value: '320',
      onInput: update
    })
    const maxViewport = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cg-max-vp',
      min: '1',
      step: '1',
      value: '1200',
      onInput: update
    })
    const rootFontSize = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cg-root',
      min: '1',
      step: '1',
      value: '16',
      onInput: update
    })
    const lineHeight = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'cg-line-height',
      min: '0.5',
      step: '0.05',
      value: '1.5',
      onInput: update
    })
    const previewText = createElement('input', {
      className: 'input',
      type: 'text',
      id: 'cg-preview-text',
      value: '中文排版示例：清晰、舒适、随视口自然缩放。',
      onInput: updatePreviewText
    })

    const output = createElement('textarea', {
      className: 'textarea',
      rows: '3',
      readOnly: true,
      'aria-label': 'CSS clamp 输出'
    })
    const copyButton = createCopyButton(() => output.value)
    const error = createElement('div', { className: 'error-text' })
    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const stats = createElement('div', { className: 'stats-row' })
    const ruler = createElement('div', { className: 'clamp-ruler' })

    const previewWrap = createElement('div', { className: 'clamp-preview' })
    const previewLabel = createElement('div', { className: 'form-hint', textContent: '预览（字号按当前 clamp 值缩放）' })
    const preview = createElement('p', { className: 'clamp-preview-text' })
    previewWrap.append(previewLabel, preview)

    const resetButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '恢复默认',
      onClick: () => {
        minSize.value = '16'
        maxSize.value = '24'
        minViewport.value = '320'
        maxViewport.value = '1200'
        rootFontSize.value = '16'
        lineHeight.value = '1.5'
        previewText.value = '中文排版示例：清晰、舒适、随视口自然缩放。'
        update()
      }
    })

    function updatePreviewText() {
      preview.textContent = previewText.value || '中文排版示例'
    }

    function formatSize(value) {
      return `${Number(value).toFixed(1)}px`
    }

    function renderRuler(result) {
      ruler.replaceChildren()
      const start = Number(minViewport.value)
      const end = Number(maxViewport.value)
      const viewports = [0, 1, 2, 3, 4].map(index => Math.round(start + ((end - start) * index) / 4))
      const maxBarSize = Math.max(result.max, 1)
      for (const viewport of viewports) {
        const size = Math.min(result.max, Math.max(result.min, result.intercept + result.slope * viewport))
        const row = createElement('div', { className: 'clamp-ruler-row' }, [
          createElement('span', { className: 'clamp-ruler-viewport', textContent: `${viewport}px` }),
          createElement('span', { className: 'clamp-ruler-track', 'aria-hidden': 'true' }, [
            createElement('span', {
              className: 'clamp-ruler-fill',
              style: { width: `${Math.max(4, (size / maxBarSize) * 100)}%` }
            })
          ]),
          createElement('span', { className: 'clamp-ruler-size', textContent: formatSize(size) })
        ])
        ruler.appendChild(row)
      }
    }

    function update() {
      error.textContent = ''
      try {
        const result = buildClamp({
          minSize: minSize.value,
          maxSize: maxSize.value,
          minViewport: minViewport.value,
          maxViewport: maxViewport.value,
          rootFontSize: rootFontSize.value,
          lineHeight: lineHeight.value
        })
        output.value = `font-size: ${result.clamp};\nline-height: ${result.lineHeight};`
        preview.style.fontSize = result.clamp
        preview.style.lineHeight = String(result.lineHeight)
        updatePreviewText()

        stats.replaceChildren(
          createElement('span', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: '斜率 ' }),
            createElement('span', { className: 'stat-value', textContent: result.slope.toFixed(6) })
          ]),
          createElement('span', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: '截距 ' }),
            createElement('span', { className: 'stat-value', textContent: `${result.intercept.toFixed(3)}px` })
          ]),
          createElement('span', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: 'preferred ' }),
            createElement('span', { className: 'stat-value', textContent: result.preferred })
          ])
        )
        renderRuler(result)
        status.textContent = `在 ${minViewport.value}px 视口为 ${formatSize(result.min)}，在 ${maxViewport.value}px 视口为 ${formatSize(result.max)}。`
      } catch (cause) {
        output.value = ''
        stats.replaceChildren()
        ruler.replaceChildren()
        preview.style.fontSize = ''
        status.textContent = ''
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    update()

    container.append(
      createSection(
        '流体字号参数',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'cg-min-size', textContent: '最小字号（px）' }),
              minSize
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'cg-max-size', textContent: '最大字号（px）' }),
              maxSize
            ])
          ]),
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'cg-min-vp', textContent: '最小视口（px）' }),
              minViewport
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'cg-max-vp', textContent: '最大视口（px）' }),
              maxViewport
            ])
          ]),
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'cg-root', textContent: '根字号（px）' }),
              rootFontSize
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'cg-line-height', textContent: '行高倍率' }),
              lineHeight
            ])
          ]),
          createElement('div', { className: 'btn-group' }, [resetButton]),
          error,
          status
        ])
      ),
      createSection(
        '预览文本',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', for: 'cg-preview-text', textContent: '预览内容' }),
            previewText
          ]),
          previewWrap
        ])
      ),
      createSection('视口刻度尺', ruler),
      createSection('CSS 输出', createElement('div', { className: 'tool-stack' }, [stats, output]), [copyButton])
    )
  }
}
