import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'uuid',
  name: 'UUID 生成',
  description: '生成 UUID v4 随机唯一标识符',
  category: 'generator',
  icon: 'uuid',
  render(container) {
    // Quantity input
    const countLabel = createElement('label', { className: 'label' }, ['数量'])
    const countInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '1',
      min: '1',
      max: '100'
    })
    const countGroup = createElement('div', { className: 'form-group' }, [countLabel, countInput])

    // Uppercase toggle
    const uppercaseCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'uuid-uppercase'
    })
    const uppercaseLabel = createElement('label', { className: 'checkbox-label', for: 'uuid-uppercase' }, ['大写'])
    const uppercaseGroup = createElement('div', { className: 'form-group' }, [uppercaseCheck, uppercaseLabel])

    // Hyphen toggle
    const hyphenCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'uuid-hyphen',
      checked: 'true'
    })
    const hyphenLabel = createElement('label', { className: 'checkbox-label', for: 'uuid-hyphen' }, ['带连字符'])
    const hyphenGroup = createElement('div', { className: 'form-group' }, [hyphenCheck, hyphenLabel])

    // Options row
    const optionsRow = createElement('div', { className: 'form-row' }, [countGroup, uppercaseGroup, hyphenGroup])

    // Output
    const outputLabel = createElement('label', { className: 'label' }, ['生成结果'])
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '点击"生成"按钮生成 UUID...',
      rows: 8,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    // Generate function
    function generate() {
      const count = Math.max(1, Math.min(100, parseInt(countInput.value) || 1))
      const upper = uppercaseCheck.checked
      const hyphen = hyphenCheck.checked

      const uuids = []
      for (let i = 0; i < count; i++) {
        let uuid = crypto.randomUUID()
        if (!hyphen) {
          uuid = uuid.replace(/-/g, '')
        }
        if (upper) {
          uuid = uuid.toUpperCase()
        }
        uuids.push(uuid)
      }
      outputTextarea.value = uuids.join('\n')
    }

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: generate
    }, ['生成'])

    const btnGroup = createElement('div', { className: 'btn-group' }, [generateBtn, copyBtn])
    const outputSection = createElement('div', { className: 'result-box' }, [outputLabel, outputTextarea])

    container.appendChild(optionsRow)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
