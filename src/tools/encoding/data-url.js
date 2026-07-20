import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

export default {
  id: 'data-url',
  name: 'Data URL 生成',
  description: '将本地文件转换为可嵌入 HTML 或 CSS 的 Data URL',
  category: 'encoding',
  icon: 'img-to-base64',
  render(container) {
    let activeReader = null
    let readVersion = 0
    const fileInput = createElement('input', {
      className: 'input',
      type: 'file',
      'aria-label': '选择文件'
    })
    const fileLabel = createElement('label', { className: 'drop-area' }, [
      fileInput,
      createElement('strong', { textContent: '选择一个本地文件' }),
      createElement('span', { textContent: '文件只在当前浏览器读取，不会上传' })
    ])
    const output = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      readOnly: true,
      placeholder: '选择文件后，Data URL 会显示在此处...'
    })
    const meta = createElement('div', { className: 'inline-result', role: 'status', 'aria-live': 'polite' })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        readVersion++
        if (activeReader?.readyState === FileReader.LOADING) activeReader.abort()
        activeReader = null
        fileInput.value = ''
        output.value = ''
        meta.textContent = ''
      }
    })
    fileInput.addEventListener('change', () => {
      readVersion++
      if (activeReader?.readyState === FileReader.LOADING) activeReader.abort()
      activeReader = null
      output.value = ''
      meta.textContent = ''
      const file = fileInput.files?.[0]
      if (!file) return
      const currentRead = readVersion
      const reader = new FileReader()
      activeReader = reader
      meta.textContent = '正在读取文件…'
      reader.addEventListener('load', () => {
        if (currentRead !== readVersion) return
        activeReader = null
        output.value = String(reader.result || '')
        const size = file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`
        meta.textContent = `${file.name} · ${file.type || 'application/octet-stream'} · ${size}`
      })
      reader.addEventListener('error', () => {
        if (currentRead !== readVersion) return
        activeReader = null
        output.value = ''
        meta.textContent = '文件读取失败'
      })
      reader.readAsDataURL(file)
    })
    container.append(
      createElement('div', { className: 'privacy-notice', textContent: '隐私提示：文件内容只在本地浏览器中处理。' }),
      createSection('选择文件', fileLabel),
      createElement('div', { className: 'btn-group' }, [clearButton]),
      meta,
      createSection('Data URL', output, [createCopyButton(() => output.value)])
    )
  }
}
