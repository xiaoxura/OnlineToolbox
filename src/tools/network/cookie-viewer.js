// Cookie header / Set-Cookie parser.
//
// The old tool could only list document.cookie for this site — which is empty
// for most visitors and useless for debugging a header copied from DevTools.
// Parsing pasted Cookie / Set-Cookie strings is the actually useful job.
import { createCopyButton, createElement, createSection, createTableScroll } from '../../utils/dom.js'

const ATTRIBUTE_NAMES = new Set(['expires', 'max-age', 'domain', 'path', 'secure', 'httponly', 'samesite', 'partitioned', 'priority'])

function splitIgnoringExpires(text) {
  // A Set-Cookie Expires value contains a comma ("Wed, 21 Oct 2025 …"). Only
  // treat a comma as a separator when the text after it does not continue a
  // date ("21 Oct 2025 …").
  const parts = []
  let current = ''
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === ',') {
      const rest = text.slice(index + 1)
      const continuesDate = /^\s*\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(rest)
      if (continuesDate && /;\s*expires\s*=/i.test(current)) {
        current += char
        continue
      }
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current)
  return parts.map(part => part.trim()).filter(Boolean)
}

function splitPairs(text) {
  return text.split(';').map(part => part.trim()).filter(Boolean)
}

export function parseCookieHeader(text) {
  return splitPairs(String(text ?? '').replace(/^cookie\s*:/i, ''))
    .map(pair => {
      const index = pair.indexOf('=')
      if (index < 0) return { name: pair.trim(), value: '', attributes: {} }
      return {
        name: pair.slice(0, index).trim(),
        value: pair.slice(index + 1).trim(),
        attributes: {}
      }
    })
    .filter(cookie => cookie.name)
}

export function parseSetCookie(text) {
  const cookies = []
  const blocks = String(text ?? '')
    .split(/\r?\n/)
    .flatMap(line => splitIgnoringExpires(line.replace(/^set-cookie\s*:/i, '')))
  for (const block of blocks) {
    const pairs = splitPairs(block)
    if (!pairs.length) continue
    const [first, ...rest] = pairs
    const index = first.indexOf('=')
    const cookie = index < 0
      ? { name: first.trim(), value: '', attributes: {} }
      : { name: first.slice(0, index).trim(), value: first.slice(index + 1).trim(), attributes: {} }
    if (!cookie.name) continue
    for (const pair of rest) {
      const eq = pair.indexOf('=')
      const key = (eq < 0 ? pair : pair.slice(0, eq)).trim().toLowerCase()
      if (!ATTRIBUTE_NAMES.has(key)) continue
      if (eq < 0) cookie.attributes[key] = true
      else cookie.attributes[key] = pair.slice(eq + 1).trim()
    }
    cookies.push(cookie)
  }
  return cookies
}

/** Auto-detect the input shape: Set-Cookie when attributes are present. */
export function parseCookies(text) {
  const value = String(text ?? '').trim()
  if (!value) return { kind: 'empty', cookies: [] }
  const isSetCookie = /;\s*(expires|max-age|domain|path|secure|httponly|samesite)\b/i.test(value)
    || /^set-cookie\s*:/i.test(value)
  return { kind: isSetCookie ? 'set-cookie' : 'header', cookies: isSetCookie ? parseSetCookie(value) : parseCookieHeader(value) }
}

function attributeSummary(cookie) {
  const attributes = cookie.attributes || {}
  const flags = []
  if (attributes.secure) flags.push('Secure')
  if (attributes.httponly) flags.push('HttpOnly')
  if (attributes.samesite) flags.push(`SameSite=${attributes.samesite}`)
  if (attributes.path) flags.push(`Path=${attributes.path}`)
  if (attributes.domain) flags.push(`Domain=${attributes.domain}`)
  if (attributes['max-age']) flags.push(`Max-Age=${attributes['max-age']}`)
  if (attributes.expires) flags.push(`Expires=${attributes.expires}`)
  return flags.join(' · ') || '—'
}

function cookieTable(cookies) {
  const table = createElement('table', { className: 'result-table' })
  table.append(
    createElement('thead', {}, [
      createElement('tr', {}, ['名称', '值', '属性', '操作'].map(label => createElement('th', { textContent: label })))
    ]),
    createElement('tbody', {}, cookies.map(cookie => createElement('tr', {}, [
      createElement('td', { className: 'code-text', textContent: cookie.name }),
      createElement('td', { className: 'code-text', textContent: cookie.value }),
      createElement('td', { textContent: attributeSummary(cookie) }),
      createElement('td', {}, [createCopyButton(() => `${cookie.name}=${cookie.value}`)])
    ])))
  )
  createTableScroll(table, 'Cookie 解析结果，可横向滚动')
  return table
}

const SAMPLE_SET_COOKIE = 'session_id=abc123; Path=/; Domain=example.com; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure; HttpOnly; SameSite=Lax\n'
  + 'theme=dark; Path=/; Max-Age=31536000; SameSite=None; Secure'
const SAMPLE_COOKIE_HEADER = 'session_id=abc123; theme=dark; lang=zh-CN'

export default {
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      placeholder: '粘贴 Cookie 请求头或 Set-Cookie 响应头，例如：\nsession_id=abc123; Path=/; HttpOnly\n\n也可以直接粘贴多条 Set-Cookie，每行一条。',
      rows: 10
    })
    const output = createElement('div', { className: 'tool-stack' })
    const error = createElement('div', { className: 'error-text' })
    const status = createElement('div', { className: 'form-hint', role: 'status', 'aria-live': 'polite' })

    function run() {
      error.textContent = ''
      output.replaceChildren()
      const parsed = parseCookies(input.value)
      if (parsed.kind === 'empty') {
        status.textContent = '请输入 Cookie 字符串'
        return
      }
      if (!parsed.cookies.length) {
        status.textContent = ''
        error.textContent = '没有解析到 Cookie，请检查格式（name=value; 属性=值）'
        return
      }
      status.textContent = `识别为 ${parsed.kind === 'set-cookie' ? 'Set-Cookie 响应头' : 'Cookie 请求头'} · ${parsed.cookies.length} 条`
      output.append(
        createSection('解析结果', cookieTable(parsed.cookies)),
        createSection('复制', createElement('pre', {
          className: 'code-block',
          textContent: parsed.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
        }))
      )
    }

    const parseButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '解析 Cookie',
      onClick: run
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例 Set-Cookie',
      onClick: () => {
        input.value = SAMPLE_SET_COOKIE
        run()
      }
    })
    const headerSampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例 Cookie 请求头',
      onClick: () => {
        input.value = SAMPLE_COOKIE_HEADER
        run()
      }
    })
    const readButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '读取本站 Cookie',
      title: '仅能读取当前页面中非 HttpOnly 的 Cookie',
      onClick: () => {
        input.value = document.cookie || ''
        run()
      }
    })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        input.value = ''
        output.replaceChildren()
        error.textContent = ''
        status.textContent = ''
        input.focus()
      }
    })

    container.append(
      createElement('div', { className: 'privacy-notice', textContent: '🔒 Cookie 字符串只在当前浏览器中解析，不会上传到服务器。' }),
      input,
      createElement('div', { className: 'btn-group form-action-row' }, [parseButton, sampleButton, headerSampleButton, readButton, clearButton]),
      status,
      error,
      output
    )
  }
}
