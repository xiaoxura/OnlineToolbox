import { createElement, createCopyButton, createSection } from '../../utils/dom.js'

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function encodeBase58(text) {
  const bytes = new TextEncoder().encode(text)
  if (!bytes.length) return ''
  let value = 0n
  for (const byte of bytes) value = value * 256n + BigInt(byte)
  let result = ''
  while (value > 0n) {
    result = ALPHABET[Number(value % 58n)] + result
    value /= 58n
  }
  for (const byte of bytes) { if (byte === 0) result = '1' + result; else break }
  return result
}

export function decodeBase58(text) {
  const input = text.trim()
  if (!input) return ''
  let value = 0n
  for (const char of input) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) throw new Error(`包含无效字符“${char}”`)
    value = value * 58n + BigInt(index)
  }
  const bytes = []
  while (value > 0n) { bytes.unshift(Number(value % 256n)); value /= 256n }
  for (const char of input) { if (char === '1') bytes.unshift(0); else break }
  return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
}

export default {
  id: 'base58', name: 'Base58 编解码', description: '使用 Bitcoin 字母表进行 Base58 编码与解码', category: 'encoding', icon: 'base32',
  render(container) {
    const input = createElement('textarea', { className: 'textarea', rows: 6, placeholder: '输入文本或 Base58 编码…' })
    const output = createElement('textarea', { className: 'textarea', rows: 6, readOnly: true, placeholder: '结果将显示在这里…' })
    const error = createElement('div', { className: 'error-text' })
    const run = fn => { error.textContent = ''; try { output.value = fn(input.value) } catch (e) { output.value = ''; error.textContent = e.message } }
    container.append(
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '输入内容' }), input]),
      createElement('div', { className: 'btn-group' }, [
        createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '编码', onClick: () => run(encodeBase58) }),
        createElement('button', { className: 'btn btn-secondary', type: 'button', textContent: '解码', onClick: () => run(decodeBase58) }),
        createElement('button', { className: 'btn btn-secondary', type: 'button', textContent: '示例数据', onClick: () => { input.value = 'Hello 世界'; run(encodeBase58) } })
      ]), error,
      createSection('输出结果', output, [createCopyButton(() => output.value)])
    )
  }
}
