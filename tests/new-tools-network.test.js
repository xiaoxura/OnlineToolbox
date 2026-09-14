import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import queryString from '../src/tools/network/query-string.js'
import ipv6Calculator, { calculateIPv6, compressIPv6, expandIPv6, parseIPv6 } from '../src/tools/network/ipv6-calculator.js'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function editableTextarea() {
  return root.querySelector('textarea:not([readonly])')
}

function outputTextarea() {
  return root.querySelector('textarea[readonly]')
}

function runPrimaryAction() {
  root.querySelector('.btn-primary').click()
}

describe('network utility tools', () => {
  it('serializes repeated query parameters from JSON arrays', () => {
    queryString.render(root)
    editableTextarea().value = '{"tag":["js","css"],"page":1}'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('tag=js&tag=css&page=1')
  })

  it('keeps special query keys and rejects nested JSON values', () => {
    queryString.render(root)
    root.querySelector('[data-value="query-to-json"]').click()
    editableTextarea().value = '__proto__=x&ok=1'
    runPrimaryAction()
    const parsed = JSON.parse(outputTextarea().value)
    expect(Object.hasOwn(parsed, '__proto__')).toBe(true)
    expect(parsed.__proto__).toBe('x')
    expect(parsed.ok).toBe('1')

    root.querySelector('[data-value="json-to-query"]').click()
    editableTextarea().value = '{"filter":{"active":true}}'
    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).toContain('仅支持标量')
  })

  it('renders IPv6 normalization and CIDR ranges in the UI', () => {
    ipv6Calculator.render(root)
    const input = root.querySelector('input[type="text"]')
    input.value = '2001:0db8:0000:0000:0000:ff00:0042:8329/64'
    runPrimaryAction()
    const rows = [...root.querySelectorAll('tbody tr')]
    const values = new Map(rows.map(row => [row.querySelector('th').textContent, row.querySelector('td span').textContent]))
    expect(values.get('压缩表示')).toBe('2001:db8::ff00:42:8329')
    expect(values.get('展开表示')).toBe('2001:0db8:0000:0000:0000:ff00:0042:8329')
    expect(values.get('网络地址')).toBe('2001:db8::')
    expect(values.get('最后地址')).toBe('2001:db8::ffff:ffff:ffff:ffff')
    expect(values.get('地址总数')).toBe('18446744073709551616')
  })

  it('handles IPv6 compression, IPv4 tails, /0 and /128 boundaries', () => {
    expect(compressIPv6('2001:0db8:0000:0000:0000:ff00:0042:8329')).toBe('2001:db8::ff00:42:8329')
    expect(expandIPv6('2001:db8::ff00:42:8329')).toBe('2001:0db8:0000:0000:0000:ff00:0042:8329')

    const ipv4Tail = calculateIPv6('::ffff:192.0.2.128/120')
    expect(ipv4Tail).toMatchObject({
      compressed: '::ffff:c000:280',
      expanded: '0000:0000:0000:0000:0000:ffff:c000:0280',
      prefix: 120,
      network: '::ffff:c000:200',
      first: '::ffff:c000:200',
      last: '::ffff:c000:2ff',
      total: '256'
    })

    const allAddresses = calculateIPv6('2001:db8::1/0')
    expect(allAddresses).toMatchObject({ network: '::', first: '::', last: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', total: '340282366920938463463374607431768211456' })

    const oneAddress = calculateIPv6('2001:db8::1/128')
    expect(oneAddress).toMatchObject({ network: '2001:db8::1', first: '2001:db8::1', last: '2001:db8::1', total: '1' })
  })

  it('rejects malformed IPv6 addresses without leaving stale UI results', () => {
    for (const invalid of ['2001:db8::1::2', '2001:db8:0:0:0:0:0:0:1', '::ffff:192.0.2.999', '::ffff:192.0.2.001', '2001:db8::1/129', 'fe80::1%eth0']) {
      expect(() => parseIPv6(invalid)).toThrow()
    }

    ipv6Calculator.render(root)
    const input = root.querySelector('input[type="text"]')
    input.value = '2001:db8::1::2'
    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).not.toBe('')
    expect(root.querySelectorAll('tbody tr')).toHaveLength(0)
  })
})
