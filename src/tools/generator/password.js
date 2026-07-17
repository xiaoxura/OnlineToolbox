import { createElement, createCopyButton, createSection } from '../../utils/dom.js'

export default {
  id: 'password',
  name: '随机密码生成',
  description: '生成安全的随机密码',
  category: 'generator',
  icon: 'password',
  render(container) {
    const CHARS = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      digits: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    }

    // Length input
    const lengthLabel = createElement('label', { className: 'label' }, ['密码长度'])
    const lengthInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '16',
      min: '4',
      max: '128'
    })
    const lengthGroup = createElement('div', { className: 'form-group' }, [lengthLabel, lengthInput])

    // Count input
    const countLabel = createElement('label', { className: 'label' }, ['数量'])
    const countInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '1',
      min: '1',
      max: '20'
    })
    const countGroup = createElement('div', { className: 'form-group' }, [countLabel, countInput])

    // Checkboxes
    const upperCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'pw-upper',
      checked: 'true'
    })
    const upperLabel = createElement('label', { className: 'form-group option-control-group option-item' }, [
      upperCheck,
      createElement('span', { textContent: '大写字母' })
    ])

    const lowerCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'pw-lower',
      checked: 'true'
    })
    const lowerLabel = createElement('label', { className: 'form-group option-control-group option-item' }, [
      lowerCheck,
      createElement('span', { textContent: '小写字母' })
    ])

    const digitCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'pw-digits',
      checked: 'true'
    })
    const digitLabel = createElement('label', { className: 'form-group option-control-group option-item' }, [
      digitCheck,
      createElement('span', { textContent: '数字' })
    ])

    const symbolCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'pw-symbols',
      checked: 'true'
    })
    const symbolLabel = createElement('label', { className: 'form-group option-control-group option-item' }, [
      symbolCheck,
      createElement('span', { textContent: '特殊符号' })
    ])

    const checkboxesRow = createElement('div', { className: 'form-row' }, [
      upperLabel,
      lowerLabel,
      digitLabel,
      symbolLabel
    ])

    // Strength indicator
    const strengthBar = createElement('div', { className: 'strength-bar' })
    const strengthText = createElement('span', { className: 'strength-text', textContent: '--' })
    const strengthSection = createElement('div', { className: 'strength-indicator' }, [
      createElement('span', { className: 'sub-label', textContent: '密码强度:' }),
      strengthBar,
      strengthText
    ])

    // Output
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '点击"生成密码"按钮生成...',
      rows: 8,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    // Strength calculation
    function updateStrength(password) {
      let score = 0
      if (password.length >= 8) score++
      if (password.length >= 16) score++
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
      if (/\d/.test(password)) score++
      if (/[^a-zA-Z0-9]/.test(password)) score++

      const levels = [
        { label: '弱', color: '#ef4444', width: '25%' },
        { label: '中', color: '#f59e0b', width: '50%' },
        { label: '强', color: '#22c55e', width: '75%' },
        { label: '极强', color: '#06b6d4', width: '100%' }
      ]

      const level = levels[Math.min(score, levels.length) - 1] || levels[0]
      strengthBar.style.setProperty('--strength-width', level.width)
      strengthBar.style.setProperty('--strength-color', level.color)
      strengthText.textContent = level.label
      strengthText.style.setProperty('--strength-color', level.color)
    }

    // Generate function
    function generate() {
      const length = Math.max(4, Math.min(128, parseInt(lengthInput.value) || 16))
      const count = Math.max(1, Math.min(20, parseInt(countInput.value) || 1))

      let charset = ''
      if (upperCheck.checked) charset += CHARS.upper
      if (lowerCheck.checked) charset += CHARS.lower
      if (digitCheck.checked) charset += CHARS.digits
      if (symbolCheck.checked) charset += CHARS.symbols

      if (!charset) {
        outputTextarea.value = '请至少选择一种字符类型'
        return
      }

      const passwords = []
      for (let i = 0; i < count; i++) {
        const array = new Uint32Array(length)
        crypto.getRandomValues(array)
        let password = ''
        for (let j = 0; j < length; j++) {
          password += charset[array[j] % charset.length]
        }
        passwords.push(password)
      }

      outputTextarea.value = passwords.join('\n')

      // Update strength based on first password
      if (passwords.length > 0) {
        updateStrength(passwords[0])
      }
    }

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: generate
    }, ['生成密码'])

    const optionsRow = createElement('div', { className: 'form-row' }, [lengthGroup, countGroup])
    const btnGroup = createElement('div', { className: 'btn-group' }, [generateBtn])
    const outputSection = createSection('生成结果', outputTextarea, [copyBtn])

    container.appendChild(optionsRow)
    container.appendChild(checkboxesRow)
    container.appendChild(strengthSection)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
