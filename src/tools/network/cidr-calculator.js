import { createElement, createCopyButton, createTableScroll } from '../../utils/dom.js'

function ipToInt(ip) {
  const parts = ip.trim().split('.')
  if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part) || Number(part) > 255)) throw new Error('请输入有效的 IPv4 地址')
  return parts.reduce((value, part) => (value << 8n) | BigInt(part), 0n)
}
function intToIp(value) { return [24n, 16n, 8n, 0n].map(shift => Number((value >> shift) & 255n)).join('.') }

export function calculateCidr(value) {
  const [ip, prefixText] = value.trim().split('/')
  const prefix = Number(prefixText)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error('CIDR 前缀必须是 0–32 的整数')
  const address = ipToInt(ip)
  const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix)) & 0xffffffffn
  const network = address & mask
  const broadcast = network | (~mask & 0xffffffffn)
  const total = 2 ** (32 - prefix)
  return {
    address: intToIp(address), mask: intToIp(mask), network: intToIp(network), broadcast: intToIp(broadcast),
    first: intToIp(prefix >= 31 ? network : network + 1n), last: intToIp(prefix >= 31 ? broadcast : broadcast - 1n),
    total, usable: prefix === 32 ? 1 : prefix === 31 ? 2 : Math.max(0, total - 2)
  }
}

export default {
  id: 'cidr-calculator', name: 'IPv4/CIDR 计算器', description: '计算 IPv4 网段、子网掩码、广播地址和可用地址范围', category: 'network', icon: 'unicode',
  render(container) {
    const input = createElement('input', { className: 'input', value: '192.168.1.10/24', placeholder: '例如 192.168.1.10/24' })
    const error = createElement('div', { className: 'error-text' })
    const result = createElement('div')
    const run = () => {
      error.textContent = ''; result.innerHTML = ''
      try {
        const data = calculateCidr(input.value)
        const labels = { address: 'IP 地址', mask: '子网掩码', network: '网络地址', broadcast: '广播地址', first: '首个可用地址', last: '最后可用地址', total: '地址总数', usable: '可用地址数' }
        const table = createElement('table', { className: 'result-table' })
        const body = createElement('tbody')
        for (const [key, label] of Object.entries(labels)) body.appendChild(createElement('tr', {}, [
          createElement('th', { textContent: label }),
          createElement('td', {}, [createElement('div', { className: 'table-cell-actions' }, [
            createElement('span', { textContent: String(data[key]) }),
            createCopyButton(String(data[key]))
          ])])
        ]))
        table.appendChild(body); result.appendChild(createTableScroll(table, 'CIDR 计算结果'))
      } catch (e) { error.textContent = e.message }
    }
    input.addEventListener('keydown', event => { if (event.key === 'Enter') run() })
    container.append(createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: 'IPv4 CIDR' }), input]), createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '计算网段', onClick: run }), error, createElement('div', { className: 'result-box' }, [result]))
    run()
  }
}
