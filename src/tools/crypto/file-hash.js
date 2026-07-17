import { createElement, createCopyButton, createSection } from '../../utils/dom.js'

export async function digestFile(file, algorithm = 'SHA-256') {
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest(algorithm, buffer)
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export default {
  id: 'file-hash', name: '文件哈希计算', description: '在本地计算文件的 SHA-1、SHA-256 或 SHA-512 摘要', category: 'crypto', icon: 'sha',
  render(container) {
    const fileInput = createElement('input', { className: 'input', type: 'file', 'aria-label': '选择要计算哈希的文件' })
    const algorithm = createElement('select', { className: 'select', 'aria-label': '哈希算法' }, ['SHA-1', 'SHA-256', 'SHA-512'].map(value => createElement('option', { value, textContent: value })))
    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const output = createElement('textarea', { className: 'textarea', rows: 4, readOnly: true, placeholder: '选择文件后计算哈希…' })
    const calculate = async () => {
      const file = fileInput.files?.[0]
      if (!file) { status.textContent = '请先选择文件'; return }
      status.textContent = `正在计算 ${file.name}（${(file.size / 1024).toFixed(1)} KB）…`; output.value = ''
      try { output.value = await digestFile(file, algorithm.value); status.textContent = `计算完成 · ${file.name}` }
      catch { status.textContent = '计算失败，请更换文件后重试' }
    }
    fileInput.addEventListener('change', calculate)
    algorithm.addEventListener('change', () => { if (fileInput.files?.length) calculate() })
    container.append(
      createElement('div', { className: 'privacy-notice', textContent: '🔒 文件仅在当前浏览器读取和计算，不会上传到服务器。' }),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '选择文件' }), fileInput]),
        createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '哈希算法' }), algorithm])
      ]),
      createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '计算文件哈希', onClick: calculate }), status,
      createSection('哈希结果', output, [createCopyButton(() => output.value)])
    )
  }
}
