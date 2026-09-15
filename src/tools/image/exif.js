import '../../styles/tools/drop-area.css'
import '../../styles/tools/image-preview.css'
import * as exifr from 'exifr'
import { createElement, createSection, createTableScroll } from '../../utils/dom.js'
import { downloadBlob } from '../../utils/download.js'

// Reading metadata is delegated to exifr. Stripping is done here so the tool
// never has to re-encode the image: JPEG APPn/COM segments and the PNG text
// chunks are simply cut out of the byte stream.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_DROPPED_CHUNKS = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'])
const JPEG_APP0 = 0xe0
const JPEG_SOS = 0xda
const JPEG_EOI = 0xd9

function asBytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  if (Array.isArray(value)) return new Uint8Array(value)
  throw new Error('需要 Uint8Array 形式的文件数据')
}

function concatChunks(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

export function isPng(bytes) {
  const data = asBytes(bytes)
  return data.length >= 8 && PNG_SIGNATURE.every((byte, index) => data[index] === byte)
}

export function isJpeg(bytes) {
  const data = asBytes(bytes)
  return data.length >= 2 && data[0] === 0xff && data[1] === 0xd8
}

// Walks the JPEG marker chain from SOI. APPn (0xFFE0-0xFFEF) and COM (0xFFFE)
// segments hold the metadata and are dropped; APP0/JFIF is kept by default
// because it carries the density information most decoders expect. SOS and
// everything after it is entropy-coded scan data and is copied verbatim.
export function stripJpegMetadata(bytes, { keepApp0 = true } = {}) {
  const data = asBytes(bytes)
  if (!isJpeg(data)) throw new Error('不是有效的 JPEG 数据（缺少 SOI 标记）')

  const chunks = [data.subarray(0, 2)]
  let index = 2

  while (index + 1 < data.length) {
    if (data[index] !== 0xff) {
      // Not a marker where one is expected — keep the remainder untouched
      // rather than corrupting an unusual file.
      chunks.push(data.subarray(index))
      break
    }

    const markerStart = index
    while (index < data.length && data[index] === 0xff) index++
    if (index >= data.length) break
    const marker = data[index]
    index++

    // Standalone markers carry no length field.
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(data.subarray(markerStart, index))
      continue
    }
    if (marker === JPEG_EOI) {
      chunks.push(data.subarray(markerStart, index))
      break
    }
    if (marker === JPEG_SOS) {
      chunks.push(data.subarray(markerStart))
      break
    }

    if (index + 1 >= data.length) break
    const length = (data[index] << 8) | data[index + 1]
    if (length < 2) break
    const end = Math.min(data.length, index + length)

    const isComment = marker === 0xfe
    const isApp = marker >= 0xe0 && marker <= 0xef
    const keepApp0Segment = keepApp0 && marker === JPEG_APP0
    if (!isComment && !(isApp && !keepApp0Segment)) {
      chunks.push(data.subarray(markerStart, end))
    }

    index = end
  }

  return concatChunks(chunks)
}

// PNG chunks are independently framed and CRC-checked, so dropping a whole
// ancillary chunk needs no recomputation.
export function stripPngMetadata(bytes) {
  const data = asBytes(bytes)
  if (!isPng(data)) throw new Error('不是有效的 PNG 数据（签名不匹配）')

  const chunks = [data.subarray(0, 8)]
  let index = 8

  while (index + 12 <= data.length) {
    const length = ((data[index] << 24) | (data[index + 1] << 16) | (data[index + 2] << 8) | data[index + 3]) >>> 0
    const type = String.fromCharCode(data[index + 4], data[index + 5], data[index + 6], data[index + 7])
    const end = index + 12 + length
    if (end > data.length) break
    if (!PNG_DROPPED_CHUNKS.has(type)) chunks.push(data.subarray(index, end))
    index = end
    if (type === 'IEND') break
  }

  if (index < data.length) chunks.push(data.subarray(index))
  return concatChunks(chunks)
}

// Picks the right stripper for the given bytes.
export function stripMetadata(bytes) {
  const data = asBytes(bytes)
  if (isPng(data)) return stripPngMetadata(data)
  if (isJpeg(data)) return stripJpegMetadata(data)
  throw new Error('只支持 JPEG 与 PNG 图片')
}

// --- Value formatters ------------------------------------------------------

export function formatExifDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = number => String(number).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
      `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }
  return value === undefined || value === null ? '' : String(value)
}

export function formatExposureTime(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return String(value ?? '')
  if (seconds >= 1) return `${Number(seconds.toFixed(2))} 秒`
  return `1/${Math.round(1 / seconds)} 秒`
}

export function decimalToDms(value, isLatitude = true) {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  const hemisphere = isLatitude ? (number >= 0 ? 'N' : 'S') : (number >= 0 ? 'E' : 'W')
  const absolute = Math.abs(number)
  const degrees = Math.floor(absolute)
  const minutesFloat = (absolute - degrees) * 60
  const minutes = Math.floor(minutesFloat)
  const seconds = (minutesFloat - minutes) * 60
  return `${degrees}°${String(minutes).padStart(2, '0')}'${seconds.toFixed(2).padStart(5, '0')}"${hemisphere}`
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const FIELD_LABELS = {
  Make: '品牌',
  Model: '机型',
  LensModel: '镜头',
  LensMake: '镜头品牌',
  ExposureTime: '曝光时间',
  FNumber: '光圈',
  ISO: 'ISO 感光度',
  FocalLength: '焦距',
  FocalLengthIn35mmFormat: '等效焦距',
  Flash: '闪光灯',
  ExposureProgram: '曝光程序',
  ExposureBiasValue: '曝光补偿',
  MeteringMode: '测光模式',
  WhiteBalance: '白平衡',
  DateTimeOriginal: '拍摄时间',
  CreateDate: '创建时间',
  ModifyDate: '修改时间',
  ImageWidth: '宽度',
  ImageHeight: '高度',
  ExifImageWidth: 'EXIF 宽度',
  ExifImageHeight: 'EXIF 高度',
  Orientation: '方向',
  XResolution: '水平分辨率',
  YResolution: '垂直分辨率',
  ColorSpace: '色彩空间',
  Software: '软件',
  Artist: '作者',
  Copyright: '版权',
  latitude: '纬度（十进制）',
  longitude: '经度（十进制）',
  GPSAltitude: '海拔',
  GPSSpeed: '速度',
  GPSImgDirection: '拍摄方向'
}

// `title` groups the rows; `keys` are exifr output tags.
export const METADATA_GROUPS = [
  { title: '相机', keys: ['Make', 'Model', 'LensMake', 'LensModel'] },
  {
    title: '曝光',
    keys: ['ExposureTime', 'FNumber', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat',
      'ExposureProgram', 'ExposureBiasValue', 'MeteringMode', 'WhiteBalance', 'Flash']
  },
  { title: '时间', keys: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] },
  {
    title: '图像',
    keys: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight', 'Orientation',
      'XResolution', 'YResolution', 'ColorSpace']
  },
  { title: '软件', keys: ['Software', 'Artist', 'Copyright'] },
  { title: 'GPS', keys: ['latitude', 'longitude', 'GPSAltitude', 'GPSSpeed', 'GPSImgDirection'] }
]

export function formatFieldValue(key, value) {
  if (value === undefined || value === null || value === '') return ''
  if (key === 'ExposureTime') return formatExposureTime(value)
  if (key === 'FNumber') return `f/${Number(value)}`
  if (key === 'FocalLength' || key === 'FocalLengthIn35mmFormat') return `${Number(value)} mm`
  if (key === 'DateTimeOriginal' || key === 'CreateDate' || key === 'ModifyDate') return formatExifDate(value)
  if (key === 'latitude') return `${Number(value).toFixed(6)}（${decimalToDms(value, true)}）`
  if (key === 'longitude') return `${Number(value).toFixed(6)}（${decimalToDms(value, false)}）`
  if (key === 'ExposureBiasValue') return `${Number(value)} EV`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Builds the grouped rows used by both the UI and the tests.
export function groupMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return []
  const groups = []
  for (const group of METADATA_GROUPS) {
    const rows = []
    for (const key of group.keys) {
      const formatted = formatFieldValue(key, metadata[key])
      if (formatted !== '') rows.push({ key, label: FIELD_LABELS[key] || key, value: formatted })
    }
    if (rows.length) groups.push({ title: group.title, rows })
  }
  return groups
}

export default {
  id: 'exif',
  name: '图片 EXIF',
  description: '查看图片的拍摄参数与 GPS 信息，并可一键清除元数据',
  category: 'image',
  icon: 'search',
  keywords: ['exif', '元数据', '拍摄参数', 'gps', '隐私', 'metadata'],
  render(container) {
    let currentFile = null

    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const errorEl = createElement('div', { className: 'error-text' })
    const stripReport = createElement('div', { className: 'form-hint' })
    const statsRow = createElement('div', { className: 'stats-row', hidden: true })

    const preview = createElement('img', { className: 'img-preview hidden', alt: '所选图片预览' })
    const previewPlaceholder = createElement('div', { className: 'preview-placeholder', textContent: '选择图片后在此预览' })
    const previewSection = createSection('图片预览', createElement('div', { className: 'img-preview-wrap' }, [
      previewPlaceholder,
      preview
    ]))

    const table = createElement('table', { className: 'result-table' })
    const tbody = createElement('tbody')
    table.appendChild(tbody)
    const tableSection = createSection('EXIF 元数据', createTableScroll(table, 'EXIF 元数据'))
    tableSection.hidden = true

    const stripButton = createElement('button', {
      className: 'btn btn-danger',
      type: 'button',
      textContent: '清除元数据并下载',
      disabled: true,
      onClick: () => { stripAndDownload() }
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        errorEl.textContent = ''
        status.textContent = '请点击上方区域选择一张带 EXIF 的 JPEG 或 PNG 图片作为示例'
      }
    })

    function setPreview(file) {
      if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl)
      const url = URL.createObjectURL(file)
      preview.dataset.objectUrl = url
      preview.src = url
      preview.classList.remove('hidden')
      previewPlaceholder.hidden = true
    }

    function renderStats(file) {
      statsRow.replaceChildren(
        createElement('span', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: '文件名：' }),
          createElement('span', { className: 'stat-value', textContent: file.name })
        ]),
        createElement('span', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: '类型：' }),
          createElement('span', { className: 'stat-value', textContent: file.type || '未知' })
        ]),
        createElement('span', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: '体积：' }),
          createElement('span', { className: 'stat-value', textContent: formatBytes(file.size) })
        ])
      )
      statsRow.hidden = false
    }

    function renderMetadata(metadata) {
      tbody.replaceChildren()
      const groups = groupMetadata(metadata)
      if (!groups.length) {
        tableSection.hidden = true
        status.textContent = '未在该图片中找到 EXIF 元数据'
        return
      }
      for (const group of groups) {
        tbody.appendChild(createElement('tr', {}, [
          createElement('th', { colSpan: 2, textContent: group.title })
        ]))
        for (const row of group.rows) {
          tbody.appendChild(createElement('tr', {}, [
            createElement('th', { scope: 'row', textContent: row.label }),
            createElement('td', { className: 'code-text', textContent: row.value })
          ]))
        }
      }
      tableSection.hidden = false
      status.textContent = `共读取到 ${groups.reduce((sum, group) => sum + group.rows.length, 0)} 项元数据`
    }

    async function processFile(file) {
      if (!file) return
      if (!String(file.type || '').startsWith('image/')) {
        errorEl.textContent = '请选择图片文件'
        return
      }
      currentFile = file
      errorEl.textContent = ''
      stripReport.textContent = ''
      status.textContent = '正在读取元数据…'
      setPreview(file)
      renderStats(file)
      stripButton.disabled = false

      try {
        const metadata = await exifr.parse(file)
        renderMetadata(metadata)
      } catch (cause) {
        tableSection.hidden = true
        status.textContent = ''
        errorEl.textContent = `读取元数据失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    async function stripAndDownload() {
      if (!currentFile) {
        errorEl.textContent = '请先选择图片'
        return
      }
      errorEl.textContent = ''
      try {
        const original = new Uint8Array(await currentFile.arrayBuffer())
        if (!isJpeg(original) && !isPng(original)) throw new Error('只支持 JPEG 与 PNG 图片')
        const cleaned = stripMetadata(original)
        const removed = original.length - cleaned.length
        const extension = isPng(original) ? 'png' : 'jpg'
        const baseName = (currentFile.name || 'image').replace(/\.[^.]+$/, '')
        downloadBlob(
          `${baseName}-clean.${extension}`,
          new Blob([cleaned], { type: isPng(original) ? 'image/png' : 'image/jpeg' })
        )
        stripReport.textContent = removed > 0
          ? `已移除 ${removed} 字节元数据（${formatBytes(original.length)} → ${formatBytes(cleaned.length)}）`
          : '该图片中没有可移除的元数据段'
      } catch (cause) {
        stripReport.textContent = ''
        errorEl.textContent = `清除元数据失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    const fileInput = createElement('input', {
      type: 'file',
      accept: 'image/jpeg,image/png,image/*',
      'aria-label': '选择要查看 EXIF 的图片',
      style: { display: 'none' },
      onChange: event => {
        if (event.target.files?.[0]) processFile(event.target.files[0])
      }
    })

    const dropArea = createElement('button', {
      className: 'drop-area',
      type: 'button',
      'aria-label': '选择图片，或将图片拖放到此处',
      onClick: () => fileInput.click(),
      onDragover: event => {
        event.preventDefault()
        dropArea.classList.add('dragover')
      },
      onDragleave: () => dropArea.classList.remove('dragover'),
      onDrop: event => {
        event.preventDefault()
        dropArea.classList.remove('dragover')
        const file = event.dataTransfer?.files?.[0]
        if (file) processFile(file)
      }
    }, [
      createElement('span', {
        className: 'drop-icon',
        'aria-hidden': 'true',
        innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>'
      }),
      createElement('span', { className: 'drop-content' }, [
        createElement('strong', { textContent: '选择一张 JPEG 或 PNG 图片' }),
        createElement('span', { className: 'drop-text', textContent: '也可以将图片拖放到此处，全部解析都在本地完成' })
      ])
    ])

    container.append(
      createElement('div', { className: 'privacy-notice', textContent: '🔒 图片仅在当前浏览器中解析，不会上传到服务器。' }),
      dropArea,
      fileInput,
      statsRow,
      createElement('div', { className: 'btn-group' }, [stripButton, sampleButton]),
      stripReport,
      errorEl,
      status,
      tableSection,
      previewSection
    )
  }
}
