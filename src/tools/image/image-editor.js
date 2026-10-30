import '../../styles/tools/image-editor.css'
import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'
import { downloadBlob } from '../../utils/download.js'

// Local image editor: crop → rotate/flip → watermark → export. The public
// helpers are pure so the geometry can be tested without decoding an image.

export const WATERMARK_POSITIONS = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '上中' },
  { value: 'top-right', label: '右上' },
  { value: 'center-left', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'center-right', label: '右中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '下中' },
  { value: 'bottom-right', label: '右下' }
]

const FORMATS = [
  { value: 'image/png', label: 'PNG', extension: 'png' },
  { value: 'image/jpeg', label: 'JPEG', extension: 'jpg' },
  { value: 'image/webp', label: 'WebP', extension: 'webp' }
]

function toPositiveInteger(value, fallback = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.round(number))
}

export function rotateDimensions(width, height, degrees) {
  const sourceWidth = toPositiveInteger(width)
  const sourceHeight = toPositiveInteger(height)
  const normalized = ((Math.round(Number(degrees) || 0) % 360) + 360) % 360
  if (normalized === 90 || normalized === 270) return { width: sourceHeight, height: sourceWidth }
  return { width: sourceWidth, height: sourceHeight }
}

export function clampCropRect(rect = {}, width, height) {
  const canvasWidth = toPositiveInteger(width)
  const canvasHeight = toPositiveInteger(height)
  const rawX = Number.isFinite(Number(rect.x)) ? Math.round(Number(rect.x)) : 0
  const rawY = Number.isFinite(Number(rect.y)) ? Math.round(Number(rect.y)) : 0
  const x = Math.min(Math.max(0, rawX), canvasWidth - 1)
  const y = Math.min(Math.max(0, rawY), canvasHeight - 1)
  const rawWidth = Number.isFinite(Number(rect.width)) && Number(rect.width) > 0 ? Math.round(Number(rect.width)) : canvasWidth - x
  const rawHeight = Number.isFinite(Number(rect.height)) && Number(rect.height) > 0 ? Math.round(Number(rect.height)) : canvasHeight - y
  return {
    x,
    y,
    width: Math.min(Math.max(1, rawWidth), canvasWidth - x),
    height: Math.min(Math.max(1, rawHeight), canvasHeight - y)
  }
}

export function buildWatermarkLayout({ canvasWidth, canvasHeight, position = 'bottom-right', text = '' } = {}) {
  const width = toPositiveInteger(canvasWidth)
  const height = toPositiveInteger(canvasHeight)
  const margin = Math.max(12, Math.round(Math.min(width, height) * 0.03))
  const parts = String(position).split('-')
  const vertical = parts.length === 1 ? 'center' : parts[0]
  const horizontal = parts.length === 1 ? parts[0] : parts[1]

  const align = horizontal === 'left' ? 'left' : horizontal === 'right' ? 'right' : 'center'
  const x = align === 'left' ? margin : align === 'right' ? Math.max(margin, width - margin) : Math.round(width / 2)

  const baseline = vertical === 'top' ? 'top' : vertical === 'bottom' ? 'bottom' : 'middle'
  const y = baseline === 'top' ? margin : baseline === 'bottom' ? Math.max(margin, height - margin) : Math.round(height / 2)

  return { x, y, align, baseline, margin, text: String(text) }
}

export default {
  render(container) {
    let sourceBitmap = null
    let sourceWidth = 0
    let sourceHeight = 0
    let rotation = 0
    let resultBlob = null

    const fileInput = createElement('input', {
      className: 'input',
      type: 'file',
      accept: 'image/*',
      id: 'ie-file',
      onChange: event => {
        const selected = event.target.files?.[0]
        if (selected) loadImage(selected)
      }
    })

    const previewCanvas = createElement('canvas', {
      className: 'image-editor-canvas hidden',
      width: '320',
      height: '180',
      role: 'img',
      'aria-label': '图片预览画布'
    })
    const previewPlaceholder = createElement('div', {
      className: 'preview-placeholder',
      textContent: '选择一张图片后在这里预览'
    })
    const previewWrap = createElement('div', { className: 'image-editor-preview' }, [previewCanvas, previewPlaceholder])

    const cropX = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'ie-crop-x',
      min: '0',
      step: '1',
      placeholder: '0',
      value: '0'
    })
    const cropY = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'ie-crop-y',
      min: '0',
      step: '1',
      placeholder: '0',
      value: '0'
    })
    const cropWidth = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'ie-crop-width',
      min: '1',
      step: '1',
      placeholder: '原图宽度'
    })
    const cropHeight = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'ie-crop-height',
      min: '1',
      step: '1',
      placeholder: '原图高度'
    })

    const cropXGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'ie-crop-x', textContent: '裁剪 X（px）' }),
      cropX
    ])
    const cropYGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'ie-crop-y', textContent: '裁剪 Y（px）' }),
      cropY
    ])
    const cropWidthGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'ie-crop-width', textContent: '裁剪宽度（px）' }),
      cropWidth
    ])
    const cropHeightGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'ie-crop-height', textContent: '裁剪高度（px）' }),
      cropHeight
    ])

    const rotationGroup = createSegmentedGroup(
      [
        { value: '0', label: '0°' },
        { value: '90', label: '90°' },
        { value: '180', label: '180°' },
        { value: '270', label: '270°' }
      ],
      value => {
        rotation = Number(value) || 0
        syncCropBounds()
        updateSizeHint()
      },
      { label: '旋转角度' }
    )

    const flipHorizontal = createElement('input', { className: 'checkbox', type: 'checkbox', id: 'ie-flip-horizontal' })
    const flipVertical = createElement('input', { className: 'checkbox', type: 'checkbox', id: 'ie-flip-vertical' })
    const flipRow = createElement('div', { className: 'image-editor-flips' }, [
      createElement('label', { className: 'option-item option-control-group', for: 'ie-flip-horizontal' }, [
        flipHorizontal,
        createElement('span', { textContent: '水平翻转' })
      ]),
      createElement('label', { className: 'option-item option-control-group', for: 'ie-flip-vertical' }, [
        flipVertical,
        createElement('span', { textContent: '垂直翻转' })
      ])
    ])

    const watermarkText = createElement('input', {
      className: 'input',
      type: 'text',
      id: 'ie-watermark-text',
      placeholder: '例如：© 2026 我的网站',
      maxlength: '200'
    })
    const watermarkSize = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'ie-watermark-size',
      min: '1',
      max: '500',
      step: '1',
      value: '32'
    })
    const watermarkColor = createElement('input', {
      className: 'input',
      type: 'color',
      id: 'ie-watermark-color',
      value: '#ffffff'
    })
    const watermarkPosition = createElement(
      'select',
      { className: 'select', id: 'ie-watermark-position' },
      WATERMARK_POSITIONS.map(item => createElement('option', { value: item.value, textContent: item.label }))
    )
    watermarkPosition.value = 'bottom-right'
    const watermarkOpacity = createElement('input', {
      className: 'input',
      type: 'range',
      id: 'ie-watermark-opacity',
      min: '0',
      max: '100',
      step: '1',
      value: '80'
    })
    const watermarkOpacityValue = createElement('span', { className: 'stat-value', textContent: '80%' })
    watermarkOpacity.addEventListener('input', () => {
      watermarkOpacityValue.textContent = `${watermarkOpacity.value}%`
    })

    const formatSelect = createElement(
      'select',
      { className: 'select', id: 'ie-format', onChange: syncQualityState },
      FORMATS.map(item => createElement('option', { value: item.value, textContent: item.label }))
    )
    const quality = createElement('input', {
      className: 'input',
      type: 'range',
      id: 'ie-quality',
      min: '10',
      max: '100',
      step: '1',
      value: '90'
    })
    const qualityValue = createElement('span', { className: 'stat-value', textContent: '90%' })
    const qualityHint = createElement('div', { className: 'form-hint' })
    quality.addEventListener('input', () => {
      qualityValue.textContent = `${quality.value}%`
    })

    const processButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '应用处理',
      onClick: processImage
    })
    const downloadButton = createElement('button', {
      className: 'btn btn-success',
      type: 'button',
      textContent: '下载图片',
      disabled: true,
      onClick: () => {
        if (!resultBlob) return
        const extension = FORMATS.find(item => item.value === formatSelect.value)?.extension || 'png'
        downloadBlob(`edited.${extension}`, resultBlob)
      }
    })

    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const errorText = createElement('div', { className: 'error-text' })
    const sizeHint = createElement('div', {
      className: 'form-hint',
      textContent: '选择图片后，裁切坐标与输出尺寸会按原图和旋转角度自动计算。'
    })

    function syncQualityState() {
      const lossless = formatSelect.value === 'image/png'
      quality.disabled = lossless
      qualityHint.textContent = lossless ? 'PNG 为无损格式，质量参数不生效。' : '质量越高，文件越大；90% 适合大多数网页用途。'
    }

    function syncCropBounds() {
      if (!sourceBitmap) return
      const size = rotateDimensions(sourceWidth, sourceHeight, rotation)
      const current = clampCropRect(
        {
          x: cropX.value,
          y: cropY.value,
          width: cropWidth.value || size.width,
          height: cropHeight.value || size.height
        },
        size.width,
        size.height
      )
      cropX.max = String(size.width - 1)
      cropY.max = String(size.height - 1)
      cropWidth.max = String(size.width)
      cropHeight.max = String(size.height)
      cropX.value = String(current.x)
      cropY.value = String(current.y)
      cropWidth.value = String(current.width)
      cropHeight.value = String(current.height)
    }

    function updateSizeHint() {
      if (!sourceBitmap) {
        sizeHint.textContent = '选择图片后，裁切坐标与输出尺寸会按原图和旋转角度自动计算。'
        return
      }
      const size = rotateDimensions(sourceWidth, sourceHeight, rotation)
      sizeHint.textContent = `原图 ${sourceWidth} × ${sourceHeight}px · 旋转后画布 ${size.width} × ${size.height}px`
    }

    function drawPreview(bitmap) {
      previewCanvas.width = bitmap.width
      previewCanvas.height = bitmap.height
      const context = previewCanvas.getContext('2d')
      if (!context) throw new Error('当前浏览器不支持画布绘制')
      context.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
      context.drawImage(bitmap, 0, 0)
      previewCanvas.classList.remove('hidden')
      previewPlaceholder.hidden = true
    }

    async function loadImage(file) {
      errorText.textContent = ''
      status.textContent = '正在读取图片…'
      resultBlob = null
      downloadButton.disabled = true
      try {
        if (!String(file.type || '').startsWith('image/')) throw new Error('请选择图片文件（PNG、JPEG、WebP 等）')
        if (typeof createImageBitmap !== 'function') throw new Error('当前浏览器不支持图片解码，请更换浏览器后重试')
        const bitmap = await createImageBitmap(file)
        sourceBitmap?.close?.()
        sourceBitmap = bitmap
        sourceWidth = bitmap.width
        sourceHeight = bitmap.height
        try {
          drawPreview(bitmap)
        } catch (cause) {
          bitmap.close?.()
          sourceBitmap = null
          throw cause
        }
        rotation = 0
        rotationGroup.setValue('0')
        cropX.value = '0'
        cropY.value = '0'
        cropWidth.value = String(sourceWidth)
        cropHeight.value = String(sourceHeight)
        syncCropBounds()
        updateSizeHint()
        errorText.textContent = ''
        status.textContent = `已加载 ${sourceWidth} × ${sourceHeight}px 图片，可开始裁剪、旋转或添加水印。`
      } catch (cause) {
        sourceBitmap?.close?.()
        sourceBitmap = null
        sourceWidth = 0
        sourceHeight = 0
        previewCanvas.classList.add('hidden')
        previewPlaceholder.hidden = false
        status.textContent = ''
        errorText.textContent = `图片读取失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    function createTransformedCanvas() {
      const size = rotateDimensions(sourceWidth, sourceHeight, rotation)
      const rotated = document.createElement('canvas')
      rotated.width = size.width
      rotated.height = size.height
      const rotatedContext = rotated.getContext('2d')
      if (!rotatedContext) throw new Error('当前浏览器不支持画布绘制')
      rotatedContext.translate(size.width / 2, size.height / 2)
      rotatedContext.rotate((rotation * Math.PI) / 180)
      rotatedContext.scale(flipHorizontal.checked ? -1 : 1, flipVertical.checked ? -1 : 1)
      rotatedContext.drawImage(sourceBitmap, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight)
      return { canvas: rotated, size }
    }

    function createOutputCanvas() {
      const transformed = createTransformedCanvas()
      const crop = clampCropRect(
        {
          x: cropX.value,
          y: cropY.value,
          width: cropWidth.value,
          height: cropHeight.value
        },
        transformed.size.width,
        transformed.size.height
      )
      const output = document.createElement('canvas')
      output.width = crop.width
      output.height = crop.height
      const context = output.getContext('2d')
      if (!context) throw new Error('当前浏览器不支持画布绘制')
      context.drawImage(transformed.canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)

      const text = watermarkText.value.trim()
      if (text) {
        const layout = buildWatermarkLayout({
          canvasWidth: crop.width,
          canvasHeight: crop.height,
          position: watermarkPosition.value,
          text
        })
        const fontSize = Math.max(1, Number(watermarkSize.value) || 32)
        context.save()
        context.globalAlpha = Math.max(0, Math.min(1, Number(watermarkOpacity.value) / 100))
        context.fillStyle = watermarkColor.value
        context.font = `600 ${fontSize}px "Noto Sans SC", "PingFang SC", sans-serif`
        context.textAlign = layout.align
        context.textBaseline = layout.baseline
        context.fillText(text, layout.x, layout.y)
        context.restore()
      }

      return { canvas: output, crop }
    }

    function canvasToBlob(canvas, mime, qualityValueNumber) {
      return new Promise((resolve, reject) => {
        if (typeof canvas.toBlob !== 'function') {
          reject(new Error('当前浏览器不支持图片导出，请更换浏览器后重试'))
          return
        }
        canvas.toBlob(
          blob => (blob ? resolve(blob) : reject(new Error('图片编码失败，请尝试其他格式'))),
          mime,
          mime === 'image/png' ? undefined : qualityValueNumber
        )
      })
    }

    async function processImage() {
      if (!sourceBitmap) {
        status.textContent = ''
        errorText.textContent = '请先选择图片'
        return
      }
      errorText.textContent = ''
      status.textContent = '正在处理图片…'
      resultBlob = null
      downloadButton.disabled = true
      try {
        const { canvas, crop } = createOutputCanvas()
        const mime = formatSelect.value
        const blob = await canvasToBlob(canvas, mime, Math.max(0.1, Math.min(1, Number(quality.value) / 100)))
        resultBlob = blob
        downloadButton.disabled = false

        previewCanvas.width = canvas.width
        previewCanvas.height = canvas.height
        const previewContext = previewCanvas.getContext('2d')
        if (previewContext) {
          previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
          previewContext.drawImage(canvas, 0, 0)
        }
        previewCanvas.classList.remove('hidden')
        previewPlaceholder.hidden = true
        errorText.textContent = ''
        status.textContent = `处理完成：输出 ${crop.width} × ${crop.height}px，约 ${(blob.size / 1024).toFixed(1)} KB。`
      } catch (cause) {
        status.textContent = ''
        errorText.textContent = `图片处理失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    syncQualityState()
    updateSizeHint()

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 图片仅在当前浏览器中处理，不会上传到服务器。'
      }),
      createSection(
        '选择图片',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', for: 'ie-file', textContent: '图片文件' }),
            fileInput
          ]),
          previewWrap
        ])
      ),
      createSection(
        '旋转、翻转与裁剪',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('span', { className: 'label', textContent: '旋转角度' }),
            rotationGroup
          ]),
          createElement('div', { className: 'form-row' }, [cropXGroup, cropYGroup]),
          createElement('div', { className: 'form-row' }, [cropWidthGroup, cropHeightGroup]),
          flipRow,
          sizeHint
        ])
      ),
      createSection(
        '文字水印',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', for: 'ie-watermark-text', textContent: '水印文字（留空则不添加）' }),
            watermarkText
          ]),
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'ie-watermark-size', textContent: '字号（px）' }),
              watermarkSize
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'ie-watermark-color', textContent: '颜色' }),
              watermarkColor
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'ie-watermark-position', textContent: '位置' }),
              watermarkPosition
            ])
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', for: 'ie-watermark-opacity' }, [
              document.createTextNode('不透明度 '),
              watermarkOpacityValue
            ]),
            watermarkOpacity
          ])
        ])
      ),
      createSection(
        '导出',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'ie-format', textContent: '输出格式' }),
              formatSelect
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'ie-quality' }, [document.createTextNode('质量 '), qualityValue]),
              quality,
              qualityHint
            ])
          ]),
          createElement('div', { className: 'btn-group' }, [processButton, downloadButton]),
          errorText,
          status
        ])
      )
    )
  }
}
