import '../../styles/tools/password-strength.css'
import { createElement, createSection } from '../../utils/dom.js'

// Password strength analysis: charset size × length entropy, penalised for
// common passwords, repeats, sequences and other guessable shapes.

export const SCORE_LABELS = ['极弱', '弱', '中等', '强', '极强']

// Theme tokens, so the meter follows light/dark mode.
export const SCORE_COLORS = [
  'var(--color-danger)',
  'var(--color-danger)',
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-success)'
]

export const COMMON_PASSWORDS = new Set([
  'password', 'passw0rd', 'p@ssw0rd', '123456', '1234567', '12345678', '123456789', '1234567890',
  '111111', '000000', '666666', '888888', '123123', '112233', '121212', '123321', '654321',
  'qwerty', 'qwertyuiop', 'qazwsx', '1qaz2wsx', '1q2w3e4r', 'zxcvbnm', 'asdfgh', 'asdfghjkl',
  'abc123', 'abcd1234', 'a123456', 'admin', 'admin123', 'root', 'toor', 'test', 'guest', 'user',
  'login', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'shadow', 'superman', 'batman',
  'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'whatever', 'trustno1', 'freedom',
  'hello', 'charlie', 'donald', 'michael', 'jennifer', 'jordan', 'harley', 'ranger', 'hunter',
  'andrew', 'daniel', 'thomas', 'robert', 'jessica', 'hannah', 'george', 'soccer', 'pokemon',
  'starwars', 'naruto', 'summer', 'winter', 'spring', 'autumn', 'woaini', '5201314', 'senha'
])

// Keyboard rows plus the alphabet, used to spot "abc"/"123"/"qwe" style runs.
const SEQUENCE_SOURCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm'
]

const ONLINE_GUESSES_PER_SECOND = 10
const OFFLINE_GUESSES_PER_SECOND = 1e10
const SECONDS_PER_YEAR = 86400 * 365.25

export function isCommonPassword(password) {
  const lower = String(password ?? '').toLowerCase()
  if (!lower) return false
  if (COMMON_PASSWORDS.has(lower)) return true
  // "password123" / "admin!" are just as weak as their bare form.
  const stripped = lower.replace(/[0-9!@#$%^&*._-]+$/, '')
  return stripped.length >= 4 && COMMON_PASSWORDS.has(stripped)
}

export function hasSequentialRun(password, runLength = 3) {
  const lower = String(password ?? '').toLowerCase()
  if (lower.length < runLength) return false
  for (const source of SEQUENCE_SOURCES) {
    for (let i = 0; i + runLength <= source.length; i++) {
      const chunk = source.slice(i, i + runLength)
      const reversed = [...chunk].reverse().join('')
      if (lower.includes(chunk) || lower.includes(reversed)) return true
    }
  }
  return false
}

export function detectCharsetSize(password) {
  const value = String(password ?? '')
  if (!value) return 0
  let size = 0
  if (/[a-z]/.test(value)) size += 26
  if (/[A-Z]/.test(value)) size += 26
  if (/[0-9]/.test(value)) size += 10
  // ASCII punctuation and space.
  if (/[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(value)) size += 33
  // Anything outside printable ASCII (CJK, accented letters, emoji …).
  if (/[^\x20-\x7e]/.test(value)) size += 128
  return size
}

export function estimateCrackSeconds(entropyBits, guessesPerSecond) {
  if (!Number.isFinite(entropyBits) || entropyBits <= 0 || guessesPerSecond <= 0) return 0
  // Average attacker needs half the keyspace.
  return Math.pow(2, entropyBits - 1) / guessesPerSecond
}

function formatNumber(value) {
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10)
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '几乎瞬间'
  if (seconds < 1) return '不到 1 秒'
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  if (seconds < 3600) return `${formatNumber(seconds / 60)} 分钟`
  if (seconds < 86400) return `${formatNumber(seconds / 3600)} 小时`
  if (seconds < SECONDS_PER_YEAR) return `${formatNumber(seconds / 86400)} 天`
  const years = seconds / SECONDS_PER_YEAR
  if (years >= 1e6) return '超过 100 万年'
  if (years >= 1000) return `${formatNumber(years / 1000)} 千年`
  return `${formatNumber(years)} 年`
}

export function analyzePassword(password) {
  const value = String(password ?? '')
  const length = [...value].length
  const charsetSize = detectCharsetSize(value)
  const entropyBits = length && charsetSize
    ? Math.round(length * Math.log2(charsetSize) * 10) / 10
    : 0

  if (!length) {
    return {
      length: 0,
      score: 0,
      label: SCORE_LABELS[0],
      entropyBits: 0,
      charsetSize: 0,
      warnings: ['请输入要分析的密码'],
      penalties: 0,
      crackTimes: { online: '——', offline: '——' },
      crackSeconds: { online: 0, offline: 0 }
    }
  }

  const warnings = []
  let penalties = 0

  if (length < 8) {
    warnings.push(`长度只有 ${length} 位，建议至少 12 位`)
    penalties++
  } else if (length < 12) {
    warnings.push(`长度 ${length} 位，建议提高到 12 位以上`)
  }

  if (isCommonPassword(value)) {
    warnings.push('这是被公开字典收录的常见密码，几乎会最先被猜到')
    penalties += 3
  }
  if (hasSequentialRun(value, 3)) {
    warnings.push('包含键盘或字母表的连续字符（如 abc、123、qwe）')
    penalties++
  }
  if (/(.)\1{2,}/.test(value)) {
    warnings.push('包含 3 个及以上连续重复的字符')
    penalties++
  }
  if (/^\d+$/.test(value)) {
    warnings.push('只包含数字，字符集过小')
    penalties++
  } else if (/^[a-z]+$/.test(value)) {
    warnings.push('只包含小写字母，建议混合大小写、数字与符号')
    penalties++
  } else if (/^[A-Za-z]+$/.test(value)) {
    warnings.push('只包含字母，建议加入数字与符号')
  }
  if (/(19|20)\d{2}/.test(value)) {
    warnings.push('包含 19xx/20xx 形式的年份等易猜信息')
    penalties++
  }

  let score = entropyBits >= 90 ? 4 : entropyBits >= 60 ? 3 : entropyBits >= 36 ? 2 : entropyBits >= 28 ? 1 : 0
  score = Math.max(0, Math.min(4, score - penalties))

  const onlineSeconds = estimateCrackSeconds(entropyBits, ONLINE_GUESSES_PER_SECOND)
  const offlineSeconds = estimateCrackSeconds(entropyBits, OFFLINE_GUESSES_PER_SECOND)

  return {
    length,
    score,
    label: SCORE_LABELS[score],
    entropyBits,
    charsetSize,
    warnings,
    penalties,
    crackTimes: {
      online: formatDuration(onlineSeconds),
      offline: formatDuration(offlineSeconds)
    },
    crackSeconds: {
      online: onlineSeconds,
      offline: offlineSeconds
    }
  }
}

export const SAMPLE_PASSWORD = 'Tr0ub4dor&3'

function statItem(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('span', { className: 'stat-label', textContent: label }),
    createElement('span', { className: 'stat-value', textContent: value })
  ])
}

export default {
  id: 'password-strength',
  name: '密码强度分析',
  description: '评估密码强度：字符集、熵值、常见模式与预估破解时间',
  category: 'crypto',
  icon: 'password',
  keywords: ['密码强度', 'password', 'entropy', '熵', '破解时间', '弱密码'],
  render(container) {
    const passwordInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '输入要分析的密码…',
      autocomplete: 'off'
    })

    const strengthBar = createElement('div', { className: 'strength-bar' })
    const strengthText = createElement('span', { className: 'strength-text', textContent: '——' })
    const strengthIndicator = createElement('div', { className: 'strength-indicator' }, [
      createElement('span', { className: 'sub-label', textContent: '强度' }),
      strengthBar,
      strengthText
    ])

    const statsRow = createElement('div', { className: 'stats-row' })
    const warningBox = createElement('div', { className: 'result-box' })
    const statsSection = createSection('强度指标', statsRow)
    const warningSection = createSection('风险提示', createElement('div', { className: 'tool-stack' }, [
      warningBox,
      createElement('div', {
        className: 'form-hint',
        textContent: '在线破解按每秒 10 次尝试估算，离线破解按每秒 100 亿次（高速哈希 + GPU）估算。'
      })
    ]))

    function run() {
      const result = analyzePassword(passwordInput.value)
      const color = SCORE_COLORS[result.score]
      strengthBar.style.setProperty('--strength-width', `${(result.score + 1) * 20}%`)
      strengthBar.style.setProperty('--strength-color', color)
      strengthText.textContent = passwordInput.value ? result.label : '——'
      strengthText.style.setProperty('--strength-color', passwordInput.value ? color : 'var(--color-text-muted)')

      if (!passwordInput.value) {
        statsRow.replaceChildren()
        warningBox.textContent = ''
        statsSection.hidden = true
        warningSection.hidden = true
        return
      }
      statsSection.hidden = false
      warningSection.hidden = false

      statsRow.replaceChildren(
        statItem('长度', `${result.length} 位`),
        statItem('字符集大小', String(result.charsetSize)),
        statItem('熵值', `${result.entropyBits} bit`),
        statItem('评分', `${result.score} / 4`),
        statItem('在线破解', result.crackTimes.online),
        statItem('离线破解', result.crackTimes.offline)
      )
      warningBox.textContent = result.warnings.length
        ? result.warnings.map(warning => `· ${warning}`).join('\n')
        : '· 未发现明显的弱密码特征'
    }

    passwordInput.addEventListener('input', run)

    container.append(
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '密码' }),
        passwordInput
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            passwordInput.value = SAMPLE_PASSWORD
            run()
          }
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '清空',
          onClick: () => {
            passwordInput.value = ''
            run()
          }
        })
      ]),
      strengthIndicator,
      statsSection,
      warningSection
    )
    run()
  }
}
