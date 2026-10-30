import '../../styles/tools/prompt-security.css'
import { createCopyButton, createElement, createSection, createTableScroll } from '../../utils/dom.js'
import { debounce } from '../../utils/debounce.js'

const RISK_LABELS = { low: '低风险', medium: '中风险', high: '高风险' }
const SEVERITY_LABELS = { high: '高', medium: '中', low: '低' }
const SEVERITY_SCORE = { high: 40, medium: 20, low: 8 }

const FORMAT_CHAR = /\p{Cf}/u

const HIDDEN_NAMES = {
  0x00ad: '软连字符（SHY）',
  0x061c: '阿拉伯字母标记（ALM）',
  0x200b: '零宽空格（ZWSP）',
  0x200c: '零宽非连接符（ZWNJ）',
  0x200d: '零宽连接符（ZWJ）',
  0x200e: '从左到右标记（LRM）',
  0x200f: '从右到左标记（RLM）',
  0x202a: '从左到右嵌入（LRE）',
  0x202b: '从右到左嵌入（RLE）',
  0x202c: '方向格式弹出（PDF）',
  0x202d: '从左到右覆盖（LRO）',
  0x202e: '从右到左覆盖（RLO）',
  0x2060: '词连接符（WJ）',
  0x2061: '函数应用（FA）',
  0x2062: '不可见乘号（IT）',
  0x2063: '不可见分隔符（IS）',
  0x2064: '不可见加号（IP）',
  0x2066: '从左到右隔离（LRI）',
  0x2067: '从右到左隔离（RLI）',
  0x2068: '首个强方向隔离（FSI）',
  0x2069: '方向隔离弹出（PDI）',
  0xfeff: '零宽不换行空格 / BOM'
}

const INJECTION_RULES = [
  {
    id: 'ignore-instructions',
    severity: 'high',
    label: '忽略先前指令',
    detail: '要求模型忽略系统或开发者先前的指令，是典型的提示注入句式。',
    pattern:
      /(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier|system|developer)\s+(?:instructions?|prompts?|rules?|messages?)|(?:忽略|无视|忘记|不要理会|绕过|跳过|覆盖|摒弃)[^。\n]{0,16}(?:之前|先前|以上|前面|系统|开发者|原来|此前|上述)[^。\n]{0,10}(?:指令|提示|规则|要求|设定|消息)/i
  },
  {
    id: 'reveal-system-prompt',
    severity: 'high',
    label: '套取系统提示词',
    detail: '要求显示、重复或泄露系统提示词，可能导致内部指令外泄。',
    pattern:
      /(?:reveal|show|print|repeat|leak|disclose|output|display|tell\s+me)[\s\S]{0,30}(?:system|developer|hidden|initial|original)\s+(?:prompt|instructions?|message)|(?:显示|输出|泄露|重复|告诉我|打印|复述|展示)[^。\n]{0,20}(?:系统|开发者|初始|隐藏|原始)[^。\n]{0,10}(?:提示词|prompt|指令|设定)/i
  },
  {
    id: 'jailbreak-mode',
    severity: 'high',
    label: '越狱 / 开发者模式',
    detail: '出现 DAN、开发者模式或越狱类关键词，通常用于绕过安全限制。',
    pattern:
      /\b(?:developer\s+mode|do\s+anything\s+now|DAN|jailbreak(?:ed)?|god\s+mode|unrestricted\s+mode)\b|(?:开发者模式|越狱模式|DAN\s*模式|无限制模式|上帝模式)/i
  },
  {
    id: 'role-spoofing',
    severity: 'medium',
    label: '伪装角色',
    detail: '文本试图伪造 system / assistant 角色或要求模型扮演系统角色。',
    pattern:
      /(?:^|\n)[ \t]*(?:system|assistant|developer)\s*[:：]|(?:扮演|假装|充当|伪装|你现在是)[^。\n]{0,12}(?:system|assistant|开发者|系统)/i
  },
  {
    id: 'secret-exfiltration',
    severity: 'high',
    label: '索取密钥或环境变量',
    detail: '要求输出 API Key、密码、令牌或环境变量，可能造成凭据泄露。',
    pattern:
      /(?:print|show|reveal|output|repeat|tell\s+me|display|leak|expose|dump)[\s\S]{0,30}(?:api[\s_-]?key|secret|password|credential|environment\s+variable|env\s+var|access\s+token)|(?:输出|显示|打印|告诉我|泄露|读取|复述|列出)[^。\n]{0,20}(?:密钥|api\s*key|密码|环境变量|凭证|令牌|secret|token)|process\.env|os\.environ/i
  },
  {
    id: 'special-tokens',
    severity: 'high',
    label: '特殊控制 token',
    detail: '包含 ChatML 等特殊 token，可能被用来伪造对话边界。',
    pattern:
      /<\|(?:im_start|im_end|system|assistant|user|endoftext|eot_id|start_header_id|end_header_id|tool|observation)\|>|<<SYS>>|\[\/?INST\]/i
  },
  {
    id: 'base64-payload',
    severity: 'low',
    label: '长 Base64 字符串',
    detail: '包含较长 Base64 字符串，可能藏有编码后的隐藏指令，建议解码确认。',
    pattern: /[A-Za-z0-9+/]{80,}={0,2}/
  },
  {
    id: 'exfiltration-url',
    severity: 'medium',
    label: 'URL 外传',
    detail: '包含带数据参数的 URL 或要求把内容发送到外部地址，存在外传风险。',
    pattern:
      /https?:\/\/[^\s<>"'`]*(?:[?&](?:data|text|prompt|content|q|query|key|token|secret|message)=|webhook\.site|requestbin|ngrok|interact\.sh|oastify)|(?:发送|上传|提交|转发|外传)[^。\n]{0,24}https?:\/\//i
  }
]

function isTagCodePoint(codePoint) {
  return codePoint >= 0xe0000 && codePoint <= 0xe007f
}

function isBidiOrTag(codePoint) {
  return (codePoint >= 0x202a && codePoint <= 0x202e) || (codePoint >= 0x2066 && codePoint <= 0x2069) || isTagCodePoint(codePoint)
}

function isHiddenCodePoint(codePoint) {
  if (isTagCodePoint(codePoint)) return true
  return FORMAT_CHAR.test(String.fromCodePoint(codePoint))
}

function hiddenName(codePoint) {
  if (HIDDEN_NAMES[codePoint]) return HIDDEN_NAMES[codePoint]
  const hex = codePoint.toString(16).toUpperCase().padStart(4, '0')
  if (isTagCodePoint(codePoint)) return `Unicode 标签字符 U+${hex}`
  return `Unicode 格式控制字符（Cf）U+${hex}`
}

function collectHiddenChars(text) {
  const grouped = new Map()
  const hiddenChars = []
  let index = 0
  for (const char of text) {
    const codePoint = char.codePointAt(0)
    if (isHiddenCodePoint(codePoint)) {
      const existing = grouped.get(codePoint)
      if (existing) {
        existing.count += 1
      } else {
        const entry = { codePoint, name: hiddenName(codePoint), count: 1, index }
        grouped.set(codePoint, entry)
        hiddenChars.push(entry)
      }
    }
    index += 1
  }
  return hiddenChars
}

function excerptAround(text, index, length) {
  const start = Math.max(0, index - 24)
  const end = Math.min(text.length, index + length + 24)
  const excerpt = text.slice(start, end).replace(/\s+/g, ' ')
  return `${start > 0 ? '…' : ''}${excerpt}${end < text.length ? '…' : ''}`
}

export function stripHiddenChars(text) {
  return [...String(text ?? '')].filter(char => !isHiddenCodePoint(char.codePointAt(0))).join('')
}

export function scanPrompt(text) {
  const source = String(text ?? '')
  const findings = []
  for (const rule of INJECTION_RULES) {
    rule.pattern.lastIndex = 0
    const match = rule.pattern.exec(source)
    if (!match) continue
    findings.push({
      id: rule.id,
      severity: rule.severity,
      label: rule.label,
      detail: rule.detail,
      index: match.index,
      excerpt: excerptAround(source, match.index, match[0].length)
    })
  }

  const hiddenChars = collectHiddenChars(source)
  let score = findings.reduce((sum, finding) => sum + SEVERITY_SCORE[finding.severity], 0)
  for (const hidden of hiddenChars) score += isBidiOrTag(hidden.codePoint) ? 35 : 20
  score = Math.min(100, score)

  const hasHigh = findings.some(finding => finding.severity === 'high') || hiddenChars.some(hidden => isBidiOrTag(hidden.codePoint))
  const risk = hasHigh ? 'high' : score >= 20 ? 'medium' : 'low'

  return {
    risk,
    score,
    findings,
    hiddenChars,
    cleaned: stripHiddenChars(source)
  }
}

function statCard(label, valueEl) {
  return createElement('div', { className: 'stat-item' }, [valueEl, createElement('div', { className: 'stat-label', textContent: label })])
}

export default {
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      rows: 12,
      placeholder: '粘贴 System Prompt 或任意要检查的文本…',
      'aria-label': '要检查的 System Prompt 或文本'
    })
    const cleaned = createElement('textarea', {
      className: 'textarea',
      readOnly: true,
      rows: 8,
      placeholder: '清洗后的文本将显示在此…',
      'aria-label': '清洗后的文本'
    })

    const badge = createElement('div', {
      className: 'stat-item ps-badge',
      role: 'status',
      'aria-live': 'polite',
      textContent: '等待扫描'
    })
    const scoreValue = createElement('span', { className: 'stat-value', textContent: '—' })
    const hiddenCountValue = createElement('span', { className: 'stat-value', textContent: '—' })
    const statsEl = createElement('div', { className: 'stats-row' }, [
      badge,
      statCard('风险分', scoreValue),
      statCard('隐藏字符种类', hiddenCountValue)
    ])

    const findingsHost = createElement('div')
    const hiddenHost = createElement('div')
    const hint = createElement('div', { className: 'form-hint' })

    const INSTRUCTIONS = '粘贴文本后会实时扫描注入特征与隐藏字符；清洗后的文本可一键复制。所有分析都在本地完成。'
    hint.textContent = INSTRUCTIONS

    function reset() {
      badge.className = 'stat-item ps-badge'
      badge.textContent = '等待扫描'
      scoreValue.textContent = '—'
      hiddenCountValue.textContent = '—'
      findingsHost.replaceChildren()
      hiddenHost.replaceChildren()
      cleaned.value = ''
      hint.className = 'form-hint'
      hint.textContent = INSTRUCTIONS
    }

    function renderFindings(findings) {
      if (!findings.length) {
        findingsHost.replaceChildren(createElement('div', { className: 'form-hint', textContent: '未发现注入特征。' }))
        return
      }
      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement(
            'tr',
            {},
            ['严重度', '类型', '片段', '位置'].map(label => createElement('th', { textContent: label }))
          )
        ]),
        createElement(
          'tbody',
          {},
          findings.map(finding =>
            createElement('tr', {}, [
              createElement('td', {}, [
                createElement('span', {
                  className: `ps-severity ps-severity-${finding.severity}`,
                  textContent: SEVERITY_LABELS[finding.severity]
                })
              ]),
              createElement('td', {}, [
                createElement('div', { textContent: finding.label }),
                createElement('div', { className: 'sub-label', textContent: finding.detail })
              ]),
              createElement('td', { className: 'code-text', textContent: finding.excerpt }),
              createElement('td', { textContent: `第 ${finding.index + 1} 字符` })
            ])
          )
        )
      )
      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, '提示注入发现列表，可横向滚动')
      findingsHost.replaceChildren(host)
    }

    function renderHidden(hiddenChars) {
      if (!hiddenChars.length) {
        hiddenHost.replaceChildren(createElement('div', { className: 'form-hint', textContent: '未发现隐藏字符。' }))
        return
      }
      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement(
            'tr',
            {},
            ['码点', '名称', '次数', '首次位置'].map(label => createElement('th', { textContent: label }))
          )
        ]),
        createElement(
          'tbody',
          {},
          hiddenChars.map(hidden =>
            createElement('tr', {}, [
              createElement('td', {
                className: 'code-text',
                textContent: `U+${hidden.codePoint.toString(16).toUpperCase().padStart(4, '0')}`
              }),
              createElement('td', { textContent: hidden.name }),
              createElement('td', { textContent: String(hidden.count) }),
              createElement('td', { textContent: `第 ${hidden.index + 1} 字符` })
            ])
          )
        )
      )
      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, '隐藏字符列表，可横向滚动')
      hiddenHost.replaceChildren(host)
    }

    function run() {
      if (!input.value) {
        reset()
        return
      }
      const result = scanPrompt(input.value)
      badge.className = `stat-item ps-badge risk-${result.risk}`
      badge.textContent = `${RISK_LABELS[result.risk]}（${result.score} 分）`
      scoreValue.textContent = String(result.score)
      hiddenCountValue.textContent = String(result.hiddenChars.length)
      cleaned.value = result.cleaned
      renderFindings(result.findings)
      renderHidden(result.hiddenChars)

      if (!result.findings.length && !result.hiddenChars.length) {
        hint.className = 'form-hint'
        hint.textContent = '未发现明显注入特征或隐藏字符，文本看起来是干净的。'
      } else {
        hint.className = 'form-hint form-hint-warn'
        hint.textContent = `发现 ${result.findings.length} 项注入特征、${result.hiddenChars.length} 类隐藏字符；清洗后的文本已移除隐藏字符，但仍建议人工复核。`
      }
    }

    const schedule = debounce(run, 250)
    input.addEventListener('input', () => {
      if (!input.value) {
        schedule.cancel()
        reset()
        return
      }
      schedule()
    })

    const scanButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '重新扫描',
      onClick: run
    })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        input.value = ''
        reset()
      }
    })

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 文本只在本地检查，不会上传到服务器；请勿在此粘贴真实密钥。'
      }),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: 'System Prompt / 待检查文本' }),
        input
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [scanButton, clearButton]),
      statsEl,
      hint,
      createSection('发现列表', findingsHost),
      createSection('隐藏字符', hiddenHost),
      createSection('清洗后文本', cleaned, [createCopyButton(() => cleaned.value)])
    )
  }
}
