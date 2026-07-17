import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

export default {
  id: 'placeholder-img',
  name: '占位图生成',
  description: '生成自定义尺寸、颜色和文字的占位图片',
  category: 'generator',
  icon: 'img-to-base64',
  render(container) {
    const sizeRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'ph-width' }, ['宽度']),
        createElement('input', {
          className: 'input',
          type: 'number',
          id: 'ph-width',
          value: '300',
          min: '1',
          max: '2000'
        })
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'ph-height' }, ['高度']),
        createElement('input', {
          className: 'input',
          type: 'number',
          id: 'ph-height',
          value: '200',
          min: '1',
          max: '2000'
        })
      ])
    ])

    const colorRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'ph-bg-color' }, ['背景颜色']),
        createElement('input', {
          className: 'input',
          type: 'color',
          id: 'ph-bg-color',
          value: '#cccccc'
        })
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: 'ph-text-color' }, ['文字颜色']),
        createElement('input', {
          className: 'input',
          type: 'color',
          id: 'ph-text-color',
          value: '#999999'
        })
      ])
    ])

    const textGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'ph-text' }, ['自定义文字 (留空则显示尺寸)']),
      createElement('input', {
        className: 'input',
        type: 'text',
        id: 'ph-text',
        placeholder: '300x200'
      })
    ])

    const fontSizeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'ph-font-size' }, ['字体大小']),
      createElement('select', { className: 'select', id: 'ph-font-size' }, [
        createElement('option', { value: '14' }, ['14px']),
        createElement('option', { value: '18' }, ['18px']),
        createElement('option', { value: '24' }, ['24px']),
        createElement('option', { value: '32', selected: 'true' }, ['32px']),
        createElement('option', { value: '48' }, ['48px']),
        createElement('option', { value: '64' }, ['64px'])
      ])
    ])

    const optionsRow = createElement('div', { className: 'form-row' }, [textGroup, fontSizeGroup])

    const canvas = createElement('canvas', { id: 'ph-canvas', className: 'placeholder-canvas' })
    const previewBox = createElement('div', { className: 'result-box placeholder-preview' }, [canvas])

    const svgOutput = createElement('textarea', {
      className: 'textarea',
      rows: '6',
      readonly: 'readonly',
      placeholder: '生成后显示 SVG 代码...'
    })

    const downloadBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '下载 PNG',
      onClick: downloadPng
    })

    const svgCopyBtn = createCopyButton(() => svgOutput.value)

    function generate() {
      const width = Math.max(1, Math.min(2000, parseInt(document.getElementById('ph-width').value) || 300))
      const height = Math.max(1, Math.min(2000, parseInt(document.getElementById('ph-height').value) || 200))
      const bgColor = document.getElementById('ph-bg-color').value
      const textColor = document.getElementById('ph-text-color').value
      const customText = document.getElementById('ph-text').value.trim()
      const fontSize = parseInt(document.getElementById('ph-font-size').value) || 32
      const displayText = customText || `${width}x${height}`

      canvas.width = width
      canvas.height = height
      canvas.setAttribute('width', width)
      canvas.setAttribute('height', height)

      const ctx = canvas.getContext('2d')
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, width, height)

      ctx.fillStyle = textColor
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(displayText, width / 2, height / 2)

      const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="sans-serif" font-size="${fontSize}" fill="${textColor}">${displayText}</text>
</svg>`
      svgOutput.value = svgCode
    }

    function downloadPng() {
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `placeholder-${canvas.width}x${canvas.height}.png`
      link.href = dataUrl
      link.click()
    }

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '生成',
      onClick: generate
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [generateBtn, downloadBtn])
    const svgSection = createSection('SVG 代码', svgOutput, [svgCopyBtn])

    container.appendChild(sizeRow)
    container.appendChild(colorRow)
    container.appendChild(optionsRow)
    container.appendChild(btnGroup)
    container.appendChild(previewBox)
    container.appendChild(svgSection)

    generate()
  }
}
