import '../../styles/tools/context-window.css'
import { createElement, createSection } from '../../utils/dom.js'
import { formatTokens, models, providers } from './models.js'
import { debounce } from '../../utils/debounce.js'

const WINDOW_MODELS = models.filter(model => Number.isFinite(model.context) && model.context > 0)

const SAMPLE_TEXT = '请把下面这段会议记录压缩成三条要点，并保留负责人和截止日期。'

let tokenizerPromise = null

function loadTokenizer() {
  if (!tokenizerPromise) tokenizerPromise = import('gpt-tokenizer/encoding/cl100k_base')
  return tokenizerPromise
}

// `used` is the input-side token count; `remaining` and `fits` account for the
// output reservation as well, because both compete for the same window.
export function estimateUsage({ tokens, contextWindow, reserveOutput = 0 } = {}) {
  const used = Math.max(0, Number(tokens) || 0)
  const reserved = Math.max(0, Number(reserveOutput) || 0)
  const window = Number(contextWindow)
  if (!Number.isFinite(window) || window <= 0) {
    return { used, remaining: 0, ratio: 0, percent: 0, fits: false }
  }
  const occupied = used + reserved
  const ratio = occupied / window
  return {
    used,
    remaining: Math.max(0, window - occupied),
    ratio,
    percent: ratio * 100,
    fits: occupied <= window
  }
}

export function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return '—'
  if (number > 0 && number < 0.01) return '<0.01%'
  return `${Number(number.toFixed(2))}%`
}

function statCard(label, valueEl) {
  return createElement('div', { className: 'stat-item' }, [valueEl, createElement('div', { className: 'stat-label', textContent: label })])
}

function textLength(text) {
  return [...text].length
}

export default {
  render(container) {
    const modelSelect = createElement('select', {
      className: 'select',
      'aria-label': '选择上下文窗口模型'
    })
    for (const provider of providers) {
      const group = createElement('optgroup', { label: provider.name })
      for (const model of WINDOW_MODELS.filter(item => item.provider === provider.id)) {
        group.appendChild(
          createElement('option', {
            value: model.id,
            textContent: `${model.name}（${formatTokens(model.context)}）`
          })
        )
      }
      if (group.childElementCount) modelSelect.appendChild(group)
    }

    const reserveInput = createElement('input', {
      className: 'input',
      type: 'number',
      min: '0',
      step: '1',
      value: '1024',
      'aria-label': '预留输出 token 数'
    })
    const input = createElement('textarea', {
      className: 'textarea large',
      rows: 10,
      placeholder: '粘贴要放入上下文的文本…',
      'aria-label': '要估算的输入文本'
    })

    const status = createElement('div', {
      className: 'loading-text',
      role: 'status',
      'aria-live': 'polite'
    })
    const hint = createElement('div', { className: 'form-hint' })
    const limitEl = createElement('div', { className: 'form-hint-warn' })
    const breakdownEl = createElement('div', { className: 'form-hint' })

    const usedValue = createElement('span', { className: 'stat-value', textContent: '—' })
    const reserveValue = createElement('span', { className: 'stat-value', textContent: '—' })
    const remainingValue = createElement('span', { className: 'stat-value', textContent: '—' })
    const percentValue = createElement('span', { className: 'stat-value', textContent: '—' })
    const statsEl = createElement('div', { className: 'stats-row' }, [
      statCard('已用 token', usedValue),
      statCard('预留输出', reserveValue),
      statCard('剩余 token', remainingValue),
      statCard('占用比例', percentValue)
    ])

    const usedBar = createElement('div', { className: 'cw-segment cw-used' })
    const reserveBar = createElement('div', { className: 'cw-segment cw-reserved' })
    const remainingBar = createElement('div', { className: 'cw-segment cw-remaining' })
    const bar = createElement(
      'div',
      {
        className: 'cw-bar',
        role: 'img',
        'aria-label': '上下文窗口占用条'
      },
      [usedBar, reserveBar, remainingBar]
    )

    const INSTRUCTIONS = '输入文本后点击「计算占用」；计数使用 gpt-tokenizer 的 cl100k_base 编码，首次计数才会按需加载分词器。'
    hint.textContent = INSTRUCTIONS

    let runId = 0

    function currentModel() {
      return WINDOW_MODELS.find(model => model.id === modelSelect.value) || WINDOW_MODELS[0]
    }

    function resetResult(showInstructions = true) {
      usedValue.textContent = '—'
      reserveValue.textContent = '—'
      remainingValue.textContent = '—'
      percentValue.textContent = '—'
      usedBar.style.width = '0%'
      reserveBar.style.width = '0%'
      remainingBar.style.width = '0%'
      bar.classList.remove('cw-over')
      bar.setAttribute('aria-label', '上下文窗口占用条，尚未计算')
      limitEl.textContent = ''
      breakdownEl.textContent = ''
      if (showInstructions) hint.textContent = INSTRUCTIONS
    }

    function renderUsage(tokens, method, fallback) {
      const model = currentModel()
      const reserve = Math.max(0, Math.floor(Number(reserveInput.value) || 0))
      const usage = estimateUsage({ tokens, contextWindow: model.context, reserveOutput: reserve })
      const usedPercentOfWindow = Math.min(100, (usage.used / model.context) * 100)
      const reservePercentOfWindow = Math.min(100 - usedPercentOfWindow, (reserve / model.context) * 100)
      const remainingPercentOfWindow = Math.max(0, 100 - usedPercentOfWindow - reservePercentOfWindow)

      usedBar.style.width = `${usedPercentOfWindow}%`
      reserveBar.style.width = `${reservePercentOfWindow}%`
      remainingBar.style.width = `${remainingPercentOfWindow}%`
      bar.classList.toggle('cw-over', !usage.fits)
      bar.setAttribute('aria-label', `上下文占用：已用 ${usage.used} token，预留 ${reserve} token，剩余 ${usage.remaining} token`)

      usedValue.textContent = usage.used.toLocaleString('en-US')
      reserveValue.textContent = reserve.toLocaleString('en-US')
      remainingValue.textContent = usage.remaining.toLocaleString('en-US')
      percentValue.textContent = formatPercent(usage.percent)

      hint.className = fallback ? 'form-hint form-hint-warn' : 'form-hint'
      hint.textContent = fallback
        ? `${method}。未能加载 cl100k_base 分词器或计数失败，已按字符数 / 4 估算，结果仅供粗略参考。`
        : `计数方式：${method}；模型上限 ${formatTokens(model.context)} token，读取自 models.js。`

      if (usage.fits) {
        limitEl.className = 'form-hint'
        limitEl.textContent =
          usage.percent >= 90
            ? `接近上限：仅剩 ${usage.remaining.toLocaleString('en-US')} token，请为输出保留更多空间。`
            : `未超出上限，剩余 ${usage.remaining.toLocaleString('en-US')} token 可用于输入或输出。`
      } else {
        limitEl.className = 'form-hint-warn'
        limitEl.textContent = `已超出上下文窗口 ${(usage.used + reserve - model.context).toLocaleString('en-US')} token，请求会被拒绝或需要截断。`
      }

      breakdownEl.textContent = `已用 ${usage.used.toLocaleString('en-US')}（输入）+ 预留 ${reserve.toLocaleString('en-US')}（输出）+ 剩余 ${usage.remaining.toLocaleString('en-US')} = ${formatTokens(model.context)} 上下文。`
    }

    async function run() {
      schedule.cancel()
      const id = ++runId
      limitEl.textContent = ''
      breakdownEl.textContent = ''
      const text = input.value
      if (!text.trim()) {
        status.textContent = ''
        resetResult()
        return
      }

      status.textContent = '正在加载分词器…'
      let tokenizer
      try {
        tokenizer = await loadTokenizer()
      } catch {
        if (id !== runId) return
        const tokens = Math.max(1, Math.ceil(textLength(text) / 4))
        status.textContent = ''
        resetResult(false)
        renderUsage(tokens, '字符数 / 4 估算', true)
        return
      }
      if (id !== runId) return

      let tokens
      let fallback = false
      try {
        tokens = tokenizer.encode(text).length
      } catch {
        tokens = Math.max(1, Math.ceil(textLength(text) / 4))
        fallback = true
      }
      // A slower earlier run must not overwrite a newer result.
      if (id !== runId) return

      status.textContent = ''
      resetResult(false)
      renderUsage(tokens, fallback ? '字符数 / 4 估算' : 'cl100k_base 精确计数', fallback)
    }

    const schedule = debounce(run, 300)
    input.addEventListener('input', () => {
      // Invalidate any in-flight count immediately, not only when the debounced
      // run starts, so a slow earlier result can never paint over newer input.
      runId += 1
      if (!input.value.trim()) {
        schedule.cancel()
        status.textContent = ''
        resetResult()
        return
      }
      status.textContent = '等待输入停止…'
      schedule()
    })

    modelSelect.addEventListener('change', () => {
      if (input.value.trim()) run()
      else resetResult()
    })
    reserveInput.addEventListener('input', () => {
      if (input.value.trim()) run()
      else resetResult()
    })

    const countButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '计算占用',
      onClick: run
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '填入示例',
      onClick: () => {
        input.value = SAMPLE_TEXT
        run()
      }
    })

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 文本只在本地分词与计算，不会上传到服务器。'
      }),
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '模型' }),
          modelSelect
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '预留输出 token' }),
          reserveInput
        ])
      ]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '输入文本' }), input]),
      createElement('div', { className: 'btn-group form-action-row' }, [countButton, sampleButton]),
      status,
      hint,
      createSection('上下文占用', createElement('div', {}, [bar, statsEl])),
      limitEl,
      breakdownEl
    )
  }
}
