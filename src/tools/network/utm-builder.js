import { createElement, createSection, createTableScroll } from '../../utils/dom.js'

// Campaign link builder. The base URL keeps whatever query string it already
// had; tracked values are written with `searchParams.set`, so an existing key is
// replaced instead of being duplicated.

export const UTM_FIELDS = [
  { key: 'utm_source', label: 'utm_source', hint: '来源渠道，如 google / newsletter（必填）' },
  { key: 'utm_medium', label: 'utm_medium', hint: '媒介类型，如 cpc / email（必填）' },
  { key: 'utm_campaign', label: 'utm_campaign', hint: '活动名称，如 spring_sale（必填）' },
  { key: 'utm_term', label: 'utm_term', hint: '付费关键词（选填）' },
  { key: 'utm_content', label: 'utm_content', hint: '用于区分同一广告的不同版本（选填）' }
]

export const REQUIRED_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign']

function toEntries(params) {
  if (Array.isArray(params)) {
    return params
      .filter(pair => Array.isArray(pair) && pair.length >= 1)
      .map(pair => [String(pair[0]).trim(), pair[1] == null ? '' : String(pair[1])])
  }
  if (params && typeof params === 'object') {
    return Object.entries(params)
      .filter(([key]) => key !== 'url')
      .map(([key, value]) => [key.trim(), value == null ? '' : String(value)])
  }
  return []
}

/** Merge tracking parameters into a base URL, replacing (never duplicating) existing keys. */
export function buildUtmUrl(base, params) {
  if (typeof base !== 'string' || !base.trim()) throw new Error('请输入目标 URL')
  let url
  try {
    url = new URL(base.trim())
  } catch {
    throw new Error('目标 URL 必须是包含协议的绝对地址，例如 https://example.com/landing')
  }
  for (const [key, value] of toEntries(params)) {
    if (!key || value === '') continue
    url.searchParams.set(key, value)
  }
  return url.toString()
}

/**
 * Collect validation messages for the current form state.
 * Accepts `{ url, params }`, or a flat object whose extra keys are the params.
 * Returns `{ level: 'error' | 'warning' | 'info', field, message }` items.
 */
export function validateUtm(options = {}) {
  const { url = '', params, ...rest } = options ?? {}
  const source = params && typeof params === 'object' && !Array.isArray(params) ? params : rest
  const messages = []

  if (!String(url).trim()) {
    messages.push({ level: 'error', field: 'url', message: '请输入目标 URL' })
  } else {
    let absolute = false
    try {
      const parsed = new URL(String(url).trim())
      absolute = Boolean(parsed.protocol && parsed.host)
    } catch {
      absolute = false
    }
    if (!absolute) {
      messages.push({ level: 'error', field: 'url', message: '目标 URL 必须是包含协议的绝对地址，例如 https://example.com/landing' })
    }
  }

  const entries = toEntries(source)
  const seen = new Set()
  for (const [key, value] of entries) {
    if (!key) continue
    seen.add(key)
    if (value !== '') continue
    if (REQUIRED_UTM_KEYS.includes(key)) continue
    messages.push({ level: 'warning', field: key, message: `参数 ${key} 的值为空，不会被写入链接` })
  }

  for (const key of REQUIRED_UTM_KEYS) {
    const entry = entries.find(([name]) => name === key)
    if (!entry || entry[1] === '') {
      messages.push({ level: 'warning', field: key, message: `缺少必填参数 ${key}` })
    }
  }

  for (const [key] of entries) {
    if (key && !key.startsWith('utm_')) {
      messages.push({ level: 'info', field: key, message: `自定义参数 ${key} 不是标准的 utm_ 参数，部分分析工具会忽略它` })
    }
  }

  return messages
}

const SAMPLE = {
  url: 'https://example.com/landing?ref=homepage',
  utm_source: 'newsletter',
  utm_medium: 'email',
  utm_campaign: 'spring_sale',
  utm_term: 'discount code',
  utm_content: 'header-banner'
}

function tableRow(label, value) {
  return createElement('tr', {}, [
    createElement('th', { scope: 'row', textContent: label }),
    createElement('td', { className: 'code-text', textContent: value })
  ])
}

export default {
  id: 'utm-builder',
  name: 'UTM 链接构建器',
  description: '可视化拼装带 UTM 跟踪参数的投放链接',
  category: 'network',
  icon: 'url-encode',
  keywords: ['utm', 'campaign', '投放链接', '跟踪参数', 'marketing'],
  render(container) {
    const urlInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: 'https://example.com/landing',
      'aria-label': '目标 URL'
    })

    const fieldInputs = new Map()
    const fieldNodes = UTM_FIELDS.map(field => {
      const input = createElement('input', {
        className: 'input',
        type: 'text',
        placeholder: field.key,
        'aria-label': field.label
      })
      input.addEventListener('input', run)
      fieldInputs.set(field.key, input)
      return createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: field.label }),
        input,
        createElement('p', { className: 'form-hint', textContent: field.hint })
      ])
    })

    const extraRows = createElement('div', { className: 'tool-stack' })
    const addExtraRow = (key = '', value = '') => {
      const keyInput = createElement('input', { className: 'input', type: 'text', placeholder: '参数名', 'aria-label': '附加参数名' })
      const valueInput = createElement('input', { className: 'input', type: 'text', placeholder: '参数值', 'aria-label': '附加参数值' })
      keyInput.value = key
      valueInput.value = value
      const row = createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [keyInput]),
        createElement('div', { className: 'form-group' }, [valueInput]),
        createElement('button', {
          className: 'btn-icon',
          type: 'button',
          title: '删除参数',
          'aria-label': '删除该附加参数',
          textContent: '×',
          onClick: () => {
            row.remove()
            run()
          }
        })
      ])
      for (const input of [keyInput, valueInput]) input.addEventListener('input', run)
      extraRows.appendChild(row)
    }

    const output = createElement('textarea', {
      className: 'textarea',
      rows: 4,
      readOnly: true,
      placeholder: '生成的链接将显示在此…'
    })

    const messages = createElement('div', { className: 'tool-stack' })

    const table = createElement('table', { className: 'result-table' })
    const tbody = createElement('tbody')
    table.append(createElement('thead', {}, [
      createElement('tr', {}, [
        createElement('th', { textContent: '参数' }),
        createElement('th', { textContent: '值' })
      ])
    ]), tbody)
    const tableScroll = createTableScroll(table, 'UTM 参数明细')

    function collectParams() {
      const params = {}
      for (const [key, input] of fieldInputs) params[key] = input.value.trim()
      for (const row of extraRows.children) {
        const [keyInput, valueInput] = row.querySelectorAll('input')
        const key = keyInput.value.trim()
        if (!key) continue
        params[key] = valueInput.value.trim()
      }
      return params
    }

    const MESSAGE_CLASSES = {
      error: 'error-text',
      warning: 'form-hint form-hint-warn',
      info: 'form-hint'
    }

    function renderMessages(items) {
      messages.replaceChildren(...items.map(item => createElement('div', {
        className: MESSAGE_CLASSES[item.level] ?? MESSAGE_CLASSES.info,
        textContent: item.message
      })))
    }

    function run() {
      const params = collectParams()
      const problems = validateUtm({ url: urlInput.value, params })
      const errors = problems.filter(item => item.level === 'error')
      renderMessages(problems)

      if (errors.length) {
        output.value = ''
        tbody.replaceChildren()
        return
      }

      try {
        output.value = buildUtmUrl(urlInput.value, params)
      } catch (cause) {
        output.value = ''
        tbody.replaceChildren()
        renderMessages([...problems, { level: 'error', message: cause instanceof Error ? cause.message : String(cause) }])
        return
      }

      const rows = [...new URL(output.value).searchParams.entries()]
      tbody.replaceChildren(...(rows.length
        ? rows.map(([key, value]) => tableRow(key, value))
        : [tableRow('（无参数）', '')]))
    }

    urlInput.addEventListener('input', run)

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '目标 URL' }),
          urlInput
        ])
      ]),
      createElement('div', { className: 'grid-2' }, fieldNodes),
      createElement('div', { className: 'label', textContent: '附加参数' }),
      extraRows,
      createElement('div', { className: 'btn-group' }, [
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '添加参数',
          onClick: () => addExtraRow()
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            urlInput.value = SAMPLE.url
            for (const [key, input] of fieldInputs) input.value = SAMPLE[key] ?? ''
            extraRows.replaceChildren()
            addExtraRow('aff_id', 'partner-42')
            run()
          }
        })
      ]),
      messages,
      createSection('生成的链接', output),
      createSection('参数明细', tableScroll)
    )

    run()
  }
}
