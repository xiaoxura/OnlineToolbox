import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

export default {
  id: 'img-to-base64',
  name: '图片转 Base64',
  description: '将图片转换为 Base64 编码字符串',
  category: 'image',
  icon: 'base64',
  render(container) {
    const fullOutput = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      readOnly: true,
      placeholder: 'Base64 (含 data URI 前缀)...'
    })

    const rawOutput = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      readOnly: true,
      placeholder: 'Base64 (不含前缀)...'
    })

    const cssOutput = createElement('textarea', {
      className: 'textarea',
      rows: 2,
      readOnly: true,
      placeholder: 'CSS background-image...'
    })

    const imgPreview = createElement('img', {
      className: 'img-preview hidden',
      alt: '预览'
    })

    const sizeInfo = createElement('div', { className: 'inline-result' })

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }

    function processFile(file) {
      if (!file || !file.type.startsWith('image/')) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target.result
        const base64 = dataUrl.split(',')[1]

        fullOutput.value = dataUrl
        rawOutput.value = base64
        cssOutput.value = 'background-image: url("' + dataUrl + '");'

        imgPreview.src = dataUrl
        imgPreview.classList.remove('hidden')

        sizeInfo.innerHTML = ''
        const stats = [
          { label: '文件名', value: file.name },
          { label: '文件大小', value: formatSize(file.size) },
          { label: '类型', value: file.type },
          { label: 'Base64 大小', value: formatSize(base64.length) }
        ]
        stats.forEach(s => {
          const item = createElement('span', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: s.label + ': ' }),
            createElement('span', { className: 'stat-value', textContent: s.value })
          ])
          sizeInfo.appendChild(item)
        })
      }
      reader.readAsDataURL(file)
    }

    const fileInput = createElement('input', {
      type: 'file',
      accept: 'image/*',
      style: { display: 'none' },
      onChange: (e) => {
        if (e.target.files[0]) processFile(e.target.files[0])
      }
    })

    const dropArea = createElement('div', {
      className: 'drop-area',
      onClick: () => fileInput.click(),
      onDragover: (e) => {
        e.preventDefault()
        dropArea.classList.add('dragover')
      },
      onDragleave: () => {
        dropArea.classList.remove('dragover')
      },
      onDrop: (e) => {
        e.preventDefault()
        dropArea.classList.remove('dragover')
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
      }
    }, [
      createElement('div', { className: 'drop-text', textContent: '拖拽图片到此处，或点击选择文件' })
    ])

    const previewSection = createSection('图片预览', createElement('div', { className: 'img-preview-wrap' }, [imgPreview]))

    const fullCopyBtn = createCopyButton(() => fullOutput.value)
    const rawCopyBtn = createCopyButton(() => rawOutput.value)
    const cssCopyBtn = createCopyButton(() => cssOutput.value)

    const fullSection = createSection('Base64 (含 data URI 前缀)', fullOutput, [fullCopyBtn])
    const rawSection = createSection('Base64 (不含前缀)', rawOutput, [rawCopyBtn])
    const cssSection = createSection('CSS background-image', cssOutput, [cssCopyBtn])

    container.appendChild(dropArea)
    container.appendChild(fileInput)
    container.appendChild(sizeInfo)
    container.appendChild(previewSection)
    container.appendChild(fullSection)
    container.appendChild(rawSection)
    container.appendChild(cssSection)
  }
}
