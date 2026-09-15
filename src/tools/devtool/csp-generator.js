import { createElement, createSection } from '../../utils/dom.js'

// Content-Security-Policy builder. Output shape (kept in the canonical
// directive order of the CSP spec so the result is stable):
//   buildCsp({ sources: { 'default-src': ["'self'"] }, flags: ['upgrade-insecure-requests'], reportUri: '/csp-report' })

export const DIRECTIVES = [
  { name: 'default-src', kind: 'source', hint: '其他指令的回退策略' },
  { name: 'script-src', kind: 'source' },
  { name: 'style-src', kind: 'source' },
  { name: 'img-src', kind: 'source' },
  { name: 'font-src', kind: 'source' },
  { name: 'connect-src', kind: 'source', hint: 'fetch / XHR / WebSocket' },
  { name: 'media-src', kind: 'source' },
  { name: 'object-src', kind: 'source' },
  { name: 'frame-src', kind: 'source' },
  { name: 'worker-src', kind: 'source' },
  { name: 'manifest-src', kind: 'source' },
  { name: 'base-uri', kind: 'source' },
  { name: 'form-action', kind: 'source' },
  { name: 'frame-ancestors', kind: 'source' },
  { name: 'upgrade-insecure-requests', kind: 'flag' },
  { name: 'block-all-mixed-content', kind: 'flag' }
]

// 常用的快捷来源（chips）
export const SOURCE_CHIPS = ["'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", 'data:', 'blob:', 'https:']

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildCsp(config) {
  const settings = config || {}
  const sources = settings.sources || {}
  const flags = new Set(settings.flags || [])
  const parts = []

  for (const directive of DIRECTIVES) {
    if (directive.kind === 'flag') {
      if (flags.has(directive.name)) parts.push(directive.name)
      continue
    }
    const list = sources[directive.name]
    if (!Array.isArray(list)) continue
    const tokens = [...new Set(list.map(token => String(token).trim()).filter(Boolean))]
    if (!tokens.length) continue
    parts.push(`${directive.name} ${tokens.join(' ')}`)
  }

  const reportUri = String(settings.reportUri ?? '').trim()
  if (reportUri) parts.push(`report-uri ${reportUri}`)

  const value = parts.join('; ')
  return {
    value,
    header: `Content-Security-Policy: ${value}`,
    meta: `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(value)}">`,
    nginx: `add_header Content-Security-Policy "${value}" always;`,
    empty: parts.length === 0
  }
}

const PRESETS = {
  strict: {
    sources: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"]
    },
    flags: ['upgrade-insecure-requests']
  },
  loose: {
    sources: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
      'style-src': ["'self'", "'unsafe-inline'", 'https:'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:'],
      'object-src': ["'none'"]
    },
    flags: []
  }
}

export default {
  id: 'csp-generator',
  name: 'CSP 生成器',
  description: '勾选指令生成 Content-Security-Policy 响应头',
  category: 'devtool',
  icon: 'shield-link',
  keywords: ['csp', 'content-security-policy', '安全响应头', 'xss'],
  render(container) {
    // 当前配置：指令 → 来源列表；以及无取值指令的开关集合
    const sourceState = new Map()
    const flagState = new Set()
    const rows = new Map()

    const valueOutput = createElement('textarea', { className: 'textarea', rows: 4, readOnly: true, placeholder: 'CSP 指令值…' })
    const metaOutput = createElement('textarea', { className: 'textarea', rows: 3, readOnly: true, placeholder: 'meta 标签…' })
    const nginxOutput = createElement('textarea', { className: 'textarea', rows: 3, readOnly: true, placeholder: 'nginx 配置…' })
    const errorEl = createElement('div', { className: 'error-text' })

    const reportInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '如 /csp-report（留空则不输出该指令）'
    })
    reportInput.addEventListener('input', update)

    function update() {
      const sources = {}
      for (const [name, tokens] of sourceState) {
        if (tokens.length) sources[name] = tokens
      }
      const result = buildCsp({
        sources,
        flags: [...flagState],
        reportUri: reportInput.value
      })
      // Nothing selected: keep the three outputs empty instead of showing
      // half-built snippets, and say what is missing.
      valueOutput.value = result.empty ? '' : result.value
      metaOutput.value = result.empty ? '' : result.meta
      nginxOutput.value = result.empty ? '' : result.nginx
      errorEl.textContent = result.empty ? '请至少选择一条指令并添加来源' : ''
    }

    // 某条指令的来源编辑面板：快捷 chip + 自定义主机 + 已选来源（可点击移除）
    function createSources(name) {
      const list = sourceState.get(name)

      const chipGroup = createElement('div', { className: 'btn-group' }, SOURCE_CHIPS.map(token => createElement('button', {
        className: 'btn btn-secondary btn-sm',
        type: 'button',
        textContent: token,
        title: `添加 ${token}`,
        onClick: () => {
          if (!list.includes(token)) list.push(token)
          renderSelected()
          update()
        }
      })))

      const hostInput = createElement('input', {
        className: 'input',
        type: 'text',
        placeholder: '如 https://cdn.example.com',
        'aria-label': `${name} 自定义来源`
      })
      const addBtn = createElement('button', {
        className: 'btn btn-secondary',
        type: 'button',
        textContent: '添加',
        onClick: () => {
          const token = hostInput.value.trim()
          if (!token) return
          if (!list.includes(token)) list.push(token)
          hostInput.value = ''
          renderSelected()
          update()
        }
      })

      const selectedGroup = createElement('div', { className: 'btn-group' })

      function renderSelected() {
        if (!list.length) {
          selectedGroup.replaceChildren(createElement('span', {
            className: 'form-hint',
            textContent: '尚未添加来源，该指令不会出现在结果中'
          }))
          return
        }
        selectedGroup.replaceChildren(...list.map(token => createElement('button', {
          className: 'btn btn-secondary btn-sm',
          type: 'button',
          textContent: `${token} ✕`,
          title: `移除 ${token}`,
          onClick: () => {
            const index = list.indexOf(token)
            if (index >= 0) list.splice(index, 1)
            renderSelected()
            update()
          }
        })))
      }
      renderSelected()

      return createElement('div', { className: 'tool-stack' }, [
        chipGroup,
        createElement('div', { className: 'form-row' }, [hostInput, addBtn]),
        selectedGroup
      ])
    }

    function buildRow(directive) {
      const isSource = directive.kind === 'source'
      const isFlag = directive.kind === 'flag'

      const box = createElement('input', { className: 'checkbox', type: 'checkbox' })
      const details = createElement('div', { className: 'tool-stack' })
      details.hidden = true

      box.addEventListener('change', () => {
        if (isFlag) {
          if (box.checked) flagState.add(directive.name)
          else flagState.delete(directive.name)
        } else if (box.checked) {
          if (!sourceState.has(directive.name)) sourceState.set(directive.name, [])
          details.replaceChildren(createSources(directive.name))
        } else {
          sourceState.delete(directive.name)
        }
        details.hidden = !box.checked
        update()
      })

      const label = createElement('label', { className: 'option-item' }, [
        box,
        createElement('span', { className: 'code-text', textContent: directive.name }),
        directive.hint ? createElement('span', { className: 'sub-label', textContent: directive.hint }) : null
      ])

      const row = createElement('div', { className: 'form-group' }, [label, isSource ? details : null])
      rows.set(directive.name, { box, details })
      return row
    }

    function applyConfig(config) {
      for (const entry of rows.values()) {
        entry.box.checked = false
        entry.details.hidden = true
        entry.details.replaceChildren()
      }
      sourceState.clear()
      flagState.clear()
      for (const [name, tokens] of Object.entries(config.sources || {})) {
        const row = rows.get(name)
        if (!row) continue
        sourceState.set(name, [...tokens])
        row.box.checked = true
        row.details.hidden = false
        row.details.replaceChildren(createSources(name))
      }
      for (const name of config.flags || []) {
        const row = rows.get(name)
        if (!row) continue
        row.box.checked = true
        flagState.add(name)
      }
      update()
    }

    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        reportInput.value = ''
        applyConfig({ sources: {}, flags: [] })
      }
    })
    const strictBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据（严格）',
      onClick: () => applyConfig(PRESETS.strict)
    })
    const looseBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据（宽松）',
      onClick: () => applyConfig(PRESETS.loose)
    })

    const reportRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: 'report-uri 上报地址' }),
        reportInput
      ])
    ])

    container.append(
      createElement('div', { className: 'btn-group' }, [clearBtn, strictBtn, looseBtn]),
      createElement('div', { className: 'grid-2' }, DIRECTIVES.map(buildRow)),
      reportRow,
      errorEl,
      createSection('CSP 指令值', valueOutput),
      createSection('HTML meta 标签', metaOutput),
      createSection('nginx 配置', nginxOutput)
    )

    update()
  }
}
