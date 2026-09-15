import '../../styles/tools/drop-area.css'
import '../../styles/tools/image-preview.css'
import { createElement, createSection } from '../../utils/dom.js'
import { downloadBlob } from '../../utils/download.js'

// Multi-size favicon builder. The ICO container is written by hand so the tool
// stays dependency-free: a 6-byte header, one 16-byte directory entry per image
// and then the raw PNG payloads.

export const FAVICON_SIZES = [16, 32, 48, 64, 128, 180, 192, 512]
export const MANIFEST_SIZES = [192, 512]

function toBytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  if (Array.isArray(value)) return new Uint8Array(value)
  throw new Error('PNG 数据必须是 Uint8Array')
}

// images: [{ width, height, pngBytes: Uint8Array }] -> Uint8Array (ICO file)
export function buildIco(images) {
  if (!Array.isArray(images) || images.length === 0) throw new Error('至少需要一张图片才能打包 ICO')
  if (images.length > 255) throw new Error('ICO 最多容纳 255 张图片')

  const entries = images.map((image, index) => {
    const width = Math.round(Number(image?.width))
    const height = Math.round(Number(image?.height))
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      throw new Error(`第 ${index + 1} 张图片的尺寸无效`)
    }
    if (width > 256 || height > 256) {
      throw new Error(`第 ${index + 1} 张图片超过 256 像素，ICO 无法容纳`)
    }
    const bytes = toBytes(image.pngBytes)
    if (!bytes.length) throw new Error(`第 ${index + 1} 张图片缺少 PNG 数据`)
    return { width, height, bytes }
  })

  const headerSize = 6 + entries.length * 16
  const total = entries.reduce((sum, entry) => sum + entry.bytes.length, headerSize)
  const output = new Uint8Array(total)
  const view = new DataView(output.buffer)

  view.setUint16(0, 0, true)              // reserved
  view.setUint16(2, 1, true)              // type: 1 = icon
  view.setUint16(4, entries.length, true) // image count

  let offset = headerSize
  entries.forEach((entry, index) => {
    const at = 6 + index * 16
    // A width/height byte of 0 means 256 pixels.
    output[at] = entry.width >= 256 ? 0 : entry.width
    output[at + 1] = entry.height >= 256 ? 0 : entry.height
    output[at + 2] = 0                     // palette size (0 = true colour)
    output[at + 3] = 0                     // reserved
    view.setUint16(at + 4, 1, true)        // colour planes
    view.setUint16(at + 6, 32, true)       // bits per pixel
    view.setUint32(at + 8, entry.bytes.length, true)
    view.setUint32(at + 12, offset, true)
    output.set(entry.bytes, offset)
    offset += entry.bytes.length
  })

  return output
}

export function buildIconHtml(sizes = FAVICON_SIZES) {
  const lines = ['<link rel="icon" href="/favicon.ico" sizes="any">']
  for (const size of sizes) {
    lines.push(`<link rel="icon" type="image/png" sizes="${size}x${size}" href="/favicon-${size}x${size}.png">`)
  }
  lines.push('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">')
  return lines.join('\n')
}

export function buildWebManifest({
  name = '我的网站',
  shortName = '网站',
  themeColor = '#ffffff',
  backgroundColor = '#ffffff',
  sizes = MANIFEST_SIZES
} = {}) {
  return JSON.stringify({
    name,
    short_name: shortName,
    icons: sizes.map(size => ({
      src: `/favicon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any'
    })),
    theme_color: themeColor,
    background_color: backgroundColor,
    display: 'standalone'
  }, null, 2)
}

export function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl ?? '').split(',')[1] || ''
  if (!base64) throw new Error('无效的图片数据')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default {
  id: 'favicon-generator',
  name: 'Favicon 生成',
  description: '将图片转换为多尺寸 favicon PNG 与 ICO，并生成引用代码',
  category: 'image',
  icon: 'img-to-base64',
  keywords: ['favicon', 'ico', '图标', 'site.webmanifest', 'apple-touch-icon'],
  render(container) {
    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })

    const htmlOutput = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      readOnly: true,
      'aria-label': 'HTML 引用代码'
    })
    const manifestOutput = createElement('textarea', {
      className: 'textarea',
      rows: 12,
      readOnly: true,
      'aria-label': 'site.webmanifest 内容'
    })
    htmlOutput.value = buildIconHtml()
    manifestOutput.value = buildWebManifest()

    const previewGrid = createElement('div', { className: 'grid-2' })
    const previewSection = createSection('尺寸预览', previewGrid)
    previewSection.hidden = true
    const sizeSummary = createElement('div', { className: 'stats-row', hidden: true })

    const icoButton = createElement('button', {
      className: 'btn btn-success',
      type: 'button',
      textContent: '下载 favicon.ico',
      disabled: true
    })

    let generated = []

    function buildPreview() {
      previewGrid.replaceChildren()
      generated.forEach(item => {
        const download = createElement('button', {
          className: 'btn btn-secondary btn-sm',
          type: 'button',
          textContent: '下载 PNG',
          onClick: () => {
            const link = document.createElement('a')
            link.download = `favicon-${item.size}x${item.size}.png`
            link.href = item.dataUrl
            link.click()
          }
        })
        previewGrid.appendChild(createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'img-preview-wrap' }, [
            createElement('img', {
              className: 'img-preview',
              src: item.dataUrl,
              alt: `${item.size} × ${item.size} favicon 预览`,
              style: { width: `${Math.min(item.size, 96)}px`, height: 'auto' }
            })
          ]),
          createElement('div', { className: 'form-hint', textContent: `${item.size} × ${item.size} · ${formatBytes(item.bytes.length)}` }),
          download
        ]))
      })
      previewSection.hidden = generated.length === 0
    }

    function renderSize(bitmap, size) {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      const scale = Math.min(size / bitmap.width, size / bitmap.height)
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      context.clearRect(0, 0, size, size)
      context.drawImage(bitmap, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height)
      const dataUrl = canvas.toDataURL('image/png')
      return { size, dataUrl, bytes: dataUrlToBytes(dataUrl) }
    }

    async function processFile(file) {
      if (!file) return
      if (!String(file.type || '').startsWith('image/')) {
        status.textContent = '请选择图片文件（PNG、JPEG、WebP 等）'
        return
      }
      if (typeof createImageBitmap !== 'function') {
        status.textContent = '当前浏览器不支持图片解码，请更换浏览器后重试'
        return
      }

      status.textContent = '正在生成各种尺寸…'
      try {
        const bitmap = await createImageBitmap(file)
        const sourceWidth = bitmap.width
        const sourceHeight = bitmap.height
        generated = FAVICON_SIZES.map(size => renderSize(bitmap, size))
        bitmap.close?.()

        buildPreview()

        const ico = buildIco(generated.map(item => ({
          width: item.size,
          height: item.size,
          pngBytes: item.bytes
        })))
        icoButton.disabled = false
        icoButton.onclick = () => downloadBlob('favicon.ico', new Blob([ico], { type: 'image/x-icon' }))

        sizeSummary.replaceChildren(
          createElement('span', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: '原图：' }),
            createElement('span', { className: 'stat-value', textContent: `${sourceWidth} × ${sourceHeight}` })
          ]),
          createElement('span', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: 'ICO 体积：' }),
            createElement('span', { className: 'stat-value', textContent: formatBytes(ico.length) })
          ]),
          createElement('span', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: '尺寸数量：' }),
            createElement('span', { className: 'stat-value', textContent: String(generated.length) })
          ])
        )
        sizeSummary.hidden = false
        status.textContent = `已生成 ${generated.length} 个尺寸，可单独下载 PNG 或打包下载 favicon.ico`
      } catch (cause) {
        generated = []
        buildPreview()
        sizeSummary.hidden = true
        icoButton.disabled = true
        status.textContent = `图片处理失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    const fileInput = createElement('input', {
      type: 'file',
      accept: 'image/*',
      'aria-label': '选择要生成 favicon 的图片',
      style: { display: 'none' },
      onChange: event => {
        if (event.target.files?.[0]) processFile(event.target.files[0])
      }
    })

    const dropArea = createElement('button', {
      className: 'drop-area',
      type: 'button',
      'aria-label': '选择图片，或将图片拖放到此处',
      onClick: () => fileInput.click(),
      onDragover: event => {
        event.preventDefault()
        dropArea.classList.add('dragover')
      },
      onDragleave: () => dropArea.classList.remove('dragover'),
      onDrop: event => {
        event.preventDefault()
        dropArea.classList.remove('dragover')
        const file = event.dataTransfer?.files?.[0]
        if (file) processFile(file)
      }
    }, [
      createElement('span', {
        className: 'drop-icon',
        'aria-hidden': 'true',
        innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>'
      }),
      createElement('span', { className: 'drop-content' }, [
        createElement('strong', { textContent: '选择一张图片' }),
        createElement('span', { className: 'drop-text', textContent: '将生成 16 / 32 / 48 / 64 / 128 / 180 / 192 / 512 共 8 种尺寸' })
      ])
    ])

    container.append(
      createElement('div', { className: 'privacy-notice', textContent: '🔒 图片仅在当前浏览器中处理，不会上传到服务器。' }),
      dropArea,
      fileInput,
      createElement('div', { className: 'btn-group' }, [icoButton]),
      status,
      sizeSummary,
      previewSection,
      createSection('HTML 引用代码', htmlOutput),
      createSection('site.webmanifest', manifestOutput)
    )
  }
}
