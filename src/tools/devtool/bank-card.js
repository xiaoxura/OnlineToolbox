import { createElement } from '../../utils/dom.js'

export default {
  id: 'bank-card',
  name: '银行卡号校验',
  description: '使用 Luhn 算法校验银行卡号，识别发卡银行和卡类型',
  category: 'devtool',
  icon: 'search',
  render(container) {
    const BANK_BIN = [
      { bin: '622202', name: '工商银行', type: '借记卡' },
      { bin: '622203', name: '工商银行', type: '借记卡' },
      { bin: '621226', name: '工商银行', type: '借记卡' },
      { bin: '622700', name: '建设银行', type: '借记卡' },
      { bin: '622707', name: '建设银行', type: '借记卡' },
      { bin: '621284', name: '建设银行', type: '借记卡' },
      { bin: '622848', name: '农业银行', type: '借记卡' },
      { bin: '622849', name: '农业银行', type: '借记卡' },
      { bin: '621282', name: '农业银行', type: '借记卡' },
      { bin: '622760', name: '中国银行', type: '借记卡' },
      { bin: '621256', name: '中国银行', type: '借记卡' },
      { bin: '622588', name: '招商银行', type: '借记卡' },
      { bin: '621483', name: '招商银行', type: '借记卡' },
      { bin: '622155', name: '交通银行', type: '借记卡' },
      { bin: '621436', name: '交通银行', type: '借记卡' },
      { bin: '622150', name: '交通银行', type: '借记卡' },
      { bin: '622161', name: '民生银行', type: '借记卡' },
      { bin: '622600', name: '光大银行', type: '借记卡' },
      { bin: '622601', name: '光大银行', type: '借记卡' },
      { bin: '622602', name: '光大银行', type: '借记卡' },
      { bin: '622603', name: '光大银行', type: '借记卡' },
      { bin: '622622', name: '光大银行', type: '借记卡' },
      { bin: '621488', name: '光大银行', type: '借记卡' },
      { bin: '622660', name: '兴业银行', type: '借记卡' },
      { bin: '622666', name: '兴业银行', type: '借记卡' },
      { bin: '622668', name: '兴业银行', type: '借记卡' },
      { bin: '622680', name: '兴业银行', type: '借记卡' },
      { bin: '621486', name: '兴业银行', type: '借记卡' },
      { bin: '622568', name: '广发银行', type: '借记卡' },
      { bin: '622555', name: '广发银行', type: '借记卡' },
      { bin: '622162', name: '中信银行', type: '借记卡' },
      { bin: '622690', name: '平安银行', type: '借记卡' },
      { bin: '622691', name: '平安银行', type: '借记卡' },
      { bin: '622692', name: '平安银行', type: '借记卡' },
      { bin: '621626', name: '平安银行', type: '借记卡' },
      { bin: '622619', name: '华夏银行', type: '借记卡' },
      { bin: '622620', name: '华夏银行', type: '借记卡' },
      { bin: '621489', name: '浦发银行', type: '借记卡' },
      { bin: '622157', name: '浦发银行', type: '借记卡' },
      { bin: '622158', name: '浦发银行', type: '借记卡' },
      { bin: '622517', name: '邮储银行', type: '借记卡' },
      { bin: '622518', name: '邮储银行', type: '借记卡' },
      { bin: '621096', name: '邮储银行', type: '借记卡' },
      { bin: '621799', name: '邮储银行', type: '借记卡' },
      { bin: '620062', name: '银联', type: '借记卡' },
      { bin: '620058', name: '银联', type: '借记卡' }
    ]

    function formatCardNumber(num) {
      const digits = num.replace(/\s/g, '')
      return digits.replace(/(.{4})/g, '$1 ').trim()
    }

    function luhnCheck(num) {
      const digits = num.replace(/\s/g, '')
      if (!/^\d+$/.test(digits)) return false

      let sum = 0
      let alternate = false
      for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i], 10)
        if (alternate) {
          n *= 2
          if (n > 9) n -= 9
        }
        sum += n
        alternate = !alternate
      }
      return sum % 10 === 0
    }

    function detectBank(num) {
      const digits = num.replace(/\s/g, '')
      for (let len = 6; len >= 3; len--) {
        const prefix = digits.slice(0, len)
        const match = BANK_BIN.find(b => b.bin === prefix)
        if (match) return match
      }
      return null
    }

    const inputGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'bc-input' }, ['银行卡号']),
      createElement('input', {
        className: 'input',
        type: 'text',
        id: 'bc-input',
        placeholder: '请输入银行卡号'
      })
    ])

    const validateBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '校验',
      onClick: doValidate
    })

    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '清空',
      onClick: () => {
        document.getElementById('bc-input').value = ''
        errorEl.textContent = ''
        resultContainer.setAttribute('hidden', 'true')
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [validateBtn, clearBtn])

    const errorEl = createElement('div', { className: 'error-text' })

    const resultContainer = createElement('div', { className: 'result-box' })
    resultContainer.setAttribute('hidden', 'true')

    function doValidate() {
      const raw = document.getElementById('bc-input').value.trim()
      errorEl.textContent = ''
      resultContainer.setAttribute('hidden', 'true')
      resultContainer.innerHTML = ''

      if (!raw) {
        errorEl.textContent = '请输入银行卡号'
        return
      }

      const digits = raw.replace(/\s/g, '')
      if (!/^\d+$/.test(digits)) {
        errorEl.textContent = '银行卡号只能包含数字'
        return
      }

      if (digits.length < 13 || digits.length > 19) {
        errorEl.textContent = '银行卡号长度应在13-19位之间'
        return
      }

      const isValid = luhnCheck(digits)
      const bank = detectBank(digits)

      resultContainer.removeAttribute('hidden')

      const items = [
        { label: '格式化卡号', value: formatCardNumber(digits) },
        { label: '银行名称', value: bank ? bank.name : '未知银行' },
        { label: '卡类型', value: bank ? bank.type : '未知' },
        { label: 'Luhn 校验', value: isValid ? '通过' : '未通过' }
      ]

      items.forEach(item => {
        const row = createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: item.label }),
          createElement('span', { className: 'stat-value', textContent: item.value })
        ])
        resultContainer.appendChild(row)
      })
    }

    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(errorEl)
    container.appendChild(resultContainer)
  }
}
