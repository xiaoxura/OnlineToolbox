import { createCopyButton, createElement, createSection, createTableScroll } from '../../utils/dom.js'

const IPV6_BITS = 128n
const IPV6_MAX = (1n << IPV6_BITS) - 1n

function parseIPv4Tail(value) {
  const parts = value.split('.')
  if (parts.length !== 4 || parts.some(part => !/^(?:0|[1-9]\d*)$/.test(part))) {
    throw new Error('IPv4 尾段格式无效')
  }

  const octets = parts.map(part => Number(part))
  if (octets.some(octet => octet > 255)) throw new Error('IPv4 尾段必须在 0–255 之间')

  return [
    ((octets[0] << 8) | octets[1]).toString(16),
    ((octets[2] << 8) | octets[3]).toString(16)
  ]
}

function parseGroups(address) {
  let normalized = address
  if (normalized.includes('.')) {
    const separator = normalized.lastIndexOf(':')
    if (separator < 0) throw new Error('IPv4 尾段必须位于 IPv6 地址之后')
    normalized = `${normalized.slice(0, separator + 1)}${parseIPv4Tail(normalized.slice(separator + 1)).join(':')}`
  }

  const doubleColon = normalized.indexOf('::')
  if (doubleColon !== -1 && normalized.indexOf('::', doubleColon + 2) !== -1) {
    throw new Error('IPv6 地址最多只能使用一次 ::')
  }

  let groups
  if (doubleColon !== -1) {
    const leftText = normalized.slice(0, doubleColon)
    const rightText = normalized.slice(doubleColon + 2)
    const left = leftText ? leftText.split(':') : []
    const right = rightText ? rightText.split(':') : []
    if (left.some(group => !group) || right.some(group => !group)) throw new Error('IPv6 地址分组格式无效')
    if (left.length + right.length > 7) throw new Error(':: 必须至少压缩一个 16 位分组')
    groups = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
  } else {
    groups = normalized.split(':')
    if (groups.length !== 8) throw new Error('IPv6 地址必须包含 8 个 16 位分组，或使用 :: 压缩')
  }

  if (groups.length !== 8 || groups.some(group => !/^[0-9a-f]{1,4}$/i.test(group))) {
    throw new Error('IPv6 分组必须是 1–4 位十六进制数')
  }
  return groups.map(group => Number.parseInt(group, 16))
}

function groupsToValue(groups) {
  return groups.reduce((value, group) => (value << 16n) | BigInt(group), 0n)
}

function valueToGroups(value) {
  return Array.from({ length: 8 }, (_, index) => {
    const shift = BigInt((7 - index) * 16)
    return Number((value >> shift) & 0xffffn)
  })
}

function groupsToExpanded(groups) {
  return groups.map(group => group.toString(16).padStart(4, '0')).join(':')
}

function groupsToCompressed(groups) {
  let bestStart = -1
  let bestLength = 0
  let runStart = -1

  for (let index = 0; index <= groups.length; index += 1) {
    if (index < groups.length && groups[index] === 0) {
      if (runStart === -1) runStart = index
      continue
    }
    if (runStart !== -1) {
      const runLength = index - runStart
      if (runLength > bestLength) {
        bestStart = runStart
        bestLength = runLength
      }
      runStart = -1
    }
  }

  const values = groups.map(group => group.toString(16))
  if (bestLength < 2) return values.join(':')

  const left = values.slice(0, bestStart).join(':')
  const right = values.slice(bestStart + bestLength).join(':')
  if (!left && !right) return '::'
  if (!left) return `::${right}`
  if (!right) return `${left}::`
  return `${left}::${right}`
}

function parsePrefix(value) {
  if (!/^\d+$/.test(value)) throw new Error('CIDR 前缀必须是 0–128 的整数')
  const prefix = Number(value)
  if (prefix > 128) throw new Error('CIDR 前缀必须是 0–128 的整数')
  return prefix
}

/**
 * Parse an IPv6 address, optionally followed by a CIDR prefix.
 * The returned value is a BigInt so no address precision is lost.
 */
export function parseIPv6(input) {
  const source = String(input ?? '').trim()
  if (!source) throw new Error('请输入 IPv6 地址')

  const slash = source.indexOf('/')
  if (slash !== -1 && source.indexOf('/', slash + 1) !== -1) {
    throw new Error('IPv6 地址只能包含一个 CIDR 前缀')
  }
  const address = slash === -1 ? source : source.slice(0, slash)
  const prefixText = slash === -1 ? null : source.slice(slash + 1)
  if (!address || address.includes('%')) throw new Error('请输入不带区域标识的 IPv6 地址')

  const groups = parseGroups(address)
  return {
    address,
    groups,
    value: groupsToValue(groups),
    prefix: prefixText === null ? null : parsePrefix(prefixText)
  }
}

export function expandIPv6(input) {
  return groupsToExpanded(parseIPv6(input).groups)
}

export function compressIPv6(input) {
  return groupsToCompressed(parseIPv6(input).groups)
}

function subnetValue(value, prefix) {
  const mask = prefix === 0 ? 0n : (IPV6_MAX << BigInt(128 - prefix)) & IPV6_MAX
  const network = value & mask
  return {
    network,
    last: network | (IPV6_MAX ^ mask),
    total: 1n << BigInt(128 - prefix)
  }
}

/**
 * Normalize an IPv6 address and, when a prefix is supplied, calculate its
 * network range. All decimal values are strings to remain safe above 2^53.
 */
export function calculateIPv6(input) {
  const parsed = parseIPv6(input)
  const result = {
    address: parsed.address,
    groups: parsed.groups,
    prefix: parsed.prefix,
    expanded: groupsToExpanded(parsed.groups),
    compressed: groupsToCompressed(parsed.groups),
    integer: parsed.value.toString(10),
    binary: parsed.groups.map(group => group.toString(2).padStart(16, '0')).join('')
  }

  if (parsed.prefix === null) {
    return { ...result, network: null, first: null, last: null, total: null }
  }

  const range = subnetValue(parsed.value, parsed.prefix)
  return {
    ...result,
    network: groupsToCompressed(valueToGroups(range.network)),
    first: groupsToCompressed(valueToGroups(range.network)),
    last: groupsToCompressed(valueToGroups(range.last)),
    total: range.total.toString(10)
  }
}

export default {
  id: 'ipv6-calculator',
  name: 'IPv6 地址解析',
  description: '解析 IPv6 地址并生成压缩、展开格式，支持 IPv4 尾段和 CIDR 前缀',
  category: 'network',
  icon: 'unicode',
  render(container) {
    const input = createElement('input', {
      className: 'input',
      type: 'text',
      value: '2001:0db8:0000:0000:0000:ff00:0042:8329/64',
      autocomplete: 'off',
      spellcheck: false,
      placeholder: '例如 2001:db8::1/64'
    })
    const error = createElement('div', { className: 'error-text' })
    const result = createElement('div', { className: 'tool-stack' })

    function renderResult(data) {
      const rows = [
        ['压缩表示', data.compressed],
        ['展开表示', data.expanded],
        ['128 位整数', data.integer],
        ['二进制表示', data.binary]
      ]
      if (data.prefix !== null) {
        rows.push(
          ['CIDR 前缀', `/${data.prefix}`],
          ['网络地址', data.network],
          ['最后地址', data.last],
          ['地址总数', data.total]
        )
      }

      const table = createElement('table', { className: 'result-table' })
      const body = createElement('tbody')
      rows.forEach(([label, value]) => {
        body.appendChild(createElement('tr', {}, [
          createElement('th', { textContent: label }),
          createElement('td', {}, [createElement('div', { className: 'table-cell-actions' }, [
            createElement('span', { textContent: value }),
            createCopyButton(value)
          ])])
        ]))
      })
      table.appendChild(body)
      result.appendChild(createSection('IPv6 解析结果', createTableScroll(table, 'IPv6 解析结果')))
    }

    function run() {
      error.textContent = ''
      result.innerHTML = ''
      try {
        renderResult(calculateIPv6(input.value))
      } catch (exception) {
        error.textContent = exception.message
      }
    }

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') run()
    })

    container.append(
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: 'IPv6 地址或 CIDR' }),
        input
      ]),
      createElement('div', { className: 'btn-group' }, [
        createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '解析地址', onClick: run }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: () => {
            input.value = '::ffff:192.0.2.128/120'
            run()
          }
        })
      ]),
      error,
      result
    )
    run()
  }
}
