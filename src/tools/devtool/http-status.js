import { createElement, createFilterGroup, createSection } from '../../utils/dom.js'

const STATUS_CODES = [
  // 1xx
  { code: 100, name: 'Continue', desc: '服务器已收到请求头，客户端应继续发送请求体' },
  { code: 101, name: 'Switching Protocols', desc: '服务器同意切换协议' },
  { code: 102, name: 'Processing', desc: '服务器已收到请求，正在处理中（WebDAV）' },
  { code: 103, name: 'Early Hints', desc: '服务器提前返回一些响应头，用于预加载资源' },

  // 2xx
  { code: 200, name: 'OK', desc: '请求成功，返回所请求的数据' },
  { code: 201, name: 'Created', desc: '请求成功，服务器创建了新的资源' },
  { code: 202, name: 'Accepted', desc: '请求已接受，但尚未处理完成' },
  { code: 204, name: 'No Content', desc: '请求成功，但没有返回任何内容' },
  { code: 206, name: 'Partial Content', desc: '服务器成功处理了部分 GET 请求（断点续传）' },

  // 3xx
  { code: 301, name: 'Moved Permanently', desc: '请求的资源已永久移动到新 URL' },
  { code: 302, name: 'Found', desc: '请求的资源临时从不同的 URL 响应' },
  { code: 303, name: 'See Other', desc: '请求的资源可以在另一个 URL 上找到（使用 GET）' },
  { code: 304, name: 'Not Modified', desc: '资源未修改，可使用缓存版本' },
  { code: 307, name: 'Temporary Redirect', desc: '请求临时重定向，保持原请求方法不变' },
  { code: 308, name: 'Permanent Redirect', desc: '请求永久重定向，保持原请求方法不变' },

  // 4xx
  { code: 400, name: 'Bad Request', desc: '请求语法错误或参数无效' },
  { code: 401, name: 'Unauthorized', desc: '需要身份验证（未登录或令牌无效）' },
  { code: 403, name: 'Forbidden', desc: '服务器拒绝请求（权限不足）' },
  { code: 404, name: 'Not Found', desc: '请求的资源不存在' },
  { code: 405, name: 'Method Not Allowed', desc: '请求方法不被允许（如对只读资源使用 POST）' },
  { code: 408, name: 'Request Timeout', desc: '服务器等待请求超时' },
  { code: 409, name: 'Conflict', desc: '请求与服务器当前状态冲突' },
  { code: 410, name: 'Gone', desc: '请求的资源已永久删除且不会恢复' },
  { code: 413, name: 'Payload Too Large', desc: '请求体大小超过服务器限制' },
  { code: 414, name: 'URI Too Long', desc: '请求的 URL 过长' },
  { code: 415, name: 'Unsupported Media Type', desc: '请求的媒体类型不被支持' },
  { code: 418, name: "I'm a Teapot", desc: '彩蛋状态码：我是茶壶' },
  { code: 422, name: 'Unprocessable Entity', desc: '请求格式正确，但语义错误（WebDAV）' },
  { code: 429, name: 'Too Many Requests', desc: '客户端发送了太多请求（限流）' },

  // 5xx
  { code: 500, name: 'Internal Server Error', desc: '服务器内部错误' },
  { code: 501, name: 'Not Implemented', desc: '服务器不支持请求的功能' },
  { code: 502, name: 'Bad Gateway', desc: '网关或代理服务器从上游收到无效响应' },
  { code: 503, name: 'Service Unavailable', desc: '服务器暂时不可用（过载或维护）' },
  { code: 504, name: 'Gateway Timeout', desc: '网关或代理服务器等待上游响应超时' },
  { code: 505, name: 'HTTP Version Not Supported', desc: '服务器不支持请求的 HTTP 版本' }
]

const CATEGORIES = [
  { label: '全部', prefix: '' },
  { label: '1xx 信息', prefix: '1' },
  { label: '2xx 成功', prefix: '2' },
  { label: '3xx 重定向', prefix: '3' },
  { label: '4xx 客户端错误', prefix: '4' },
  { label: '5xx 服务端错误', prefix: '5' }
]

function getCategoryClass(code) {
  const digit = String(code)[0]
  switch (digit) {
    case '1': return 'stat-label'
    case '2': return 'stat-label'
    case '3': return 'stat-label'
    case '4': return 'stat-label'
    case '5': return 'stat-label'
    default: return 'stat-label'
  }
}

function renderCodeItem(item) {
  return createElement('div', { className: 'status-code-item' }, [
    createElement('span', { className: 'status-code-number', textContent: String(item.code) }),
    createElement('div', { className: 'status-code-copy' }, [
      createElement('strong', { textContent: item.name }),
      createElement('span', { textContent: item.desc })
    ])
  ])
}

export default {
  id: 'http-status',
  name: 'HTTP 状态码查询',
  description: '查看所有 HTTP 状态码的含义和分类',
  category: 'devtool',
  icon: 'search',
  render(container) {
    let activePrefix = ''

    const searchInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '搜索状态码或描述（如 404、Not Found、缓存）...'
    })

    const searchRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '搜索' }),
        searchInput
      ])
    ])

    const listEl = createElement('div', { className: 'result-box' })

    const filterGroup = createFilterGroup(CATEGORIES.map(cat => ({ label: cat.label, value: cat.prefix })), value => {
      activePrefix = value
      renderList()
    }, { label: 'HTTP 状态码分类' })

    function renderList() {
      const query = searchInput.value.trim().toLowerCase()
      listEl.innerHTML = ''

      const filtered = STATUS_CODES.filter(item => {
        const matchesCategory = !activePrefix || String(item.code).startsWith(activePrefix)
        const matchesSearch = !query ||
          String(item.code).includes(query) ||
          item.name.toLowerCase().includes(query) ||
          item.desc.toLowerCase().includes(query)
        return matchesCategory && matchesSearch
      })

      if (filtered.length === 0) {
        listEl.textContent = '没有找到匹配的状态码'
        return
      }

      filtered.forEach(item => {
        listEl.appendChild(renderCodeItem(item))
      })
    }

    searchInput.addEventListener('input', renderList)
    renderList()

    const searchSection = createSection('搜索', searchRow)
    const tabSection = createSection('分类', filterGroup)
    const listSection = createSection('状态码列表', listEl)

    container.appendChild(searchSection)
    container.appendChild(tabSection)
    container.appendChild(listSection)
  }
}
