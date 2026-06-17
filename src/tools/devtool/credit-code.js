import { createElement, createSection } from '../../utils/dom.js'

export default {
  id: 'credit-code',
  name: '统一社会信用代码校验',
  description: '校验18位统一社会信用代码，解析登记管理机关和机构类型',
  category: 'devtool',
  icon: 'search',
  render(container) {
    const BASE_CODES = '0123456789ABCDEFGHJKLMNPQRTUWXY'
    const WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]

    const ENTITY_TYPES = {
      '1': '机构编制-机关', '2': '机构编制-事业单位', '3': '机构编制-编办直接管理机构编制的群众团体',
      '4': '机构编制-其他', '5': '机构编制-中央编办管理的群众团体',
      '6': '企业', '7': '个体工商户', '8': '农民专业合作社', '9': '其他'
    }

    const REG_AUTHORITY = {
      '1': '民政', '2': '机构编制', '3': '工商', '9': '其他'
    }

    function validateCreditCode(code) {
      if (!code || code.length !== 18) {
        return { valid: false, error: '统一社会信用代码必须为18位' }
      }

      const upperCode = code.toUpperCase()
      if (!/^[0-9A-Z]{18}$/.test(upperCode)) {
        return { valid: false, error: '代码格式错误，只能包含数字和大写字母' }
      }

      const firstChar = upperCode[0]
      if (!'1239'.includes(firstChar)) {
        return { valid: false, error: '第一位登记管理部门代码无效' }
      }

      const secondChar = upperCode[1]
      if (!ENTITY_TYPES[secondChar]) {
        return { valid: false, error: '第二位机构类型代码无效' }
      }

      let weightedSum = 0
      for (let i = 0; i < 17; i++) {
        const idx = BASE_CODES.indexOf(upperCode[i])
        if (idx === -1) {
          return { valid: false, error: `第${i + 1}位字符无效` }
        }
        weightedSum += idx * WEIGHTS[i]
      }

      const mod = weightedSum % 31
      const checkIdx = mod === 0 ? 0 : 31 - mod
      const expectedCheck = BASE_CODES[checkIdx]

      if (upperCode[17] !== expectedCheck) {
        return { valid: false, error: `校验码错误，期望: ${expectedCheck}` }
      }

      return {
        valid: true,
        regAuthority: REG_AUTHORITY[firstChar] || '未知',
        entityType: ENTITY_TYPES[secondChar] || '未知',
        orgCode: upperCode.slice(8, 17)
      }
    }

    function breakdownCode(code) {
      const upper = code.toUpperCase()
      return [
        { label: '第1位 - 登记管理部门', value: `${upper[0]} (${REG_AUTHORITY[upper[0]] || '未知'})` },
        { label: '第2位 - 机构类型', value: `${upper[1]} (${ENTITY_TYPES[upper[1]] || '未知'})` },
        { label: '第3-8位 - 登记管理机关行政区划码', value: upper.slice(2, 8) },
        { label: '第9-17位 - 主体标识码(组织机构代码)', value: upper.slice(8, 17) },
        { label: '第18位 - 校验码', value: upper[17] }
      ]
    }

    const inputGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'crc-input' }, ['统一社会信用代码']),
      createElement('input', {
        className: 'input',
        type: 'text',
        id: 'crc-input',
        placeholder: '请输入18位统一社会信用代码',
        maxlength: '18'
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
        document.getElementById('crc-input').value = ''
        errorEl.textContent = ''
        resultContainer.setAttribute('hidden', 'true')
        structureContainer.setAttribute('hidden', 'true')
      }
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [validateBtn, clearBtn])

    const errorEl = createElement('div', { className: 'error-text' })

    const resultContainer = createElement('div', { className: 'result-box' })
    resultContainer.setAttribute('hidden', 'true')

    const structureContainer = createElement('div', { className: 'result-box' })
    structureContainer.setAttribute('hidden', 'true')

    function doValidate() {
      const code = document.getElementById('crc-input').value.trim()
      errorEl.textContent = ''
      resultContainer.setAttribute('hidden', 'true')
      resultContainer.innerHTML = ''
      structureContainer.setAttribute('hidden', 'true')
      structureContainer.innerHTML = ''

      if (!code) {
        errorEl.textContent = '请输入统一社会信用代码'
        return
      }

      const result = validateCreditCode(code)
      if (!result.valid) {
        errorEl.textContent = result.error
        return
      }

      resultContainer.removeAttribute('hidden')
      const items = [
        { label: '登记管理部门', value: result.regAuthority },
        { label: '机构类型', value: result.entityType },
        { label: '校验结果', value: '有效' }
      ]

      items.forEach(item => {
        const row = createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: item.label }),
          createElement('span', { className: 'stat-value', textContent: item.value })
        ])
        resultContainer.appendChild(row)
      })

      structureContainer.removeAttribute('hidden')
      breakdownCode(code).forEach(item => {
        const row = createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: item.label }),
          createElement('span', { className: 'stat-value', textContent: item.value })
        ])
        structureContainer.appendChild(row)
      })
    }

    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(errorEl)
    container.appendChild(resultContainer)
    container.appendChild(createSection('代码结构分解', structureContainer))
  }
}
