import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import QRCode from 'qrcode'

export default {
  id: 'qrcode',
  name: '二维码生成',
  description: '将文本或链接生成二维码',
  category: 'generator',
  icon: 'qrcode',
  render(container) {
    // Input textarea
    const inputLabel = createElement('label', { className: 'label' }, ['输入文本或链接'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要生成二维码的文本或链接...',
      rows: 4
    })

    // Size select
    const sizeLabel = createElement('label', { className: 'label' }, ['尺寸'])
    const sizeSelect = createElement('select', { className: 'select' }, [
      createElement('option', { value: '128' }, ['128 x 128']),
      createElement('option', { value: '256', selected: 'true' }, ['256 x 256']),
      createElement('option', { value: '512' }, ['512 x 512'])
    ])
    const sizeGroup = createElement('div', { className: 'form-group' }, [sizeLabel, sizeSelect])

    // Error correction level
    const eclLabel = createElement('label', { className: 'label' }, ['纠错级别'])
    const eclSelect = createElement('select', { className: 'select' }, [
      createElement('option', { value: 'L' }, ['L - 低 (7%)']),
      createElement('option', { value: 'M', selected: 'true' }, ['M - 中 (15%)']),
      createElement('option', { value: 'Q' }, ['Q - 较高 (25%)']),
      createElement('option', { value: 'H' }, ['H - 高 (30%)'])
    ])
    const eclGroup = createElement('div', { className: 'form-group' }, [eclLabel, eclSelect])

    const optionsRow = createElement('div', { className: 'form-row' }, [sizeGroup, eclGroup])

    // Canvas for QR code display
    const canvas = createElement('canvas', {
      className: 'qrcode-canvas'
    })

    // Status text
    const statusText = createElement('div', {
      className: 'qr-status-text'
    })

    const canvasWrapper = createElement('div', {
      className: 'qr-canvas-wrap'
    }, [canvas, statusText])

    // Generate function
    async function generate() {
      const text = inputTextarea.value.trim()
      if (!text) {
        statusText.textContent = '请输入文本或链接'
        canvas.classList.add('hidden')
        return
      }

      const size = parseInt(sizeSelect.value)
      const ecl = eclSelect.value

      try {
        statusText.textContent = '生成中...'
        canvas.classList.add('hidden')

        await QRCode.toCanvas(canvas, text, {
          width: size,
          errorCorrectionLevel: ecl,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        })

        canvas.classList.remove('hidden')
        statusText.textContent = `${size}x${size} | 纠错级别: ${ecl}`
      } catch (err) {
        statusText.textContent = '生成失败: ' + err.message
        canvas.classList.add('hidden')
      }
    }

    // Download as PNG
    function downloadPNG() {
      if (!canvas.width || !canvas.height) return
      const link = document.createElement('a')
      link.download = 'qrcode.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: generate
    }, ['生成二维码'])

    const downloadBtn = createElement('button', {
      className: 'btn btn-secondary',
      onClick: downloadPNG
    }, ['下载 PNG'])

    const btnGroup = createElement('div', { className: 'btn-group' }, [generateBtn, downloadBtn])

    container.appendChild(inputLabel)
    container.appendChild(inputTextarea)
    container.appendChild(optionsRow)
    container.appendChild(btnGroup)
    container.appendChild(canvasWrapper)
  }
}
