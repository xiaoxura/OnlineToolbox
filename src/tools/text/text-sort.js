import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

export default {
  id: 'text-sort',
  name: '文本排序',
  description: '对文本行进行排序',
  category: 'text',
  icon: 'text-sort',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入文本，每行一条...'
    })

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '排序结果...',
      readOnly: true
    })

    const sortFunctions = [
      {
        label: '升序 (A-Z)',
        fn: lines => [...lines].sort((a, b) => a.localeCompare(b, 'zh-CN'))
      },
      {
        label: '降序 (Z-A)',
        fn: lines => [...lines].sort((a, b) => b.localeCompare(a, 'zh-CN'))
      },
      {
        label: '随机排序',
        fn: lines => [...lines].sort(() => Math.random() - 0.5)
      },
      {
        label: '按长度排序',
        fn: lines => [...lines].sort((a, b) => a.length - b.length)
      },
      {
        label: '反转顺序',
        fn: lines => [...lines].reverse()
      }
    ]

    const btnGrid = createElement('div', {
      className: 'btn-group'
    })

    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick() {
        input.value = `张三
李四
王五
赵六
孙七
周八
吴九
郑十
钱十一
陈十二`
      }
    })

    sortFunctions.forEach(({ label, fn }) => {
      const btn = createElement('button', {
        className: 'btn btn-secondary',
        textContent: label,
        onClick() {
          const lines = input.value.split('\n')
          const sorted = fn(lines)
          output.value = sorted.join('\n')
        }
      })
      btnGrid.appendChild(btn)
    })

    const copyBtn = createCopyButton(() => output.value)

    const inputSection = createSection('输入文本', input)
    const resultSection = createSection('排序结果', output, [copyBtn])

    const exampleRow = createElement('div', { className: 'btn-group' })
    exampleRow.appendChild(exampleBtn)

    container.appendChild(inputSection)
    container.appendChild(exampleRow)
    container.appendChild(btnGrid)
    container.appendChild(resultSection)
  }
}
