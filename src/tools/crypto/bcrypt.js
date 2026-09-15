import bcrypt from 'bcryptjs'
import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'

// bcrypt hashing / verification backed by the bundled bcryptjs implementation.
// The pure helpers below are exported so they can be unit-tested without a DOM.

export const DEFAULT_COST = 10
export const MIN_COST = 4
export const MAX_COST = 31
// bcrypt only consumes the first 72 bytes of a password; anything longer is cut.
export const MAX_PASSWORD_BYTES = 72

const HASH_PATTERN = /^\$2([abxy]?)\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/
const SALT_PATTERN = /^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{22}$/

export function normalizeCost(value) {
  const cost = Number(value)
  if (!Number.isInteger(cost) || cost < MIN_COST || cost > MAX_COST) {
    throw new Error(`计算成本 cost 必须是 ${MIN_COST} 到 ${MAX_COST} 之间的整数`)
  }
  return cost
}

export function utf8Length(value) {
  return new TextEncoder().encode(String(value ?? '')).length
}

// Split a bcrypt hash into its parts, or null when it is not a bcrypt hash.
export function parseHashInfo(hash) {
  const match = HASH_PATTERN.exec(String(hash ?? '').trim())
  if (!match) return null
  return {
    version: `2${match[1] || 'a'}`,
    cost: Number(match[2]),
    salt: match[3],
    digest: match[4]
  }
}

export function isBcryptHash(hash) {
  return parseHashInfo(hash) !== null
}

// Hash a password. When `salt` is given it wins over `cost` (bcrypt stores the
// cost inside the salt, exactly like the reference implementation does).
export function hashPassword(password, cost = DEFAULT_COST, salt = '') {
  const value = String(password ?? '')
  if (!value) throw new Error('请输入要哈希的密码')
  const customSalt = String(salt ?? '').trim()
  if (customSalt) {
    if (!SALT_PATTERN.test(customSalt)) {
      throw new Error('自定义盐值格式无效，应形如 $2b$10$abcdefghijklmnopqrstuv')
    }
    return bcrypt.hashSync(value, customSalt)
  }
  return bcrypt.hashSync(value, bcrypt.genSaltSync(normalizeCost(cost)))
}

export function verifyPassword(password, hash) {
  const value = String(password ?? '')
  const target = String(hash ?? '').trim()
  if (!value) throw new Error('请输入要校验的密码')
  if (!target) throw new Error('请输入要校验的 bcrypt 哈希')
  if (!isBcryptHash(target)) throw new Error('哈希格式无效，应为 60 个字符的 bcrypt 哈希（以 $2a$/$2b$/$2y$ 开头）')
  return bcrypt.compareSync(value, target)
}

function errorMessage(cause) {
  return cause instanceof Error ? cause.message : String(cause)
}

function createField(labelText, control, hintText = '') {
  const children = [
    createElement('label', { className: 'label', textContent: labelText }),
    control
  ]
  if (hintText) children.push(createElement('div', { className: 'form-hint', textContent: hintText }))
  return createElement('div', { className: 'form-group' }, children)
}

function statItem(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('span', { className: 'stat-label', textContent: label }),
    createElement('span', { className: 'stat-value', textContent: value })
  ])
}

const SAMPLE_PASSWORD = 'hunter2'
// Deterministic sample: bcryptjs hashed "hunter2" with the fixed salt
// $2b$10$abcdefghijklmnopqrstuv, so 校验模式 always demos a successful match.
const SAMPLE_HASH = '$2b$10$abcdefghijklmnopqrstuu7gIUFBKrYXdzQy8HrouzMJyZ4cijAb2'

export default {
  id: 'bcrypt',
  name: 'bcrypt 哈希',
  description: '生成与校验 bcrypt 密码哈希，可调节计算成本',
  category: 'crypto',
  icon: 'hmac',
  keywords: ['bcrypt', '哈希', 'hash', '密码', 'cost', 'salt'],
  render(container) {
    const generatePanel = createElement('div', { className: 'tool-stack' })
    const verifyPanel = createElement('div', { className: 'tool-stack', hidden: true })

    // --- 生成哈希 ---------------------------------------------------------
    const genPassword = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '请输入要哈希的密码…',
      autocomplete: 'off'
    })
    const genCost = createElement('select', { className: 'select' }, [10, 11, 12].map(value => createElement('option', {
      value: String(value),
      textContent: `cost = ${value}`
    })))
    genCost.value = String(DEFAULT_COST)
    const genSalt = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '留空则随机生成',
      autocomplete: 'off'
    })
    const genError = createElement('div', { className: 'error-text' })
    const genOutput = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      readOnly: true,
      placeholder: '生成的哈希将显示在此…'
    })
    const genStats = createElement('div', { className: 'stats-row' })

    function runGenerate() {
      genError.textContent = ''
      try {
        const hash = hashPassword(genPassword.value, genCost.value, genSalt.value)
        const info = parseHashInfo(hash)
        genOutput.value = hash
        genStats.replaceChildren(
          statItem('算法版本', `$${info.version}$`),
          statItem('计算成本', `cost = ${info.cost}`),
          statItem('盐值', info.salt),
          statItem('哈希长度', `${hash.length} 个字符`)
        )
        const bytes = utf8Length(genPassword.value)
        if (bytes > MAX_PASSWORD_BYTES) {
          genError.textContent = `密码为 ${bytes} 字节，超出 bcrypt 的 ${MAX_PASSWORD_BYTES} 字节上限，只有前 ${MAX_PASSWORD_BYTES} 字节参与计算`
        }
      } catch (cause) {
        genOutput.value = ''
        genStats.replaceChildren()
        genError.textContent = errorMessage(cause)
      }
    }

    generatePanel.append(
      createField('密码', genPassword),
      createElement('div', { className: 'form-row' }, [
        createField('计算成本', genCost, '成本每 +1，计算耗时约翻倍'),
        createField('自定义盐值（可选）', genSalt, '填写后忽略上面的成本设置')
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '生成哈希',
          onClick: runGenerate
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            genPassword.value = SAMPLE_PASSWORD
            genSalt.value = ''
            runGenerate()
          }
        })
      ]),
      genError,
      createSection('哈希结果', createElement('div', { className: 'tool-stack' }, [genOutput, genStats]))
    )

    // --- 校验哈希 ---------------------------------------------------------
    const verifyPasswordInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '请输入要校验的密码…',
      autocomplete: 'off'
    })
    const verifyHashInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '$2b$10$…',
      autocomplete: 'off'
    })
    const verifyError = createElement('div', { className: 'error-text' })
    const verifyResult = createElement('div', { className: 'inline-result' })
    const verifyStats = createElement('div', { className: 'stats-row' })

    function runVerify() {
      verifyError.textContent = ''
      try {
        const hash = verifyHashInput.value.trim()
        const matched = verifyPassword(verifyPasswordInput.value, hash)
        const info = parseHashInfo(hash)
        verifyResult.replaceChildren(createElement('span', {
          className: 'result-value',
          textContent: matched ? '✓ 密码与哈希匹配' : '✗ 密码与哈希不匹配'
        }))
        verifyStats.replaceChildren(
          statItem('算法版本', `$${info.version}$`),
          statItem('计算成本', `cost = ${info.cost}`),
          statItem('盐值', info.salt)
        )
      } catch (cause) {
        verifyResult.replaceChildren()
        verifyStats.replaceChildren()
        verifyError.textContent = errorMessage(cause)
      }
    }

    verifyPanel.append(
      createField('密码', verifyPasswordInput),
      createField('bcrypt 哈希', verifyHashInput, '粘贴 60 个字符的 bcrypt 哈希'),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '校验哈希',
          onClick: runVerify
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            verifyPasswordInput.value = SAMPLE_PASSWORD
            verifyHashInput.value = SAMPLE_HASH
            runVerify()
          }
        })
      ]),
      verifyError,
      createElement('div', { className: 'tool-stack' }, [
        createElement('div', { className: 'label', textContent: '校验结果' }),
        verifyResult,
        verifyStats
      ])
    )

    const mode = createSegmentedGroup([
      { value: 'generate', label: '生成哈希' },
      { value: 'verify', label: '校验哈希' }
    ], value => {
      generatePanel.hidden = value !== 'generate'
      verifyPanel.hidden = value !== 'verify'
    })

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '模式' }),
          mode
        ])
      ]),
      generatePanel,
      verifyPanel
    )
  }
}
