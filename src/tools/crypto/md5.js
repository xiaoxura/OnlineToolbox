import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import CryptoJS from 'crypto-js'

export default {
  id: 'md5',
  name: 'MD5 哈希',
  description: '计算文本的 MD5 哈希值',
  category: 'crypto',
  icon: 'md5',
  render(container) {
    let isUppercase = false

    const inputLabel = createElement('label', { className: 'label' }, ['输入文本'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入要计算 MD5 哈希的文本...',
      rows: 6
    })

    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 3,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const toggleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '大写',
      onClick: () => {
        isUppercase = !isUppercase
        toggleBtn.textContent = isUppercase ? '小写' : '大写'
        compute()
      }
    })

    // Real-time computation
    function compute() {
      const text = inputTextarea.value
      if (!text) {
        outputTextarea.value = ''
        return
      }
      const hash = CryptoJS.MD5(text).toString()
      outputTextarea.value = isUppercase ? hash.toUpperCase() : hash
    }

    inputTextarea.addEventListener('input', compute)

    const calcBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: compute
    }, ['计算 MD5'])

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据',
      onClick: () => {
        inputTextarea.value = 'Hello, World! 你好世界'
        compute()
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [calcBtn, toggleBtn, sampleBtn])
    const outputSection = createSection('MD5 哈希值', outputTextarea, [copyBtn])

    container.appendChild(inputLabel)
    container.appendChild(inputTextarea)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
