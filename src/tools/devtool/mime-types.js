import { createElement, createSection } from '../../utils/dom.js'

const MIME_TYPES = [
  ['html', 'text/html', '文档'], ['css', 'text/css', '样式'], ['js', 'text/javascript', '脚本'], ['json', 'application/json', '数据'],
  ['xml', 'application/xml', '数据'], ['csv', 'text/csv', '数据'], ['txt', 'text/plain', '文档'], ['md', 'text/markdown', '文档'],
  ['pdf', 'application/pdf', '文档'], ['zip', 'application/zip', '压缩'], ['gz', 'application/gzip', '压缩'], ['7z', 'application/x-7z-compressed', '压缩'],
  ['png', 'image/png', '图片'], ['jpg / jpeg', 'image/jpeg', '图片'], ['gif', 'image/gif', '图片'], ['webp', 'image/webp', '图片'], ['svg', 'image/svg+xml', '图片'], ['ico', 'image/x-icon', '图片'],
  ['mp3', 'audio/mpeg', '音频'], ['wav', 'audio/wav', '音频'], ['ogg', 'audio/ogg', '音频'], ['mp4', 'video/mp4', '视频'], ['webm', 'video/webm', '视频'],
  ['woff', 'font/woff', '字体'], ['woff2', 'font/woff2', '字体'], ['ttf', 'font/ttf', '字体'], ['otf', 'font/otf', '字体'],
  ['wasm', 'application/wasm', '开发'], ['form-data', 'multipart/form-data', '网络'], ['urlencoded', 'application/x-www-form-urlencoded', '网络'],
  ['doc', 'application/msword', '文档'], ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '文档'],
  ['xls', 'application/vnd.ms-excel', '文档'], ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '文档'],
  ['bin', 'application/octet-stream', '通用'], ['graphql', 'application/graphql', '开发'], ['yaml / yml', 'application/yaml', '数据']
]

export default {
  id: 'mime-types',
  name: 'MIME 类型查询',
  description: '按文件扩展名快速查找常用 MIME Content-Type',
  category: 'devtool',
  icon: 'search',
  render(container) {
    const search = createElement('input', { className: 'input', type: 'search', placeholder: '搜索扩展名或 MIME 类型...', 'aria-label': '搜索 MIME 类型' })
    const table = createElement('table', { className: 'result-table' })
    table.innerHTML = '<thead><tr><th>扩展名</th><th>MIME 类型</th><th>类别</th></tr></thead><tbody></tbody>'
    const tbody = table.querySelector('tbody')
    const renderRows = () => {
      const query = search.value.trim().toLowerCase()
      tbody.replaceChildren(...MIME_TYPES.filter(([extension, mime, category]) => !query || `${extension} ${mime} ${category}`.toLowerCase().includes(query)).map(([extension, mime, category]) => createElement('tr', {}, [
        createElement('td', { className: 'code-text', textContent: extension }),
        createElement('td', { className: 'code-text', textContent: mime }),
        createElement('td', { textContent: category })
      ])))
    }
    search.addEventListener('input', renderRows)
    renderRows()
    container.append(
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '查找类型' }), search]),
      createSection('常用 MIME 类型', createElement('div', { className: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'MIME 类型表格' }, [table]))
    )
  }
}
