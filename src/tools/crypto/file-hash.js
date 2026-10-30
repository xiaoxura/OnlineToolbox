import '../../styles/tools/file-hash.css'
import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { digestFile } from '../../utils/hash.js'

// Files above this size are digested in a worker. Smaller ones finish before the
// worker start-up cost would pay off; either path streams in 4 MB chunks so the
// whole file is never materialised as one ArrayBuffer.
const WORKER_THRESHOLD = 8 * 1024 * 1024

export { digestFile }

function digestInWorker(file, algorithm, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./file-hash.worker.js', import.meta.url), { type: 'module' })
    const id = Date.now().toString(36)
    const cleanup = () => worker.terminate()
    worker.addEventListener('message', event => {
      const message = event.data
      if (message.id !== id) return
      if (message.type === 'progress') {
        onProgress?.(message.loaded, message.total)
        return
      }
      cleanup()
      if (message.type === 'done') resolve(message.digest)
      else reject(new Error(message.message || '哈希计算失败'))
    })
    worker.addEventListener('error', error => {
      cleanup()
      reject(error instanceof Error ? error : new Error('哈希 Worker 出错'))
    })
    worker.postMessage({ id, file, algorithm })
  })
}

export default {
  render(container) {
    const fileInput = createElement('input', { className: 'input', type: 'file', 'aria-label': '选择要计算哈希的文件' })
    const algorithm = createElement('select', { className: 'select', 'aria-label': '哈希算法' }, ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'].map(value => createElement('option', { value, textContent: value })))
    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const progress = createElement('progress', { className: 'file-progress', max: '100', value: '0' })
    const progressText = createElement('div', { className: 'form-hint', textContent: '' })
    const output = createElement('textarea', { className: 'textarea', rows: 4, readOnly: true, placeholder: '选择文件后计算哈希…' })
    let running = false

    const setProgress = (loaded, total) => {
      const percent = total ? Math.min(100, (loaded / total) * 100) : 0
      progress.value = String(percent)
      progressText.textContent = total
        ? `${(loaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB（${percent.toFixed(0)}%）`
        : ''
    }

    const calculate = async () => {
      const file = fileInput.files?.[0]
      if (!file) { status.textContent = '请先选择文件'; return }
      if (running) return
      running = true
      setProgress(0, file.size)
      status.textContent = `正在计算 ${file.name}（${(file.size / 1024).toFixed(1)} KB）…`
      output.value = ''
      try {
        const onProgress = setProgress
        const useWorker = typeof Worker !== 'undefined' && file.size > WORKER_THRESHOLD
        output.value = useWorker
          ? await digestInWorker(file, algorithm.value, onProgress)
          : await digestFile(file, algorithm.value, { onProgress })
        status.textContent = `计算完成 · ${file.name} · ${algorithm.value}`
      } catch (error) {
        status.textContent = `计算失败：${error instanceof Error ? error.message : String(error)}`
      } finally {
        running = false
      }
    }
    fileInput.addEventListener('change', calculate)
    algorithm.addEventListener('change', () => { if (fileInput.files?.length) calculate() })
    container.append(
      createElement('div', { className: 'privacy-notice', textContent: '🔒 文件仅在当前浏览器读取和计算，不会上传到服务器；大文件会分块读取并在 Worker 中计算。' }),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '选择文件' }), fileInput]),
        createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '哈希算法' }), algorithm])
      ]),
      createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '计算文件哈希', onClick: calculate }),
      status,
      createElement('div', { className: 'file-progress-wrap' }, [progress, progressText]),
      createSection('哈希结果', output, [createCopyButton(() => output.value)])
    )
  }
}
