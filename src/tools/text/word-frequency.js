import '../../styles/tools/word-frequency.css'
import { createElement, createSection, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'

// --- Word frequency ---------------------------------------------------------
// Chinese has no word delimiters, so a CJK run is cut into overlapping
// two-character tokens (bigrams) while Latin/number runs stay whole words.

const HAN = /\p{Script=Han}/u
const LATIN_START = /[A-Za-z0-9]/
const LATIN_PART = /[A-Za-z0-9'’]/

const EN_STOPWORDS = ('a an and are as at be been but by for from had has have he her his i if in into is it its me my no not ' +
  'of on or our she so such than that the their them then there these they this to too up us was we were what when where ' +
  'which who will with you your').split(' ')

const ZH_STOPWORDS = ('的 了 是 在 我 有 和 就 不 人 都 一 上 也 很 到 说 要 去 你 会 着 好 这 那 它 他 她 们 个 中 与 及 或 而 之 其 此 把 被 让 从 对 ' +
  '一个 这个 那个 什么 因为 所以 但是 如果 已经 可以 我们 你们 他们 没有 就是 这样 那么 还是 只是 就是 一些 这些 那些 以及 并且 而且 或者').split(' ')

const STOPWORDS = new Set([...EN_STOPWORDS, ...ZH_STOPWORDS])

function normalizeOptions(options = {}) {
  return {
    minLength: Math.max(1, Math.trunc(Number(options.minLength)) || 1),
    ignoreStopwords: Boolean(options.ignoreStopwords),
    caseSensitive: Boolean(options.caseSensitive),
    mode: ['all', 'cjk', 'latin'].includes(options.mode) ? options.mode : 'all',
    topN: Math.max(0, Math.trunc(Number(options.topN)) || 0),
    extraStopwords: Array.isArray(options.extraStopwords) ? options.extraStopwords : []
  }
}

function cjkTokens(run) {
  const characters = [...run]
  if (characters.length === 1) return [characters[0]]
  const tokens = []
  for (let index = 0; index < characters.length - 1; index++) {
    tokens.push(characters[index] + characters[index + 1])
  }
  return tokens
}

export function tokenize(text, options = {}) {
  const settings = normalizeOptions(options)
  const characters = [...String(text ?? '')]
  const stopwords = new Set(STOPWORDS)
  for (const word of settings.extraStopwords) stopwords.add(String(word).toLowerCase())

  const raw = []
  let index = 0
  while (index < characters.length) {
    const character = characters[index]

    if (HAN.test(character)) {
      let end = index
      while (end < characters.length && HAN.test(characters[end])) end++
      if (settings.mode !== 'latin') raw.push(...cjkTokens(characters.slice(index, end).join('')))
      index = end
      continue
    }

    if (LATIN_START.test(character)) {
      let end = index
      while (end < characters.length && LATIN_PART.test(characters[end])) end++
      // A trailing apostrophe belongs to the sentence, not to the word.
      const word = characters.slice(index, end).join('').replace(/['’]+$/, '')
      if (settings.mode !== 'cjk' && word) raw.push(word)
      index = end
      continue
    }

    index++
  }

  return raw
    .map(token => (settings.caseSensitive ? token : token.toLowerCase()))
    .filter(token => {
      if ([...token].length < settings.minLength) return false
      if (settings.ignoreStopwords && stopwords.has(settings.caseSensitive ? token : token.toLowerCase())) return false
      return true
    })
}

export function summarize(text, options = {}) {
  const settings = normalizeOptions(options)
  const tokens = tokenize(text, settings)
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1)

  const results = [...counts.entries()]
    .map(([word, count]) => ({
      word,
      count,
      percentage: tokens.length ? Math.round((count / tokens.length) * 10000) / 100 : 0
    }))
    .sort((left, right) => right.count - left.count || left.word.localeCompare(right.word))

  return {
    total: tokens.length,
    unique: counts.size,
    results,
    top: settings.topN > 0 ? results.slice(0, settings.topN) : results
  }
}

export function countWords(text, options = {}) {
  return summarize(text, options).top
}

const SAMPLE_TEXT = `自然语言处理是人工智能的重要方向。自然语言处理让机器理解人类的语言。
Natural language processing is a key direction of artificial intelligence.
The toolbox runs fully offline, and offline tools keep your data local.`

const BAR_LIMIT = 10

export default {
  id: 'word-frequency',
  name: '词频统计',
  description: '统计文本中词语出现次数、占比并排序',
  category: 'text',
  icon: 'char-count',
  keywords: ['词频', '统计', 'word frequency', '分词', 'bigram'],
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      placeholder: '粘贴要统计的文本（支持中英文混合）…'
    })

    const minLength = createElement('input', {
      className: 'input',
      type: 'number',
      min: '1',
      max: '10',
      value: '2',
      'aria-label': '最小词长'
    })

    const scope = createSegmentedGroup([
      { value: 'all', label: '全部' },
      { value: 'cjk', label: '仅中文' },
      { value: 'latin', label: '仅英文' }
    ], () => run(), { label: '统计范围' })

    const topN = createElement('select', { className: 'select', 'aria-label': '显示条数' }, [
      createElement('option', { value: '0', textContent: '不限' }),
      createElement('option', { value: '10', textContent: '前 10 条' }),
      createElement('option', { value: '20', textContent: '前 20 条' }),
      createElement('option', { value: '50', textContent: '前 50 条' }),
      createElement('option', { value: '100', textContent: '前 100 条' })
    ])

    const stopwordBox = createElement('input', { type: 'checkbox', checked: true })
    const caseBox = createElement('input', { type: 'checkbox' })

    const statsEl = createElement('div', { className: 'stats-row' })
    const barsEl = createElement('div', { className: 'freq-bars' })
    const table = createElement('table', { className: 'result-table' })
    const thead = createElement('thead', {}, [
      createElement('tr', {}, [
        createElement('th', { scope: 'col', textContent: '排名' }),
        createElement('th', { scope: 'col', textContent: '词语' }),
        createElement('th', { scope: 'col', textContent: '次数' }),
        createElement('th', { scope: 'col', textContent: '占比' })
      ])
    ])
    const tbody = createElement('tbody')
    table.append(thead, tbody)
    const tableScroll = createTableScroll(table, '词频统计结果')
    const errorEl = createElement('div', { className: 'error-text' })

    function readOptions() {
      return {
        minLength: Number(minLength.value) || 1,
        ignoreStopwords: stopwordBox.checked,
        caseSensitive: caseBox.checked,
        mode: scope.getValue(),
        topN: Number(topN.value) || 0
      }
    }

    function statItem(label, value) {
      return createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: label }),
        createElement('span', { className: 'stat-value', textContent: value })
      ])
    }

    const statsSection = createSection('统计概览', statsEl)
    const barsSection = createSection('高频词分布（前 10）', barsEl)
    const tableSection = createSection('词频明细', tableScroll)

    function setResultsVisible(visible) {
      statsSection.hidden = !visible
      barsSection.hidden = !visible
      tableSection.hidden = !visible
    }

    function run() {
      errorEl.textContent = ''
      tbody.replaceChildren()
      barsEl.replaceChildren()
      statsEl.replaceChildren()
      setResultsVisible(false)

      if (!input.value.trim()) return

      try {
        const summary = summarize(input.value, readOptions())
        if (!summary.total) {
          errorEl.textContent = '未统计到词语，请调整最小词长或统计范围'
          return
        }
        setResultsVisible(true)

        const highest = summary.results[0]
        statsEl.append(
          statItem('总词数', String(summary.total)),
          statItem('不同词语', String(summary.unique)),
          statItem('最高频词', `${highest.word}（${highest.count} 次）`)
        )

        const maxCount = highest.count
        for (const entry of summary.top.slice(0, BAR_LIMIT)) {
          const fill = createElement('div', { className: 'freq-bar-fill' })
          fill.style.width = `${Math.max(2, Math.round((entry.count / maxCount) * 100))}%`
          barsEl.append(createElement('div', { className: 'freq-bar' }, [
            createElement('span', { className: 'freq-bar-word', textContent: entry.word }),
            createElement('div', { className: 'freq-bar-track' }, [fill]),
            createElement('span', { className: 'freq-bar-count', textContent: String(entry.count) })
          ]))
        }

        summary.top.forEach((entry, index) => {
          tbody.append(createElement('tr', {}, [
            createElement('td', { textContent: String(index + 1) }),
            createElement('td', { className: 'code-text', textContent: entry.word }),
            createElement('td', { textContent: String(entry.count) }),
            createElement('td', { textContent: `${entry.percentage}%` })
          ]))
        })
      } catch (cause) {
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = SAMPLE_TEXT
        run()
      }
    })
    const runBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '统计词频',
      onClick: run
    })

    input.addEventListener('input', run)
    for (const control of [minLength, topN, stopwordBox, caseBox]) {
      control.addEventListener('change', run)
    }

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '统计范围' }),
          scope
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '最小词长' }),
          minLength
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '显示条数' }),
          topN
        ]),
        createElement('div', { className: 'form-group option-control-group' }, [
          createElement('label', { className: 'option-item' }, [
            stopwordBox,
            createElement('span', { textContent: '忽略停用词' })
          ]),
          createElement('label', { className: 'option-item' }, [
            caseBox,
            createElement('span', { textContent: '区分大小写' })
          ])
        ])
      ]),
      createElement('div', { className: 'btn-group' }, [runBtn, sampleBtn]),
      errorEl,
      createSection('文本输入', input),
      statsSection,
      barsSection,
      tableSection
    )

    run()
  }
}
