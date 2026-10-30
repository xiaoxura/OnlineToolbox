import '../../styles/tools/image-preview.css'
import { createElement, createSection, createTableScroll, createCopyButton } from '../../utils/dom.js'

// QR code decoding with a progressive fallback: BarcodeDetector when the
// browser provides it, otherwise the lazily imported jsQR decoder. The payload
// classifier below turns the decoded text into a small, human-readable table
// (URL, Wi-Fi credentials, vCard, mailto, tel, JSON or plain text).

const WIFI_ESCAPE = /\\([\\;,:"])/g
const VCARD_ESCAPE = /\\([\\,;nN])/g

export async function decodeQr(imageData) {
  if (
    !imageData ||
    !imageData.data ||
    !Number.isFinite(Number(imageData.width)) ||
    !Number.isFinite(Number(imageData.height)) ||
    Number(imageData.width) <= 0 ||
    Number(imageData.height) <= 0
  ) {
    throw new Error('需要有效的图片像素数据（ImageData）')
  }

  if (typeof globalThis.BarcodeDetector === 'function') {
    try {
      const detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] })
      const codes = await detector.detect(imageData)
      const value = codes?.find(code => code.rawValue)?.rawValue
      if (value) return value
    } catch {
      // Fall through to jsQR: some browsers expose BarcodeDetector but do not
      // support QR codes or ImageData input.
    }
  }

  const module = await import('jsqr')
  const jsQR = module.default ?? module
  const result = jsQR(imageData.data, Number(imageData.width), Number(imageData.height), {
    inversionAttempts: 'attemptBoth'
  })
  return result?.data ?? null
}

function splitEscaped(text, separator) {
  const parts = []
  let current = ''
  let escaped = false
  for (const char of text) {
    if (escaped) {
      current += char
      escaped = false
    } else if (char === '\\') {
      current += char
      escaped = true
    } else if (char === separator) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts
}

function splitKeyValue(text) {
  let escaped = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (escaped) {
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (char === ':') {
      return [text.slice(0, index), text.slice(index + 1)]
    }
  }
  return [text, '']
}

function unescapeWifi(value) {
  return value.replace(WIFI_ESCAPE, '$1')
}

function describeWifi(text) {
  const fields = { ssid: '', security: 'nopass', password: '', hidden: false }
  const body = text.slice(text.indexOf(':') + 1).replace(/;\s*$/, '')
  for (const part of splitEscaped(body, ';')) {
    if (!part) continue
    const [rawKey, rawValue] = splitKeyValue(part)
    const key = rawKey.trim().toUpperCase()
    const value = unescapeWifi(rawValue)
    if (key === 'S') fields.ssid = value
    else if (key === 'T') fields.security = value || 'nopass'
    else if (key === 'P') fields.password = value
    else if (key === 'H') fields.hidden = /^(true|1)$/i.test(value)
  }
  return { type: 'wifi', label: 'Wi-Fi 网络', fields }
}

function unescapeVCard(value) {
  return value.replace(VCARD_ESCAPE, (_match, char) => (char === 'n' || char === 'N' ? '\n' : char))
}

function describeVCard(text) {
  const unfolded = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '')
  const values = new Map()
  for (const line of unfolded.split('\n')) {
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).split(';')[0].trim().toUpperCase()
    if (!key || values.has(key)) continue
    values.set(key, unescapeVCard(line.slice(colon + 1)))
  }

  let name = values.get('FN') || ''
  if (!name && values.has('N')) {
    const [family = '', given = ''] = values.get('N').split(';')
    name = [given, family].filter(Boolean).join(' ').trim()
  }
  return {
    type: 'vcard',
    label: '联系人名片',
    fields: {
      name,
      org: values.get('ORG') || '',
      title: values.get('TITLE') || '',
      phone: values.get('TEL') || '',
      email: values.get('EMAIL') || '',
      url: values.get('URL') || ''
    }
  }
}

function describeUrl(text) {
  try {
    const parsed = new URL(text)
    return {
      type: 'url',
      label: '网址',
      fields: {
        url: text,
        protocol: parsed.protocol.replace(/:$/, ''),
        host: parsed.host,
        path: parsed.pathname,
        query: parsed.search.replace(/^\?/, ''),
        hash: parsed.hash.replace(/^#/, '')
      }
    }
  } catch {
    return {
      type: 'url',
      label: '网址',
      fields: { url: text, protocol: '', host: '', path: '', query: '', hash: '' }
    }
  }
}

function describeMailto(text) {
  const body = text.slice(text.indexOf(':') + 1)
  const questionMark = body.indexOf('?')
  const address = questionMark < 0 ? body : body.slice(0, questionMark)
  const query = questionMark < 0 ? '' : body.slice(questionMark + 1)
  const params = new URLSearchParams(query)
  let email = address
  try {
    email = decodeURIComponent(address)
  } catch {
    // Keep the raw address when it contains a malformed escape.
  }
  return {
    type: 'mailto',
    label: '电子邮件',
    fields: {
      email,
      subject: params.get('subject') || '',
      body: params.get('body') || ''
    }
  }
}

function describeTel(text) {
  const phone = text.slice(text.indexOf(':') + 1)
  let decoded = phone
  try {
    decoded = decodeURIComponent(phone)
  } catch {
    // Keep the raw value.
  }
  return { type: 'tel', label: '电话号码', fields: { phone: decoded } }
}

function describeJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (Array.isArray(parsed)) {
    return { type: 'json', label: 'JSON 数据', fields: { kind: '数组', count: parsed.length } }
  }
  if (parsed !== null && typeof parsed === 'object') {
    const keys = Object.keys(parsed)
    return { type: 'json', label: 'JSON 数据', fields: { kind: '对象', keys } }
  }
  return { type: 'json', label: 'JSON 数据', fields: { kind: typeof parsed } }
}

export function describeQrPayload(text) {
  const value = typeof text === 'string' ? text : String(text ?? '')
  const trimmed = value.trim()
  if (!trimmed) return { type: 'empty', label: '空内容', fields: {} }

  const lower = trimmed.toLowerCase()
  if (lower.startsWith('wifi:')) return describeWifi(trimmed)
  if (lower.startsWith('begin:vcard')) return describeVCard(trimmed)
  if (lower.startsWith('mailto:')) return describeMailto(trimmed)
  if (lower.startsWith('tel:')) return describeTel(trimmed)
  if (lower.startsWith('http://') || lower.startsWith('https://')) return describeUrl(trimmed)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const json = describeJson(trimmed)
    if (json) return json
  }
  return { type: 'text', label: '纯文本', fields: { text: trimmed, length: trimmed.length } }
}

export const QR_FIELD_LABELS = {
  url: '链接',
  protocol: '协议',
  host: '主机',
  path: '路径',
  query: '查询参数',
  hash: '片段',
  ssid: 'SSID',
  security: '加密方式',
  password: '密码',
  hidden: '隐藏网络',
  name: '姓名',
  org: '组织',
  title: '头衔',
  phone: '电话',
  email: '邮箱',
  subject: '主题',
  body: '正文',
  kind: '数据类型',
  keys: '顶层键',
  count: '元素数量',
  text: '内容',
  length: '长度'
}

function formatFieldValue(value) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.length ? value.join('、') : '（无）'
  if (value === null) return 'null'
  return String(value)
}

function drawToImageData(source, width, height) {
  if (!width || !height) throw new Error('图片尺寸无效，无法解码')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持 Canvas，无法读取图片像素')
  context.drawImage(source, 0, 0, width, height)
  try {
    return context.getImageData(0, 0, width, height)
  } catch {
    throw new Error('无法读取图片像素，图片可能来自跨域地址或格式不受支持')
  }
}

async function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败，请换一张 PNG/JPG 图片'))
    image.src = url
  })
}

async function readImageData(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      try {
        return drawToImageData(bitmap, bitmap.width, bitmap.height)
      } finally {
        bitmap.close?.()
      }
    } catch {
      // Fall back to an <img> element below.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImageElement(url)
    return drawToImageData(image, image.naturalWidth || image.width, image.naturalHeight || image.height)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default {
  render(container) {
    let currentFile = null
    let previewUrl = ''

    const fileInput = createElement('input', {
      className: 'input',
      type: 'file',
      accept: 'image/*',
      'aria-label': '选择二维码图片'
    })
    const accepted = /\.(png|jpe?g|gif|webp|bmp|avif)$/i

    const preview = createElement('img', { className: 'img-preview hidden', alt: '所选二维码图片预览' })
    const placeholder = createElement('div', { className: 'preview-placeholder', textContent: '选择或粘贴图片后在此预览' })

    const output = createElement('textarea', {
      className: 'textarea',
      rows: 6,
      readOnly: true,
      spellcheck: 'false',
      'aria-label': '二维码识别结果',
      placeholder: '识别出的二维码内容将显示在此…'
    })

    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const errorEl = createElement('div', { className: 'error-text' })

    const resultBody = createElement('tbody')
    const resultTable = createElement('table', { className: 'result-table' }, [
      createElement('thead', {}, [
        createElement('tr', {}, [createElement('th', { textContent: '字段' }), createElement('th', { textContent: '值' })])
      ]),
      resultBody
    ])
    const resultSection = createSection('解析结果', createTableScroll(resultTable, '二维码内容解析结果'))
    resultSection.hidden = true

    const recognizeButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '识别二维码',
      onClick: () => {
        recognize()
      }
    })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => reset()
    })
    const copyButton = createCopyButton(() => output.value)

    function reset() {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      previewUrl = ''
      currentFile = null
      fileInput.value = ''
      preview.removeAttribute('src')
      preview.classList.add('hidden')
      placeholder.hidden = false
      output.value = ''
      status.textContent = ''
      errorEl.textContent = ''
      resultBody.replaceChildren()
      resultSection.hidden = true
    }

    function selectFile(file) {
      if (!file) return
      if (!String(file.type || '').startsWith('image/') && !accepted.test(file.name || '')) {
        errorEl.textContent = '请选择图片文件（PNG、JPG、WebP 等）'
        return
      }
      currentFile = file
      errorEl.textContent = ''
      output.value = ''
      resultBody.replaceChildren()
      resultSection.hidden = true
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      previewUrl = URL.createObjectURL(file)
      preview.src = previewUrl
      preview.classList.remove('hidden')
      placeholder.hidden = true
      status.textContent = `已选择 ${file.name || '图片'}，点击「识别二维码」开始识别。`
    }

    function renderDescription(description) {
      resultBody.replaceChildren()
      resultBody.appendChild(
        createElement('tr', {}, [
          createElement('th', { scope: 'row', textContent: '类型' }),
          createElement('td', { textContent: description.label })
        ])
      )
      for (const [key, value] of Object.entries(description.fields)) {
        if (value === '' || value === null || value === undefined) continue
        resultBody.appendChild(
          createElement('tr', {}, [
            createElement('th', { scope: 'row', textContent: QR_FIELD_LABELS[key] || key }),
            createElement('td', { className: 'code-text', textContent: formatFieldValue(value) })
          ])
        )
      }
      resultSection.hidden = false
    }

    async function recognize() {
      if (!currentFile) {
        errorEl.textContent = '请先选择或粘贴二维码图片'
        return
      }
      errorEl.textContent = ''
      resultBody.replaceChildren()
      resultSection.hidden = true
      recognizeButton.disabled = true
      status.textContent = '正在读取图片并识别二维码…'
      try {
        const imageData = await readImageData(currentFile)
        const text = await decodeQr(imageData)
        if (text === null || text === undefined) {
          status.textContent = ''
          errorEl.textContent = '未在图片中识别到二维码，请换一张更清晰、完整的图片'
          return
        }
        output.value = text
        const description = describeQrPayload(text)
        renderDescription(description)
        status.textContent = `识别成功：${description.label}`
      } catch (cause) {
        status.textContent = ''
        errorEl.textContent = `识别失败：${cause instanceof Error ? cause.message : String(cause)}`
      } finally {
        recognizeButton.disabled = false
      }
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (file) selectFile(file)
    })

    container.addEventListener('paste', event => {
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (!String(item.type || '').startsWith('image/')) continue
        const file = item.getAsFile?.()
        if (!file) continue
        event.preventDefault()
        selectFile(file)
        return
      }
    })

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 图片与识别结果只在当前浏览器中处理，不会上传到服务器。'
      }),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '选择二维码图片（也可直接粘贴图片）' }),
        fileInput
      ]),
      createElement('div', { className: 'form-hint', textContent: '支持 PNG、JPG、WebP 等常见图片格式；图片越清晰，识别成功率越高。' }),
      createSection('图片预览', createElement('div', { className: 'img-preview-wrap' }, [placeholder, preview])),
      createElement('div', { className: 'btn-group' }, [recognizeButton, clearButton]),
      status,
      errorEl,
      createSection('二维码内容', output, [copyButton]),
      resultSection
    )
  }
}
