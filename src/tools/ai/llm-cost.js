import { createElement, createSection, createTableScroll } from '../../utils/dom.js'
import {
  CACHE_WRITE_MULTIPLIER, cachedInputPrice, formatCost, formatTokens,
  modelById, models, modelsByProvider, providers
} from './models.js'

const numberValue = input => {
  const value = Number(input.value)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function field(label, input) {
  return createElement('div', { className: 'form-group' }, [
    createElement('label', { className: 'label', textContent: label }),
    input
  ])
}

function numberInput(value, placeholder) {
  return createElement('input', {
    className: 'input',
    type: 'number',
    min: '0',
    step: 'any',
    value: String(value),
    placeholder
  })
}

export default {
  id: 'llm-cost',
  name: '大模型成本估算',
  description: '按 token 用量和模型单价估算 API 调用成本，支持缓存计价',
  category: 'ai',
  icon: 'ai-cost',
  render(container) {
    const modelSelect = createElement('select', { className: 'select', 'aria-label': '选择模型' })
    for (const provider of providers) {
      const group = createElement('optgroup', { label: provider.name })
      for (const model of modelsByProvider(provider.id)) {
        group.appendChild(createElement('option', {
          value: model.id,
          textContent: `${model.name}（上下文 ${formatTokens(model.context)}）`
        }))
      }
      modelSelect.appendChild(group)
    }

    const inputTokens = numberInput(1000, '1000')
    const outputTokens = numberInput(500, '500')
    const cacheReadTokens = numberInput(0, '0')
    const cacheWriteTokens = numberInput(0, '0')
    const calls = numberInput(1, '1')
    const inputPrice = numberInput(0, '0')
    const outputPrice = numberInput(0, '0')

    const statsEl = createElement('div', { className: 'stats-row' })
    const tableHost = createElement('div')
    const error = createElement('div', { className: 'error-text' })
    const hint = createElement('div', { className: 'form-hint' })

    function currentModel() {
      return modelById(modelSelect.value) || models[0]
    }

    // Reflect the selected model's list price into the editable unit-price
    // fields, so the estimate starts from real numbers but stays overridable
    // for negotiated or stale pricing.
    function syncPrices() {
      const model = currentModel()
      inputPrice.value = String(model.input)
      outputPrice.value = String(model.output)
    }

    function compute() {
      error.textContent = ''
      const model = currentModel()
      const inPrice = numberValue(inputPrice)
      const outPrice = numberValue(outputPrice)
      const cacheReadPrice = cachedInputPrice(model, inPrice)
      const cacheWritePrice = inPrice * CACHE_WRITE_MULTIPLIER

      const inTokens = numberValue(inputTokens)
      const outTokens = numberValue(outputTokens)
      const readTokens = numberValue(cacheReadTokens)
      const writeTokens = numberValue(cacheWriteTokens)
      const callCount = Math.max(1, Math.floor(numberValue(calls) || 1))

      const lines = [
        ['输入', inTokens, inPrice],
        ['输出', outTokens, outPrice],
        ['缓存读取', readTokens, cacheReadPrice],
        ['缓存写入', writeTokens, cacheWritePrice]
      ]
      const perCall = lines.reduce((sum, [, tokens, price]) => sum + tokens * price / 1_000_000, 0)
      const totalCost = perCall * callCount

      statsEl.replaceChildren(
        ...[
          ['单次调用', formatCost(perCall)],
          [`总成本（${callCount} 次）`, formatCost(totalCost)],
          ['输入 token 合计', (inTokens + readTokens + writeTokens).toLocaleString('en-US')]
        ].map(([label, value]) => {
          const card = createElement('div', { className: 'stat-item' })
          card.append(
            createElement('div', { className: 'stat-value', textContent: value }),
            createElement('div', { className: 'stat-label', textContent: label })
          )
          return card
        })
      )

      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement('tr', {}, ['项目', 'Token 数', '单价 / 1M', '小计'].map(label => createElement('th', { textContent: label })))
        ]),
        createElement('tbody', {}, lines.map(([label, tokens, price]) => createElement('tr', {}, [
          createElement('td', { textContent: label }),
          createElement('td', { textContent: tokens.toLocaleString('en-US') }),
          createElement('td', { textContent: `$${price}` }),
          createElement('td', { textContent: formatCost(tokens * price / 1_000_000) })
        ])))
      )
      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, '成本明细表，可横向滚动')
      tableHost.replaceChildren(host)

      const context = model.context
      hint.textContent = context && inTokens + readTokens + writeTokens > context
        ? `注意：输入侧合计已超过该模型的上下文窗口（${formatTokens(context)}），实际请求会被拒绝或需要分片。`
        : `缓存写入按输入价 ${CACHE_WRITE_MULTIPLIER}× 估算；缓存读取为 ${formatCost(cacheReadPrice)} / 1M。单价可手动修改。`
    }

    modelSelect.addEventListener('change', () => {
      syncPrices()
      compute()
    })
    for (const input of [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, calls, inputPrice, outputPrice]) {
      input.addEventListener('input', compute)
    }

    syncPrices()
    compute()

    container.append(
      createElement('div', { className: 'form-row' }, [
        field('模型', modelSelect)
      ]),
      createElement('div', { className: 'form-row' }, [
        field('输入 token', inputTokens),
        field('输出 token', outputTokens)
      ]),
      createElement('div', { className: 'form-row' }, [
        field('缓存读取 token', cacheReadTokens),
        field('缓存写入 token', cacheWriteTokens)
      ]),
      createElement('div', { className: 'form-row' }, [
        field('调用次数', calls),
        field('输入单价 / 1M (USD)', inputPrice)
      ]),
      createElement('div', { className: 'form-row' }, [
        field('输出单价 / 1M (USD)', outputPrice)
      ]),
      error,
      hint,
      createSection('估算结果', statsEl),
      createSection('成本明细', tableHost)
    )
  }
}
