import { createElement, createSection } from '../../utils/dom.js'

const BROWSER_PATTERNS = [
  { name: 'Edge', regex: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
  { name: 'Opera', regex: /(?:OPR|Opera)\/([\d.]+)/ },
  { name: 'Vivaldi', regex: /Vivaldi\/([\d.]+)/ },
  { name: 'Brave', regex: /Brave\/([\d.]+)/ },
  { name: 'Chrome', regex: /(?:Chrome|CriOS)\/([\d.]+)/ },
  { name: 'Firefox', regex: /(?:Firefox|FxiOS)\/([\d.]+)/ },
  { name: 'Safari', regex: /Version\/([\d.]+).*Safari/ },
  { name: 'IE', regex: /(?:MSIE |Trident\/.*rv:)([\d.]+)/ }
]

const OS_PATTERNS = [
  { name: 'Windows 11', regex: /Windows NT 10\.0.*Build\/(\d{5,})/ },
  { name: 'Windows 10', regex: /Windows NT 10\.0/ },
  { name: 'Windows 8.1', regex: /Windows NT 6\.3/ },
  { name: 'Windows 8', regex: /Windows NT 6\.2/ },
  { name: 'Windows 7', regex: /Windows NT 6\.1/ },
  { name: 'Windows Vista', regex: /Windows NT 6\.0/ },
  { name: 'Windows XP', regex: /Windows NT 5\.1/ },
  { name: 'macOS', regex: /Mac OS X ([\d_]+)/ },
  { name: 'iOS', regex: /(?:iPhone|iPad|iPod).*OS ([\d_]+)/ },
  { name: 'Android', regex: /Android ([\d.]+)/ },
  { name: 'Linux', regex: /Linux/ },
  { name: 'Chrome OS', regex: /CrOS/ },
  { name: 'Ubuntu', regex: /Ubuntu/ }
]

const DEVICE_PATTERNS = [
  { type: '平板', regex: /iPad|Tablet/i },
  { type: '手机', regex: /Mobile|iPhone|Android.*Mobile/i },
  { type: '桌面', regex: /.*/ }
]

function parseUA(ua) {
  if (!ua || !ua.trim()) return null

  const result = {
    browser: '未知',
    version: '未知',
    os: '未知',
    osVersion: '',
    device: '未知'
  }

  // Browser
  for (const p of BROWSER_PATTERNS) {
    const m = ua.match(p.regex)
    if (m) {
      result.browser = p.name
      result.version = m[1] || ''
      break
    }
  }

  // OS
  for (const p of OS_PATTERNS) {
    const m = ua.match(p.regex)
    if (m) {
      result.os = p.name
      if (m[1]) {
        result.osVersion = m[1].replace(/_/g, '.')
      }
      break
    }
  }

  // Device
  for (const p of DEVICE_PATTERNS) {
    if (p.regex.test(ua)) {
      result.device = p.type
      break
    }
  }

  return result
}

export default {
  id: 'user-agent',
  name: 'User-Agent 解析',
  description: '解析 User-Agent 字符串，显示浏览器、操作系统和设备信息',
  category: 'devtool',
  icon: 'unicode',
  render(container) {
    const uaInput = createElement('textarea', {
      className: 'textarea',
      placeholder: '粘贴 User-Agent 字符串...',
      rows: 3
    })

    const parseBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '解析',
      onClick: doParse
    })

    const currentBtn = createElement('button', {
      className: 'btn',
      textContent: '使用当前浏览器',
      onClick: () => {
        uaInput.value = navigator.userAgent
        doParse()
      }
    })

    const btnRow = createElement('div', { className: 'btn-group' }, [parseBtn, currentBtn])

    const inputRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: 'User-Agent 字符串' }),
        uaInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: ' ' }),
        btnRow
      ])
    ])

    const errorEl = createElement('div', { className: 'error-text' })

    const browserValue = createElement('span', { className: 'stat-value' })
    const browserLabel = createElement('span', { className: 'stat-label', textContent: '浏览器' })
    const browserItem = createElement('div', { className: 'stat-item' }, [browserValue, browserLabel])

    const versionValue = createElement('span', { className: 'stat-value' })
    const versionLabel = createElement('span', { className: 'stat-label', textContent: '版本' })
    const versionItem = createElement('div', { className: 'stat-item' }, [versionValue, versionLabel])

    const osValue = createElement('span', { className: 'stat-value' })
    const osLabel = createElement('span', { className: 'stat-label', textContent: '操作系统' })
    const osItem = createElement('div', { className: 'stat-item' }, [osValue, osLabel])

    const deviceValue = createElement('span', { className: 'stat-value' })
    const deviceLabel = createElement('span', { className: 'stat-label', textContent: '设备类型' })
    const deviceItem = createElement('div', { className: 'stat-item' }, [deviceValue, deviceLabel])

    const resultBox = createElement('div', { className: 'result-box' }, [
      browserItem, versionItem, osItem, deviceItem
    ])

    const rawResult = createElement('div', { className: 'inline-result' })

    function doParse() {
      errorEl.textContent = ''
      const ua = uaInput.value.trim()

      if (!ua) {
        errorEl.textContent = '请输入 User-Agent 字符串'
        browserValue.textContent = ''
        versionValue.textContent = ''
        osValue.textContent = ''
        deviceValue.textContent = ''
        rawResult.textContent = ''
        return
      }

      const info = parseUA(ua)
      if (!info) return

      browserValue.textContent = info.browser
      versionValue.textContent = info.version || '-'
      osValue.textContent = info.osVersion ? `${info.os} ${info.osVersion}` : info.os
      deviceValue.textContent = info.device
      rawResult.textContent = ua
    }

    uaInput.addEventListener('input', doParse)

    const inputSection = createSection('输入', inputRow)
    const resultSection = createSection('解析结果', resultBox)
    const rawSection = createSection('原始字符串', rawResult)

    container.appendChild(inputSection)
    container.appendChild(errorEl)
    container.appendChild(resultSection)
    container.appendChild(rawSection)
  }
}
