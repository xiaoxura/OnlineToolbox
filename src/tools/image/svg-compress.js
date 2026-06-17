import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

export default {
  id: 'svg-compress',
  name: 'SVG 压缩',
  description: '压缩 SVG 代码，移除冗余内容',
  category: 'image',
  icon: 'html',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      placeholder: '粘贴 SVG 代码...'
    })

    const output = createElement('textarea', {
      className: 'textarea large',
      readOnly: true,
      placeholder: '压缩后的 SVG 将显示在这里...'
    })

    const sizeInfo = createElement('div', { className: 'inline-result' })

    function compressSVG(svg) {
      let result = svg

      // Remove comments
      result = result.replace(/<!--[\s\S]*?-->/g, '')

      // Remove metadata
      result = result.replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
      result = result.replace(/<\?xml[^?]*\?>/gi, '')

      // Remove editor namespaces
      const nsList = [
        'inkscape', 'sodipodi', 'sketch', 'adobe', 'illustrator',
        'xmlns:inkscape', 'xmlns:sodipodi', 'xmlns:sketch',
        'xmlns:dc', 'xmlns:cc', 'xmlns:rdf'
      ]
      nsList.forEach(ns => {
        const re = new RegExp('\\s+' + ns + ':[a-zA-Z-]+="[^"]*"', 'gi')
        result = result.replace(re, '')
      })

      // Remove empty groups
      result = result.replace(/<g>\s*<\/g>/gi, '')

      // Remove editor-specific elements
      result = result.replace(/<sodipodi:[^>]*\/?>[\s\S]*?<\/sodipodi:[^>]*>/gi, '')
      result = result.replace(/<sodipodi:[^>]*\/>/gi, '')
      result = result.replace(/<inkscape:[^>]*\/?>[\s\S]*?<\/inkscape:[^>]*>/gi, '')
      result = result.replace(/<inkscape:[^>]*\/>/gi, '')

      // Remove unnecessary attributes
      const removeAttrs = [
        'data-name', 'id', 'class',
        'xml:space', 'enable-background',
        'xmlns:xlink', 'xml:lang'
      ]
      removeAttrs.forEach(attr => {
        const re = new RegExp('\\s+' + attr.replace(':', '\\:') + '="[^"]*"', 'gi')
        result = result.replace(re, '')
      })

      // Remove excess whitespace
      result = result.replace(/\n\s*/g, '')
      result = result.replace(/\s{2,}/g, ' ')
      result = result.replace(/>\s+</g, '><')
      result = result.trim()

      return result
    }

    const compressBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '压缩',
      onClick: () => {
        const svg = input.value.trim()
        if (!svg) return

        const compressed = compressSVG(svg)
        output.value = compressed

        const before = new Blob([svg]).size
        const after = new Blob([compressed]).size
        const ratio = before > 0 ? ((1 - after / before) * 100).toFixed(1) : 0

        sizeInfo.innerHTML = ''
        const stats = [
          { label: '原始大小', value: before + ' B' },
          { label: '压缩后', value: after + ' B' },
          { label: '压缩率', value: ratio + '%' }
        ]
        stats.forEach(s => {
          const item = createElement('span', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: s.label + ': ' }),
            createElement('span', { className: 'stat-value', textContent: s.value })
          ])
          sizeInfo.appendChild(item)
        })
      }
    })

    const copyBtn = createCopyButton(() => output.value)
    const btnGroup = createElement('div', { className: 'btn-group' }, [compressBtn, copyBtn])

    const inputSection = createSection('SVG 输入', input)
    const outputSection = createSection('压缩结果', output, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(btnGroup)
    container.appendChild(sizeInfo)
    container.appendChild(outputSection)
  }
}
