import { createElement, showToast } from '../../utils/dom.js'

export default {
  id: 'id-card',
  name: '身份证号校验',
  description: '校验18位身份证号码，提取省份、生日、性别等信息',
  category: 'devtool',
  icon: 'search',
  render(container) {
    const AREA_CODES = {
      '11': '北京', '12': '天津', '13': '河北', '14': '山西', '15': '内蒙古',
      '21': '辽宁', '22': '吉林', '23': '黑龙江',
      '31': '上海', '32': '江苏', '33': '浙江', '34': '安徽', '35': '福建', '36': '江西', '37': '山东',
      '41': '河南', '42': '湖北', '43': '湖南', '44': '广东', '45': '广西', '46': '海南',
      '50': '重庆', '51': '四川', '52': '贵州', '53': '云南', '54': '西藏',
      '61': '陕西', '62': '甘肃', '63': '青海', '64': '宁夏', '65': '新疆',
      '71': '台湾', '81': '香港', '82': '澳门', '91': '国外'
    }

    const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
    const CHECK_CODES = '10X98765432'

    const inputGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'idc-input' }, ['身份证号码']),
      createElement('input', {
        className: 'input',
        type: 'text',
        id: 'idc-input',
        placeholder: '请输入18位身份证号码',
        maxlength: '18'
      })
    ])

    const validateBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '校验',
      onClick: doValidate
    })

    const generateBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '生成测试号码',
      onClick: generateTest
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [validateBtn, generateBtn])

    const errorEl = createElement('div', { className: 'error-text' })

    const resultContainer = createElement('div', { className: 'result-box' })
    resultContainer.setAttribute('hidden', 'true')

    const disclaimer = createElement('div', { className: 'error-text' })
    disclaimer.textContent = '提示: 生成的号码仅用于测试，不对应真实个人信息'

    function validateIdCard(id) {
      if (!id || id.length !== 18) {
        return { valid: false, error: '身份证号码必须为18位' }
      }

      const upperId = id.toUpperCase()
      if (!/^\d{17}[\dX]$/.test(upperId)) {
        return { valid: false, error: '身份证号码格式错误' }
      }

      const areaCode = upperId.slice(0, 2)
      if (!AREA_CODES[areaCode]) {
        return { valid: false, error: '未知的地区编码' }
      }

      const year = parseInt(upperId.slice(6, 10))
      const month = parseInt(upperId.slice(10, 12))
      const day = parseInt(upperId.slice(12, 14))

      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return { valid: false, error: '出生日期无效' }
      }

      const birthDate = new Date(year, month - 1, day)
      if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) {
        return { valid: false, error: '出生日期无效' }
      }

      let weightedSum = 0
      for (let i = 0; i < 17; i++) {
        weightedSum += parseInt(upperId[i]) * WEIGHTS[i]
      }
      const expectedCheck = CHECK_CODES[weightedSum % 11]
      if (upperId[17] !== expectedCheck) {
        return { valid: false, error: `校验码错误，期望: ${expectedCheck}` }
      }

      const province = AREA_CODES[areaCode]
      const gender = parseInt(upperId[16]) % 2 === 1 ? '男' : '女'

      const now = new Date()
      let age = now.getFullYear() - year
      if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) {
        age--
      }

      return {
        valid: true,
        province,
        city: upperId.slice(0, 4) + '00',
        birthday: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        gender,
        age
      }
    }

    function doValidate() {
      const id = document.getElementById('idc-input').value.trim()
      errorEl.textContent = ''
      resultContainer.setAttribute('hidden', 'true')

      const result = validateIdCard(id)
      if (!result.valid) {
        errorEl.textContent = result.error
        return
      }

      resultContainer.removeAttribute('hidden')
      resultContainer.innerHTML = ''

      const items = [
        { label: '省份', value: result.province },
        { label: '出生日期', value: result.birthday },
        { label: '性别', value: result.gender },
        { label: '年龄', value: result.age + ' 岁' },
        { label: '校验结果', value: '有效' }
      ]

      items.forEach(item => {
        const row = createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: item.label }),
          createElement('span', { className: 'stat-value', textContent: item.value })
        ])
        resultContainer.appendChild(row)
      })
    }

    function generateTest() {
      const areaCodes = Object.keys(AREA_CODES)
      const area = areaCodes[Math.floor(Math.random() * areaCodes.length)]

      const year = 1970 + Math.floor(Math.random() * 40)
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')
      const seq = String(Math.floor(Math.random() * 99) + 1).padStart(3, '0')
      const genderDigit = String(Math.floor(Math.random() * 10))

      const idBase = `${area}${year}${month}${day}${seq}${genderDigit}`

      let weightedSum = 0
      for (let i = 0; i < 17; i++) {
        weightedSum += parseInt(idBase[i]) * WEIGHTS[i]
      }
      const checkCode = CHECK_CODES[weightedSum % 11]

      document.getElementById('idc-input').value = idBase + checkCode
      showToast('已生成测试号码')
    }

    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(disclaimer)
    container.appendChild(errorEl)
    container.appendChild(resultContainer)
  }
}
