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

    const sizeInfo = createElement('div', { className: 'stats-row image-stats', hidden: true })
    const previewPlaceholder = createElement('div', { className: 'preview-placeholder', textContent: '选择图片后在此预览' })

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
        previewPlaceholder.hidden = true

        sizeInfo.innerHTML = ''
        sizeInfo.hidden = false
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
      'aria-label': '选择要转换的图片',
      accept: 'image/*',
      style: { display: 'none' },
      onChange: (e) => {
        if (e.target.files[0]) processFile(e.target.files[0])
      }
    })

    const dropArea = createElement('button', {
      className: 'drop-area',
      type: 'button',
      'aria-label': '选择图片，或将图片拖放到此处',
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
      createElement('span', {
        className: 'drop-icon',
        'aria-hidden': 'true',
        innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>'
      }),
      createElement('span', { className: 'drop-content' }, [
        createElement('strong', { textContent: '选择一张图片' }),
        createElement('span', { className: 'drop-text', textContent: '也可以将图片拖放到此处' })
      ])
    ])

    const previewSection = createSection('图片预览', createElement('div', { className: 'img-preview-wrap' }, [previewPlaceholder, imgPreview]))

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
