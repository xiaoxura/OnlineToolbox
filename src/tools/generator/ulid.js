import { createElement, createSection, createCopyButton } from '../../utils/dom.js'
import { monotonicFactory } from 'ulid'

export default {
  id: 'ulid',
  name: 'ULID 生成',
  description: '生成按时间排序、适合分布式系统的 ULID 标识符',
  category: 'generator',
  icon: 'uuid',
  render(container) {
    const count = createElement('input', { className: 'input', type: 'number', min: '1', max: '100', step: '1', value: '5' })
    const options = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: '生成数量' }),
      count,
      createElement('span', { className: 'form-hint', textContent: '每次最多生成 100 个' })
    ])
    const output = createElement('textarea', { className: 'textarea', rows: 12, readOnly: true, placeholder: '点击“生成 ULID”...' })
    const status = createElement('div', { className: 'inline-result', role: 'status', 'aria-live': 'polite' })
    let createUlid
    const generate = () => {
      try {
        createUlid ||= monotonicFactory()
        const amount = Math.min(100, Math.max(1, Math.floor(Number(count.value) || 1)))
        output.value = Array.from({ length: amount }, () => createUlid()).join('\n')
        status.textContent = `已生成 ${amount} 个 ULID`
      } catch {
        output.value = ''
        status.textContent = '当前浏览器无法提供安全随机数，无法生成 ULID'
      }
    }
    container.append(
      options,
      createElement('div', { className: 'btn-group' }, [
        createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '生成 ULID', onClick: generate })
      ]),
      status,
      createSection('结果', output, [createCopyButton(() => output.value)])
    )
  }
}
