import '../../styles/tools/svg-converter.css'
import { createElement, createSection, createTabGroup, createCopyButton } from '../../utils/dom.js'
import { downloadBlob } from '../../utils/download.js'

// SVG conversion helpers. The JSX writer parses XML with DOMParser (so
// namespaces and entities behave like the browser) and strips active content
// before serialising.

const DANGEROUS_TAGS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'link', 'meta'])
const SPECIAL_ATTRIBUTES = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck'
}

function parseSvgDocument(svg) {
  const source = String(svg ?? '').trim()
  if (!source) throw new Error('请先粘贴 SVG 代码')
  if (typeof DOMParser !== 'function') throw new Error('当前环境不支持 SVG 解析')
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  const parserErrors = document.getElementsByTagName('parsererror')
  if (parserErrors.length) throw new Error('SVG 解析失败，请检查标签是否完整闭合')
  const root = document.documentElement
  if (!root || root.localName?.toLowerCase() !== 'svg') throw new Error('SVG 根元素必须是 <svg>')
  return { document, root }
}

function sanitizeElement(element) {
  for (const child of [...element.children]) {
    if (DANGEROUS_TAGS.has(child.localName.toLowerCase())) child.remove()
    else sanitizeElement(child)
  }
  for (const attribute of [...element.attributes]) {
    const name = attribute.name
    const lower = name.toLowerCase()
    const value = attribute.value
    if (lower.startsWith('on')) {
      element.removeAttribute(name)
      continue
    }
    if (/(?:href|src)$/i.test(lower) && /^\s*javascript:/i.test(value)) {
      element.removeAttribute(name)
      continue
    }
    if (lower === 'style' && /javascript:/i.test(value)) element.removeAttribute(name)
  }
}

function sanitizeSvg(svg) {
  const { root } = parseSvgDocument(svg)
  sanitizeElement(root)
  return new XMLSerializer().serializeToString(root)
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function toJsxAttributeName(name) {
  if (name === 'class') return 'className'
  if (SPECIAL_ATTRIBUTES[name.toLowerCase()]) return SPECIAL_ATTRIBUTES[name.toLowerCase()]
  if (/^(?:data|aria)-/.test(name)) return name
  if (name === 'xmlns') return 'xmlns'
  if (name.startsWith('xmlns:')) return `xmlns${capitalize(name.slice(6))}`
  if (name.includes(':')) {
    const [prefix, local] = name.split(':')
    return `${prefix}${capitalize(local)}`
  }
  return name.replace(/-([a-z])/g, (_, character) => character.toUpperCase())
}

function escapeJsxAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeJsxString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

function styleToJsx(style) {
  const declarations = String(style)
    .split(';')
    .map(declaration => declaration.trim())
    .filter(Boolean)
  const properties = []
  for (const declaration of declarations) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue
    const property = declaration.slice(0, separator).trim()
    const value = declaration.slice(separator + 1).trim()
    if (!property || !value) continue
    const key = property.startsWith('--')
      ? `'${escapeJsxString(property)}'`
      : property.replace(/-([a-z])/g, (_, character) => character.toUpperCase())
    properties.push(`${key}: '${escapeJsxString(value)}'`)
  }
  return properties.length ? `{{ ${properties.join(', ')} }}` : ''
}

function escapeJsxText(value) {
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '{': "{'{'}",
    '}': "{'}'}"
  }
  return String(value).replace(/[&<>{}]/g, character => replacements[character])
}

function serializeElement(element, depth) {
  const indent = '  '.repeat(depth)
  const tag = element.localName || element.nodeName
  const attributes = []
  for (const attribute of element.attributes) {
    if (attribute.name.toLowerCase() === 'style') {
      const style = styleToJsx(attribute.value)
      if (style) attributes.push(` style=${style}`)
      continue
    }
    attributes.push(` ${toJsxAttributeName(attribute.name)}="${escapeJsxAttribute(attribute.value)}"`)
  }

  const children = [...element.childNodes].filter(node => {
    if (node.nodeType === 1) return true
    return node.nodeType === 3 && node.nodeValue.trim()
  })

  if (!children.length) return `${indent}<${tag}${attributes.join('')} />`

  const body = children
    .map(node => {
      if (node.nodeType === 3) return `${indent}  ${escapeJsxText(node.nodeValue.trim())}`
      return serializeElement(node, depth + 1)
    })
    .join('\n')
  return `${indent}<${tag}${attributes.join('')}>\n${body}\n${indent}</${tag}>`
}

export function svgToDataUrl(svg, mime = 'image/svg+xml') {
  return `data:${mime};charset=utf-8,${encodeURIComponent(String(svg ?? ''))}`
}

export function svgToJsx(svg) {
  const { root } = parseSvgDocument(svg)
  sanitizeElement(root)
  return serializeElement(root, 0)
}

function parseLength(value) {
  if (value === null || value === undefined) return null
  const match = /^\s*(\d*\.?\d+)(?:px)?\s*$/i.exec(String(value))
  if (!match) return null
  const number = Number(match[1])
  return Number.isFinite(number) && number > 0 ? number : null
}

function parseViewBox(value) {
  if (!value) return null
  const parts = String(value)
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isFinite(part))) return null
  if (parts[2] <= 0 || parts[3] <= 0) return null
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

export function normalizeSvgSize(svg) {
  const { root } = parseSvgDocument(svg)
  const viewBoxValue = root.getAttribute('viewBox')
  const viewBox = parseViewBox(viewBoxValue)
  const width = parseLength(root.getAttribute('width')) ?? viewBox?.width ?? 300
  const height = parseLength(root.getAttribute('height')) ?? viewBox?.height ?? 150
  return { width, height }
}

export default {
  render(container) {
    const svgInput = createElement('textarea', {
      className: 'textarea large',
      id: 'sc-svg-input',
      rows: '12',
      placeholder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">…</svg>',
      'aria-label': 'SVG 代码'
    })

    const fileInput = createElement('input', {
      className: 'input',
      type: 'file',
      accept: '.svg,image/svg+xml',
      id: 'sc-file',
      onChange: event => {
        const file = event.target.files?.[0]
        if (file) loadFile(file)
      }
    })

    const widthInput = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'sc-width',
      min: '1',
      step: '1',
      placeholder: '自动'
    })
    const heightInput = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'sc-height',
      min: '1',
      step: '1',
      placeholder: '自动'
    })
    const scaleInput = createElement('input', {
      className: 'input',
      type: 'number',
      id: 'sc-scale',
      min: '1',
      max: '1000',
      step: '1',
      value: '100'
    })
    const backgroundSelect = createElement('select', { className: 'select', id: 'sc-background' }, [
      createElement('option', { value: 'transparent', textContent: '透明' }),
      createElement('option', { value: 'white', textContent: '白色' })
    ])

    const convertButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '转换',
      onClick: convert
    })
    const exampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例 SVG',
      onClick: useExample
    })

    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const error = createElement('div', { className: 'error-text' })

    const pngCanvas = createElement('canvas', {
      className: 'svg-png-canvas hidden',
      width: '320',
      height: '180',
      role: 'img',
      'aria-label': 'SVG 转 PNG 渲染结果'
    })
    const pngHint = createElement('div', { className: 'form-hint' })
    const pngError = createElement('div', { className: 'error-text' })
    const downloadPng = createElement('button', {
      className: 'btn btn-success',
      type: 'button',
      textContent: '下载 PNG',
      disabled: true
    })

    const jsxOutput = createElement('textarea', {
      className: 'textarea',
      rows: '12',
      readOnly: true,
      'aria-label': 'JSX 输出'
    })
    const jsxCopy = createCopyButton(() => jsxOutput.value)

    const dataOutput = createElement('textarea', {
      className: 'textarea',
      rows: '8',
      readOnly: true,
      'aria-label': 'Data URI 输出'
    })
    const dataCopy = createCopyButton(() => dataOutput.value)

    const tabs = createTabGroup(
      [
        {
          value: 'png',
          label: 'PNG',
          content: panel =>
            panel.append(
              createElement('div', { className: 'tool-stack' }, [
                createElement('div', { className: 'svg-png-preview' }, [pngCanvas]),
                pngHint,
                pngError,
                createElement('div', { className: 'btn-group' }, [downloadPng])
              ])
            )
        },
        {
          value: 'jsx',
          label: 'JSX',
          content: panel =>
            panel.append(
              createElement('div', { className: 'tool-stack' }, [jsxOutput, createElement('div', { className: 'btn-group' }, [jsxCopy])])
            )
        },
        {
          value: 'data-uri',
          label: 'Data URI',
          content: panel =>
            panel.append(
              createElement('div', { className: 'tool-stack' }, [dataOutput, createElement('div', { className: 'btn-group' }, [dataCopy])])
            )
        }
      ],
      () => {},
      { label: '输出格式' }
    )

    let pngBlob = null

    function setPngError(message) {
      pngBlob = null
      downloadPng.disabled = true
      pngCanvas.classList.add('hidden')
      pngHint.textContent = ''
      pngError.textContent = message
    }

    function resolveOutputSize(size) {
      const baseWidth = size.width
      const baseHeight = size.height
      const requestedWidth = Number(widthInput.value)
      const requestedHeight = Number(heightInput.value)
      const hasWidth = Number.isFinite(requestedWidth) && requestedWidth > 0
      const hasHeight = Number.isFinite(requestedHeight) && requestedHeight > 0
      let width
      let height
      if (hasWidth && hasHeight) {
        width = requestedWidth
        height = requestedHeight
      } else if (hasWidth) {
        width = requestedWidth
        height = (requestedWidth * baseHeight) / baseWidth
      } else if (hasHeight) {
        height = requestedHeight
        width = (requestedHeight * baseWidth) / baseHeight
      } else {
        width = baseWidth
        height = baseHeight
      }
      const scale = Math.max(1, Math.min(1000, Number(scaleInput.value) || 100)) / 100
      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
      }
    }

    function toBlob(canvas) {
      return new Promise((resolve, reject) => {
        if (typeof canvas.toBlob !== 'function') {
          reject(new Error('当前浏览器不支持 PNG 导出，请更换浏览器后重试'))
          return
        }
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG 编码失败'))), 'image/png')
      })
    }

    async function renderPng(svg) {
      const size = resolveOutputSize(normalizeSvgSize(svg))
      const parsed = parseSvgDocument(svg)
      if (!parsed.root.getAttribute('xmlns')) {
        throw new Error('SVG 缺少 xmlns 命名空间，无法渲染为 PNG')
      }
      sanitizeElement(parsed.root)
      parsed.root.setAttribute('width', String(size.width))
      parsed.root.setAttribute('height', String(size.height))
      const serialized = new XMLSerializer().serializeToString(parsed.root)

      if (typeof createImageBitmap !== 'function') throw new Error('当前浏览器不支持 SVG 位图渲染')
      const bitmap = await createImageBitmap(new Blob([serialized], { type: 'image/svg+xml' }))
      try {
        pngCanvas.width = size.width
        pngCanvas.height = size.height
        const context = pngCanvas.getContext('2d')
        if (!context) throw new Error('当前浏览器不支持画布绘制')
        context.clearRect(0, 0, size.width, size.height)
        if (backgroundSelect.value === 'white') {
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, size.width, size.height)
        }
        context.drawImage(bitmap, 0, 0, size.width, size.height)
      } finally {
        bitmap.close?.()
      }

      pngBlob = await toBlob(pngCanvas)
      pngCanvas.classList.remove('hidden')
      pngError.textContent = ''
      pngHint.textContent = `已渲染 ${size.width} × ${size.height}px PNG，可下载。`
      downloadPng.disabled = false
      return size
    }

    async function convert() {
      error.textContent = ''
      const source = svgInput.value.trim()
      if (!source) {
        error.textContent = '请先粘贴 SVG 代码或上传 .svg 文件'
        return
      }
      status.textContent = '正在转换 SVG…'
      try {
        const safeSvg = sanitizeSvg(source)
        jsxOutput.value = svgToJsx(safeSvg)
        dataOutput.value = svgToDataUrl(safeSvg)
        try {
          const size = await renderPng(safeSvg)
          status.textContent = `转换完成：PNG ${size.width} × ${size.height}px，JSX 与 Data URI 已生成。`
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause)
          setPngError(`PNG 渲染失败：${message}`)
          status.textContent = 'JSX 与 Data URI 已生成，PNG 渲染失败。'
        }
      } catch (cause) {
        status.textContent = ''
        error.textContent = `转换失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    function useExample() {
      svgInput.value =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">\n' +
        '  <defs>\n' +
        '    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">\n' +
        '      <stop offset="0%" stop-color="#dbeafe" />\n' +
        '      <stop offset="100%" stop-color="#93c5fd" />\n' +
        '    </linearGradient>\n' +
        '  </defs>\n' +
        '  <rect width="120" height="80" fill="url(#sky)" />\n' +
        '  <circle cx="88" cy="22" r="12" class="sun" style="fill: #fbbf24; stroke-width: 2" />\n' +
        '  <path d="M0 64 L28 40 L52 64 Z" fill="#22c55e" stroke-width="2" stroke="#166534" />\n' +
        '  <text x="60" y="74" text-anchor="middle" fill="#0f172a">你好 SVG</text>\n' +
        '</svg>'
      status.textContent = '已填入示例 SVG，点击“转换”查看三种输出。'
      error.textContent = ''
    }

    async function readFileText(file) {
      if (typeof file.text === 'function') return file.text()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('读取 SVG 文件失败'))
        reader.readAsText(file, 'utf-8')
      })
    }

    async function loadFile(file) {
      if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
        error.textContent = '请选择 .svg 文件'
        return
      }
      try {
        svgInput.value = await readFileText(file)
        error.textContent = ''
        status.textContent = `已载入 ${file.name}，点击“转换”生成结果。`
      } catch (cause) {
        error.textContent = `读取文件失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    downloadPng.addEventListener('click', () => {
      if (pngBlob) downloadBlob('converted.png', pngBlob)
    })

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 SVG 代码仅在当前浏览器中解析与渲染，不会上传到服务器。'
      }),
      createSection(
        'SVG 输入',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', for: 'sc-file', textContent: '上传 .svg 文件（可选）' }),
            fileInput
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label', for: 'sc-svg-input', textContent: '或直接粘贴 SVG 代码' }),
            svgInput
          ])
        ])
      ),
      createSection(
        '输出尺寸',
        createElement('div', { className: 'tool-stack' }, [
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'sc-width', textContent: '宽度（px，留空自动）' }),
              widthInput
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'sc-height', textContent: '高度（px，留空自动）' }),
              heightInput
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'sc-scale', textContent: '缩放（%）' }),
              scaleInput
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', for: 'sc-background', textContent: 'PNG 背景' }),
              backgroundSelect
            ])
          ]),
          createElement('div', { className: 'btn-group' }, [convertButton, exampleButton]),
          error,
          status
        ])
      ),
      createSection('转换结果', tabs.element)
    )
  }
}
