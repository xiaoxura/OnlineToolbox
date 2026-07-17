import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'

export default {
  id: 'random',
  name: '随机数生成',
  description: '生成随机数和随机字符串',
  category: 'generator',
  icon: 'random',
  render(container) {
    let currentTab = 'number'

    // --- Random Number Panel ---
    const numMinLabel = createElement('label', { className: 'label' }, ['最小值'])
    const numMinInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '1'
    })
    const numMinGroup = createElement('div', { className: 'form-group' }, [numMinLabel, numMinInput])

    const numMaxLabel = createElement('label', { className: 'label' }, ['最大值'])
    const numMaxInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '100'
    })
    const numMaxGroup = createElement('div', { className: 'form-group' }, [numMaxLabel, numMaxInput])

    const numCountLabel = createElement('label', { className: 'label' }, ['数量'])
    const numCountInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '10',
      min: '1',
      max: '1000'
    })
    const numCountGroup = createElement('div', { className: 'form-group' }, [numCountLabel, numCountInput])

    const numRepeatCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'random-repeat',
      checked: 'true'
    })
    const numRepeatGroup = createElement('label', { className: 'form-group option-control-group option-item' }, [
      numRepeatCheck,
      createElement('span', { textContent: '允许重复' })
    ])

    const numTypeInt = createElement('input', {
      className: 'radio',
      type: 'radio',
      name: 'random-num-type',
      value: 'integer',
      id: 'random-int',
      checked: 'true'
    })
    const numTypeIntLabel = createElement('label', { className: 'radio-label' }, [
      numTypeInt,
      createElement('span', { textContent: '整数' })
    ])
    const numTypeDec = createElement('input', {
      className: 'radio',
      type: 'radio',
      name: 'random-num-type',
      value: 'decimal',
      id: 'random-dec'
    })
    const numTypeDecLabel = createElement('label', { className: 'radio-label' }, [
      numTypeDec,
      createElement('span', { textContent: '小数' })
    ])
    const numTypeGroup = createElement('fieldset', {
      className: 'form-group option-control-group'
    }, [
      createElement('legend', { className: 'sr-only', textContent: '数值类型' }),
      numTypeIntLabel,
      numTypeDecLabel
    ])

    const numberPanel = createElement('div', { className: 'tab-panel' }, [
      createElement('div', { className: 'form-row' }, [numMinGroup, numMaxGroup]),
      createElement('div', { className: 'form-row' }, [numCountGroup, numRepeatGroup, numTypeGroup])
    ])

    // --- Random String Panel ---
    const strLenLabel = createElement('label', { className: 'label' }, ['长度'])
    const strLenInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '16',
      min: '1',
      max: '10000'
    })
    const strLenGroup = createElement('div', { className: 'form-group' }, [strLenLabel, strLenInput])

    const strCountLabel = createElement('label', { className: 'label' }, ['数量'])
    const strCountInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '5',
      min: '1',
      max: '100'
    })
    const strCountGroup = createElement('div', { className: 'form-group' }, [strCountLabel, strCountInput])

    const strUpperCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'random-str-upper',
      checked: 'true'
    })
    const strUpperLabel = createElement('label', { className: 'form-group option-control-group option-item' }, [
      strUpperCheck,
      createElement('span', { textContent: '大写字母' })
    ])

    const strLowerCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'random-str-lower',
      checked: 'true'
    })
    const strLowerLabel = createElement('label', { className: 'form-group option-control-group option-item' }, [
      strLowerCheck,
      createElement('span', { textContent: '小写字母' })
    ])

    const strDigitCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'random-str-digit',
      checked: 'true'
    })
    const strDigitLabel = createElement('label', { className: 'form-group option-control-group option-item' }, [
      strDigitCheck,
      createElement('span', { textContent: '数字' })
    ])

    const strSymbolCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'random-str-symbol'
    })
    const strSymbolLabel = createElement('label', { className: 'form-group option-control-group option-item' }, [
      strSymbolCheck,
      createElement('span', { textContent: '特殊字符' })
    ])

    const stringPanel = createElement('div', { className: 'tab-panel' }, [
      createElement('div', { className: 'form-row' }, [strLenGroup, strCountGroup]),
      createElement('div', { className: 'form-row' }, [
        strUpperLabel,
        strLowerLabel,
        strDigitLabel,
        strSymbolLabel
      ])
    ])

    // Panel visibility
    numberPanel.classList.add('active')

    // Tabs
    const tabs = createTabGroup([
      { label: '随机数', value: 'number' },
      { label: '随机字符串', value: 'string' }
    ], (value) => {
      currentTab = value
      numberPanel.classList.toggle('active', value === 'number')
      stringPanel.classList.toggle('active', value === 'string')
    })

    // Output
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '点击"生成"按钮...',
      rows: 10,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    // Generate random numbers
    function generateNumbers() {
      const min = parseFloat(numMinInput.value) || 0
      const max = parseFloat(numMaxInput.value) || 100
      const count = Math.max(1, Math.min(1000, parseInt(numCountInput.value) || 10))
      const allowRepeat = numRepeatCheck.checked
      const isDecimal = document.querySelector('input[name="random-num-type"]:checked')?.value === 'decimal'

      if (min > max) {
        outputTextarea.value = '最小值不能大于最大值'
        return
      }

      const results = []
      const seen = new Set()
      const maxAttempts = count * 10
      let attempts = 0

      while (results.length < count && attempts < maxAttempts) {
        attempts++
        const array = new Uint32Array(1)
        crypto.getRandomValues(array)
        let value
        if (isDecimal) {
          value = min + (array[0] / (0xFFFFFFFF + 1)) * (max - min)
          value = parseFloat(value.toFixed(6))
        } else {
          value = Math.floor(min + (array[0] / (0xFFFFFFFF + 1)) * (max - min + 1))
          value = Math.max(min, Math.min(max, value))
        }

        if (allowRepeat || !seen.has(value)) {
          seen.add(value)
          results.push(value)
        }
      }

      if (results.length < count) {
        outputTextarea.value = `只生成了 ${results.length} 个不重复的值（范围太小无法生成 ${count} 个）\n` + results.join('\n')
      } else {
        outputTextarea.value = results.join('\n')
      }
    }

    // Generate random strings
    function generateStrings() {
      const length = Math.max(1, Math.min(10000, parseInt(strLenInput.value) || 16))
      const count = Math.max(1, Math.min(100, parseInt(strCountInput.value) || 5))

      const CHARS = {
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lower: 'abcdefghijklmnopqrstuvwxyz',
        digits: '0123456789',
        symbols: '!@#$%^&*_+-='
      }

      let charset = ''
      if (strUpperCheck.checked) charset += CHARS.upper
      if (strLowerCheck.checked) charset += CHARS.lower
      if (strDigitCheck.checked) charset += CHARS.digits
      if (strSymbolCheck.checked) charset += CHARS.symbols

      if (!charset) {
        outputTextarea.value = '请至少选择一种字符类型'
        return
      }

      const results = []
      for (let i = 0; i < count; i++) {
        const array = new Uint32Array(length)
        crypto.getRandomValues(array)
        let str = ''
        for (let j = 0; j < length; j++) {
          str += charset[array[j] % charset.length]
        }
        results.push(str)
      }

      outputTextarea.value = results.join('\n')
    }

    // Generate button
    function generate() {
      if (currentTab === 'number') {
        generateNumbers()
      } else {
        generateStrings()
      }
    }

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: generate
    }, ['生成'])

    const btnGroup = createElement('div', { className: 'btn-group' }, [generateBtn])
    const outputSection = createSection('生成结果', outputTextarea, [copyBtn])

    container.appendChild(tabs)
    container.appendChild(numberPanel)
    container.appendChild(stringPanel)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
