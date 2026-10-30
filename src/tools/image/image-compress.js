import '../../styles/tools/image-preview.css'
import { createElement } from '../../utils/dom.js'
import { supportsWorker } from '../../utils/worker.js'

// Above this size the work is handed to a worker; small images finish faster
// than a worker can start up.
const WORKER_THRESHOLD = 2 * 1024 * 1024

export function calculateTargetSize(width, height, maxWidth, maxHeight) {
  const scale = Math.min(1, (maxWidth || width) / width, (maxHeight || height) / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function compressInWorker(file, options) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./image-compress.worker.js', import.meta.url), { type: 'module' })
    const id = Date.now().toString(36)
    const cleanup = () => worker.terminate()
    worker.addEventListener('message', event => {
      const message = event.data || {}
      if (message.id !== id) return
      cleanup()
      if (message.type === 'done') resolve(message)
      else reject(new Error(message.message || '图片处理失败'))
    })
    worker.addEventListener('error', () => {
      cleanup()
      reject(new Error('图片处理 Worker 出错'))
    })
    worker.postMessage({ ...options, file, id })
  })
}

export default {
  render(container) {
    const file = createElement('input', { className: 'input', type: 'file', accept: 'image/*', 'aria-label': '选择图片' }),
      format = createElement(
        'select',
        { className: 'select', 'aria-label': '输出格式' },
        [
          ['image/webp', 'WebP'],
          ['image/jpeg', 'JPEG'],
          ['image/png', 'PNG']
        ].map(([value, label]) => createElement('option', { value, textContent: label }))
      ),
      quality = createElement('input', { className: 'input', type: 'range', min: '10', max: '100', value: '82', 'aria-label': '图片质量' }),
      qualityText = createElement('span', { className: 'stat-value', textContent: '82%' }),
      maxWidth = createElement('input', { className: 'input', type: 'number', min: '1', placeholder: '保持原宽' }),
      maxHeight = createElement('input', { className: 'input', type: 'number', min: '1', placeholder: '保持原高' })
    const preview = createElement('img', { className: 'img-preview hidden', alt: '压缩后的图片预览' }),
      status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' }),
      download = createElement('button', { className: 'btn btn-success', type: 'button', textContent: '下载处理后的图片', disabled: true })
    let outputUrl = ''
    quality.addEventListener('input', () => (qualityText.textContent = `${quality.value}%`))

    function showResult(blob, dimensions, selected) {
      if (outputUrl) URL.revokeObjectURL(outputUrl)
      outputUrl = URL.createObjectURL(blob)
      preview.src = outputUrl
      preview.classList.remove('hidden')
      download.disabled = false
      const reduction = (100 - (blob.size / selected.size) * 100).toFixed(1)
      status.textContent = `${dimensions.sourceWidth}×${dimensions.sourceHeight} → ${dimensions.outputWidth}×${dimensions.outputHeight} · ${(selected.size / 1024).toFixed(1)} KB → ${(blob.size / 1024).toFixed(1)} KB（${Number(reduction) > 0 ? '减少' : '增加'} ${Math.abs(reduction)}%）`
      download.onclick = () => {
        const link = document.createElement('a')
        link.href = outputUrl
        link.download = `compressed.${format.value.split('/')[1]}`
        link.click()
      }
    }

    async function processOnMainThread(selected) {
      const bitmap = await createImageBitmap(selected)
      const size = calculateTargetSize(
        bitmap.width,
        bitmap.height,
        Number(maxWidth.value) || bitmap.width,
        Number(maxHeight.value) || bitmap.height
      )
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      canvas.getContext('2d').drawImage(bitmap, 0, 0, size.width, size.height)
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(value => (value ? resolve(value) : reject(new Error('编码失败'))), format.value, Number(quality.value) / 100)
      )
      const dimensions = {
        sourceWidth: bitmap.width,
        sourceHeight: bitmap.height,
        outputWidth: size.width,
        outputHeight: size.height
      }
      bitmap.close?.()
      return { blob, dimensions }
    }

    const process = async () => {
      const selected = file.files?.[0]
      if (!selected) {
        status.textContent = '请先选择图片'
        return
      }
      status.textContent = '正在处理图片…'
      try {
        let result
        if (supportsWorker() && selected.size > WORKER_THRESHOLD) {
          try {
            const message = await compressInWorker(selected, {
              maxWidth: Number(maxWidth.value) || 0,
              maxHeight: Number(maxHeight.value) || 0,
              format: format.value,
              quality: Number(quality.value) / 100
            })
            result = {
              blob: new Blob([message.buffer], { type: message.blobType }),
              dimensions: {
                sourceWidth: message.sourceWidth,
                sourceHeight: message.sourceHeight,
                outputWidth: message.outputWidth,
                outputHeight: message.outputHeight
              }
            }
          } catch {
            // OffscreenCanvas/createImageBitmap may be missing in the worker;
            // the same work still succeeds on the main thread.
            result = await processOnMainThread(selected)
          }
        } else {
          result = await processOnMainThread(selected)
        }
        showResult(result.blob, result.dimensions, selected)
      } catch {
        status.textContent = '图片处理失败，请尝试其他图片或格式'
      }
    }
    container.append(
      createElement('div', { className: 'privacy-notice', textContent: '🔒 图片仅在当前浏览器中处理，不会上传到服务器；大图会在 Worker 中压缩。' }),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '选择图片' }), file]),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '输出格式' }),
          format
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label' }, [document.createTextNode('质量 '), qualityText]),
          quality
        ])
      ]),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '最大宽度（px）' }),
          maxWidth
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '最大高度（px）' }),
          maxHeight
        ])
      ]),
      createElement('div', { className: 'btn-group' }, [
        createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '压缩并转换', onClick: process }),
        download
      ]),
      status,
      createElement('div', { className: 'img-preview-wrap' }, [preview])
    )
  }
}
