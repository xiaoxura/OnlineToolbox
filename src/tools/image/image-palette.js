import '../../styles/tools/image-palette.css'
import { createElement, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

// Median-cut palette extraction. Pixels are grouped into 5-bit RGB buckets
// first so large photos stay fast, then the buckets are split along their widest
// colour channel until the requested number of colours is reached.

const BIN_SHIFT = 3

function toPixelData(imageData) {
  if (!imageData) throw new Error('图片数据无效')
  const data = imageData.data || imageData
  if (ArrayBuffer.isView(data)) return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  if (Array.isArray(data)) return Uint8ClampedArray.from(data)
  throw new Error('图片数据无效')
}

function parseHexColor(hex) {
  let value = String(hex ?? '')
    .trim()
    .replace(/^#/, '')
  if (value.length === 3)
    value = value
      .split('')
      .map(char => char + char)
      .join('')
  if (!/^[\da-f]{6}$/i.test(value)) throw new Error('请输入 3 位或 6 位十六进制颜色')
  return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16))
}

export function rgbToHex(r, g, b) {
  const channel = value => {
    const number = Number(value)
    const safe = Number.isFinite(number) ? Math.max(0, Math.min(255, Math.round(number))) : 0
    return safe.toString(16).padStart(2, '0')
  }
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function relativeLuminance(hex) {
  const channels = parseHexColor(hex).map(value => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function channelRange(bucket, channel) {
  const entries = bucket.entries
  let min = 255
  let max = 0
  for (const entry of entries) {
    if (entry[channel] < min) min = entry[channel]
    if (entry[channel] > max) max = entry[channel]
  }
  return { min, max, range: max - min }
}

function createBucket(entries) {
  const bucket = { entries, count: 0, sumR: 0, sumG: 0, sumB: 0 }
  for (const entry of entries) {
    bucket.count += entry.count
    bucket.sumR += entry.r * entry.count
    bucket.sumG += entry.g * entry.count
    bucket.sumB += entry.b * entry.count
  }
  return bucket
}

function splitBucket(bucket) {
  const channels = ['r', 'g', 'b']
  let widest = null
  for (const channel of channels) {
    const range = channelRange(bucket, channel)
    if (!widest || range.range > widest.range) widest = { channel, range: range.range }
  }
  if (!widest || widest.range === 0 || bucket.entries.length < 2) return null

  const sorted = [...bucket.entries].sort((first, second) => first[widest.channel] - second[widest.channel])
  const half = bucket.count / 2
  let cumulative = 0
  let splitIndex = -1
  for (let index = 0; index < sorted.length - 1; index++) {
    cumulative += sorted[index].count
    if (cumulative >= half) {
      splitIndex = index + 1
      break
    }
  }
  if (splitIndex <= 0 || splitIndex >= sorted.length) splitIndex = Math.ceil(sorted.length / 2)
  return [createBucket(sorted.slice(0, splitIndex)), createBucket(sorted.slice(splitIndex))]
}

export function extractPalette(imageData, count = 6) {
  const data = toPixelData(imageData)
  const requested = Math.max(1, Math.min(32, Math.round(Number(count) || 6)))
  const histogram = new Map()
  let total = 0

  for (let index = 0; index + 3 < data.length; index += 4) {
    if (data[index + 3] < 125) continue
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const key = ((red >> BIN_SHIFT) << (BIN_SHIFT * 2)) | ((green >> BIN_SHIFT) << BIN_SHIFT) | (blue >> BIN_SHIFT)
    let entry = histogram.get(key)
    if (!entry) {
      entry = { count: 0, sumR: 0, sumG: 0, sumB: 0 }
      histogram.set(key, entry)
    }
    entry.count += 1
    entry.sumR += red
    entry.sumG += green
    entry.sumB += blue
    total += 1
  }

  if (!total) return []

  const entries = [...histogram.values()].map(entry => ({
    count: entry.count,
    r: entry.sumR / entry.count,
    g: entry.sumG / entry.count,
    b: entry.sumB / entry.count
  }))
  let buckets = [createBucket(entries)]

  while (buckets.length < requested) {
    let candidateIndex = -1
    let candidateScore = 0
    buckets.forEach((bucket, index) => {
      if (bucket.entries.length < 2) return
      const widest = Math.max(channelRange(bucket, 'r').range, channelRange(bucket, 'g').range, channelRange(bucket, 'b').range)
      const score = widest * Math.log2(bucket.count + 1)
      if (score > candidateScore) {
        candidateScore = score
        candidateIndex = index
      }
    })
    if (candidateIndex < 0) break
    const split = splitBucket(buckets[candidateIndex])
    if (!split) break
    buckets = [...buckets.slice(0, candidateIndex), ...split, ...buckets.slice(candidateIndex + 1)]
  }

  return buckets
    .map(bucket => {
      const red = Math.round(bucket.sumR / bucket.count)
      const green = Math.round(bucket.sumG / bucket.count)
      const blue = Math.round(bucket.sumB / bucket.count)
      return { r: red, g: green, b: blue, hex: rgbToHex(red, green, blue), ratio: bucket.count / total }
    })
    .sort((first, second) => second.ratio - first.ratio || first.hex.localeCompare(second.hex))
}

export default {
  render(container) {
    let lastImageData = null
    let previewUrl = ''

    const fileInput = createElement('input', {
      className: 'input',
      type: 'file',
      accept: 'image/*',
      id: 'ip-file',
      onChange: () => processFile()
    })

    const preview = createElement('img', {
      className: 'img-preview hidden',
      alt: '用于提取主色调的图片预览'
    })
    const previewWrap = createElement('div', { className: 'img-preview-wrap' }, [preview])

    const countSelect = createElement(
      'select',
      {
        className: 'select',
        id: 'ip-count',
        onChange: () => {
          if (!lastImageData) return
          renderPalette(extractPalette(lastImageData, Number(countSelect.value)))
        }
      },
      [4, 6, 8].map(value => createElement('option', { value: String(value), textContent: `${value} 种颜色` }))
    )
    countSelect.value = '6'

    const extractButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '提取主色调',
      onClick: () => processFile()
    })

    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const error = createElement('div', { className: 'error-text' })
    const swatchGrid = createElement('div', { className: 'palette-grid' })
    const ratioList = createElement('div', { className: 'palette-ratio-list' })
    const paletteHint = createElement('div', {
      className: 'form-hint',
      textContent: '点击任意色块即可复制 HEX。文字会自动切换为黑色或白色，保证可读性。'
    })
    const generatorLink = createElement('a', {
      className: 'palette-generator-link',
      href: '#/palette-gen',
      textContent: '把颜色送入调色板生成器 →'
    })

    const paletteSection = createSection(
      '主色调色板',
      createElement('div', { className: 'tool-stack' }, [swatchGrid, ratioList, paletteHint, generatorLink])
    )
    paletteSection.hidden = true

    function readableTextColor(hex) {
      // WCAG 的对比度交叉点约为 0.179：亮色配深色文字，暗色配白色文字。
      return relativeLuminance(hex) > 0.179 ? '#111827' : '#ffffff'
    }

    function renderPalette(palette) {
      swatchGrid.replaceChildren()
      ratioList.replaceChildren()
      if (!palette.length) {
        paletteSection.hidden = true
        return
      }
      for (const color of palette) {
        const textColor = readableTextColor(color.hex)
        const ratioText = `${(color.ratio * 100).toFixed(1)}%`
        const card = createElement(
          'button',
          {
            className: 'palette-card',
            type: 'button',
            'aria-label': `复制颜色 ${color.hex}，占比 ${ratioText}`,
            style: { backgroundColor: color.hex, color: textColor },
            onClick: () => copyToClipboard(color.hex)
          },
          [
            createElement('span', { className: 'palette-card-hex', textContent: color.hex }),
            createElement('span', {
              className: 'palette-card-rgb',
              textContent: `rgb(${color.r}, ${color.g}, ${color.b})`
            }),
            createElement('span', { className: 'palette-card-ratio', textContent: `占比 ${ratioText}` }),
            createElement('span', { className: 'palette-card-bar', 'aria-hidden': 'true' }, [
              createElement('span', {
                className: 'palette-card-bar-fill',
                style: { width: `${Math.max(2, color.ratio * 100)}%`, backgroundColor: textColor }
              })
            ])
          ]
        )
        swatchGrid.appendChild(card)

        ratioList.appendChild(
          createElement('div', { className: 'palette-ratio-row' }, [
            createElement('span', { className: 'palette-ratio-dot', style: { backgroundColor: color.hex }, 'aria-hidden': 'true' }),
            createElement('span', { className: 'palette-ratio-hex', textContent: color.hex }),
            createElement('span', { className: 'palette-ratio-track', 'aria-hidden': 'true' }, [
              createElement('span', {
                className: 'palette-ratio-fill',
                style: { width: `${Math.max(2, color.ratio * 100)}%`, backgroundColor: color.hex }
              })
            ]),
            createElement('span', { className: 'palette-ratio-value', textContent: ratioText })
          ])
        )
      }
      paletteSection.hidden = false
    }

    async function processFile() {
      error.textContent = ''
      const file = fileInput.files?.[0]
      if (!file) {
        error.textContent = '请先选择图片文件'
        return
      }
      if (!String(file.type || '').startsWith('image/')) {
        error.textContent = '请选择图片文件（PNG、JPEG、WebP 等）'
        return
      }
      if (typeof createImageBitmap !== 'function') {
        error.textContent = '当前浏览器不支持图片解码，请更换浏览器后重试'
        return
      }

      status.textContent = '正在分析图片颜色…'
      try {
        const bitmap = await createImageBitmap(file)
        const maxSide = 1600
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('当前浏览器不支持画布绘制')
        context.drawImage(bitmap, 0, 0, width, height)
        bitmap.close?.()
        lastImageData = context.getImageData(0, 0, width, height)
        const palette = extractPalette(lastImageData, Number(countSelect.value))
        if (!palette.length) throw new Error('图片中没有可分析的不透明像素')

        if (previewUrl) URL.revokeObjectURL(previewUrl)
        previewUrl = URL.createObjectURL(file)
        preview.src = previewUrl
        preview.classList.remove('hidden')
        renderPalette(palette)
        status.textContent = `已提取 ${palette.length} 种主色；切换颜色数量可重新划分色板。`
      } catch (cause) {
        paletteSection.hidden = true
        status.textContent = ''
        error.textContent = `颜色提取失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 图片仅在当前浏览器中分析，不会上传到服务器。'
      }),
      createSection(
        '选择图片',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', for: 'ip-file', textContent: '图片文件' }),
            fileInput
          ]),
          previewWrap
        ])
      ),
      createSection(
        '分析设置',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', for: 'ip-count', textContent: '提取颜色数量' }),
            countSelect,
            createElement('div', { className: 'form-hint', textContent: '使用中位切分（median cut）按像素占比划出色块。' })
          ]),
          createElement('div', { className: 'btn-group' }, [extractButton]),
          error,
          status
        ])
      ),
      paletteSection
    )
  }
}
