import { createElement, createSection, createFilterGroup, createTableScroll } from '../../utils/dom.js'
import {
  DATA_UPDATED, PRICING_SOURCES, cachedInputPrice, formatTokens,
  models, providerName, providerNotes, providers
} from './models.js'

const money = value => `$${Number(value.toFixed(4))}`

export default {
  id: 'llm-models',
  name: '大模型对照表',
  description: '对比主流大模型的上下文窗口与每百万 token 价格',
  category: 'ai',
  icon: 'ai-model',
  render(container) {
    const tableHost = createElement('div')
    const notesHost = createElement('div')

    const filters = [{ value: 'all', label: '全部' }, ...providers.map(provider => ({ value: provider.id, label: provider.name }))]

    function renderTable(providerId) {
      const showProvider = providerId === 'all'
      const rows = showProvider ? models : models.filter(model => model.provider === providerId)

      const headers = ['模型', '模型 ID', '上下文', '输入 / 1M', '输出 / 1M', '缓存输入 / 1M']
      if (showProvider) headers.unshift('厂商')

      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement('tr', {}, headers.map(label => createElement('th', { textContent: label })))
        ]),
        createElement('tbody', {}, rows.map(model => {
          const cells = [
            createElement('td', {}, [
              createElement('div', { textContent: model.name }),
              ...(model.note ? [createElement('div', { className: 'sub-label', textContent: model.note })] : [])
            ]),
            createElement('td', { className: 'code-text', textContent: model.id }),
            createElement('td', { textContent: formatTokens(model.context) }),
            createElement('td', { textContent: money(model.input) }),
            createElement('td', { textContent: money(model.output) }),
            createElement('td', { textContent: money(cachedInputPrice(model)) })
          ]
          if (showProvider) cells.unshift(createElement('td', { textContent: providerName(model.provider) }))
          return createElement('tr', {}, cells)
        }))
      )

      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, '模型价格对照表，可横向滚动')
      tableHost.replaceChildren(host)

      const shown = showProvider ? providers : providers.filter(provider => provider.id === providerId)
      notesHost.replaceChildren(...shown.map(provider => createElement('div', { className: 'form-hint' }, [
        createElement('strong', { textContent: `${provider.name}：` }),
        createElement('span', { textContent: providerNotes[provider.id] })
      ])))
    }

    const filterGroup = createFilterGroup(filters, renderTable, { label: '厂商筛选' })

    const sourceList = createElement('ul', {}, PRICING_SOURCES.map(source =>
      createElement('li', {}, [
        createElement('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer', textContent: source.name })
      ])
    ))

    renderTable('all')

    container.append(
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '厂商' }),
        filterGroup
      ]),
      createSection('模型价格', tableHost),
      createSection('计费说明', notesHost),
      createSection('数据来源', createElement('div', {}, [
        createElement('p', {
          className: 'form-hint',
          textContent: `价格为官方标价（USD / 每百万 token），读取于 ${DATA_UPDATED}。厂商会随时调价，实际以官方页面为准；成本估算器中的单价可手动修改。`
        }),
        sourceList
      ]))
    )
  }
}
