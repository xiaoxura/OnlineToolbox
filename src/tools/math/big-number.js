import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'

export default {
  id: 'big-number',
  name: '大数计算器',
  description: '大数进制转换和高精度四则运算，支持任意长度整数',
  category: 'math',
  icon: 'radix',
  render(container) {
    const tabContainer = createElement('div')
    const contentContainer = createElement('div')
    container.appendChild(tabContainer)
    container.appendChild(contentContainer)

    const panels = {}
    let activePanel = null

    // ==================== Tab 1: Base Conversion ====================
    const basePanel = createElement('div')

    const baseInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '输入大整数'
    })

    const fromBaseSelect = createElement('select', { className: 'select' },
      Array.from({ length: 35 }, (_, i) => i + 2).map(b =>
        createElement('option', { value: b.toString(), textContent: `进制 ${b}` })
      )
    )
    fromBaseSelect.value = '10'

    const baseErrorEl = createElement('div', { className: 'error-text' })

    const baseResultsEl = createElement('div', { className: 'result-box' })

    const targetBases = [2, 8, 10, 16, 36]

    function convertBase() {
      const val = baseInput.value.trim()
      baseResultsEl.innerHTML = ''
      baseErrorEl.textContent = ''

      if (!val) return

      const fromBase = parseInt(fromBaseSelect.value, 10)

      // Validate input
      try {
        const decimalVal = parseBigIntFromBase(val, fromBase)

        targetBases.forEach(base => {
          const converted = bigIntToBase(decimalVal, base)
          const row = createElement('div', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: `${base} 进制:` }),
            createElement('span', { className: 'stat-value', textContent: converted })
          ])
          baseResultsEl.appendChild(row)
        })
      } catch (e) {
        baseErrorEl.textContent = '输入无效: ' + e.message
      }
    }

    baseInput.addEventListener('input', convertBase)
    fromBaseSelect.addEventListener('change', convertBase)

    const baseInputRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '输入数值' }),
        baseInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '输入进制' }),
        fromBaseSelect
      ])
    ])

    const baseContent = createElement('div', {}, [baseInputRow, baseErrorEl, baseResultsEl])
    const baseSection = createSection('进制转换', baseContent)
    basePanel.appendChild(baseSection)

    // ==================== Tab 2: Big Number Arithmetic ====================
    const arithPanel = createElement('div')

    const num1Input = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '第一个大整数'
    })

    const num2Input = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '第二个大整数'
    })

    const opSelect = createElement('select', { className: 'select' }, [
      createElement('option', { value: 'add', textContent: '加法 (+)' }),
      createElement('option', { value: 'sub', textContent: '减法 (-)' }),
      createElement('option', { value: 'mul', textContent: '乘法 (×)' }),
      createElement('option', { value: 'div', textContent: '除法 (÷) 取商' }),
      createElement('option', { value: 'mod', textContent: '除法 取余 (%)' }),
      createElement('option', { value: 'pow', textContent: '幂运算 (^)' })
    ])

    const arithErrorEl = createElement('div', { className: 'error-text' })

    const arithResultEl = createElement('div', { className: 'result-box' })

    function calculateArith() {
      const v1 = num1Input.value.trim()
      const v2 = num2Input.value.trim()
      arithResultEl.innerHTML = ''
      arithErrorEl.textContent = ''

      if (!v1 || !v2) return

      try {
        const a = BigInt(v1)
        const b = BigInt(v2)
        const op = opSelect.value
        let result

        switch (op) {
          case 'add': result = a + b; break
          case 'sub': result = a - b; break
          case 'mul': result = a * b; break
          case 'div':
            if (b === 0n) throw new Error('除数不能为零')
            result = a / b
            break
          case 'mod':
            if (b === 0n) throw new Error('除数不能为零')
            result = a % b
            break
          case 'pow':
            if (b < 0n) throw new Error('指数不能为负数')
            if (b > 100000n) throw new Error('指数过大，可能造成内存溢出')
            result = a ** b
            break
          default:
            throw new Error('未知运算')
        }

        // Show results in multiple bases
        const bases = [2, 8, 10, 16]
        const opSymbols = { add: '+', sub: '-', mul: '×', div: '÷', mod: '%', pow: '^' }

        const exprRow = createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: '表达式:' }),
          createElement('span', { className: 'stat-value', textContent: `${v1} ${opSymbols[op]} ${v2}` })
        ])
        arithResultEl.appendChild(exprRow)

        // Determine sign for base conversion
        const isNeg = result < 0n
        const absResult = isNeg ? -result : result

        bases.forEach(base => {
          const converted = (isNeg ? '-' : '') + bigIntToBase(absResult, base)
          const row = createElement('div', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-label', textContent: `${base} 进制:` }),
            createElement('span', { className: 'stat-value', textContent: converted })
          ])
          arithResultEl.appendChild(row)
        })

        // Show digit count
        const digitRow = createElement('div', { className: 'stat-item' }, [
          createElement('span', { className: 'stat-label', textContent: '十进制位数:' }),
          createElement('span', { className: 'stat-value', textContent: absResult.toString().length.toString() })
        ])
        arithResultEl.appendChild(digitRow)

      } catch (e) {
        arithErrorEl.textContent = '计算错误: ' + e.message
      }
    }

    const calcBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '计算',
      onClick: calculateArith
    })

    num1Input.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculateArith() })
    num2Input.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculateArith() })

    const arithInputRow1 = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '第一个数' }),
        num1Input
      ])
    ])

    const arithInputRow2 = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '运算' }),
        opSelect
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '第二个数' }),
        num2Input
      ])
    ])

    const arithContent = createElement('div', {}, [
      arithInputRow1,
      arithInputRow2,
      arithErrorEl,
      arithResultEl
    ])
    const arithSection = createSection('大数运算', arithContent, [calcBtn])
    arithPanel.appendChild(arithSection)

    // ==================== Tabs ====================
    panels['base'] = basePanel
    panels['arith'] = arithPanel

    const tabs = createSegmentedGroup([
      { label: '进制转换', value: 'base' },
      { label: '大数运算', value: 'arith' }
    ], (value) => {
      if (activePanel) activePanel.style.display = 'none'
      panels[value].style.display = 'block'
      activePanel = panels[value]
    })

    tabContainer.appendChild(tabs)
    contentContainer.appendChild(basePanel)
    contentContainer.appendChild(arithPanel)

    // Show first tab
    basePanel.style.display = 'block'
    arithPanel.style.display = 'none'
    activePanel = basePanel
  }
}

// --- BigInt base conversion helpers ---

const digitChars = '0123456789abcdefghijklmnopqrstuvwxyz'

function parseBigIntFromBase(str, base) {
  const s = str.trim().toLowerCase()
  const isNeg = s.startsWith('-')
  const clean = isNeg ? s.slice(1) : s

  if (!clean) throw new Error('输入为空')

  let result = 0n
  for (const ch of clean) {
    const val = digitChars.indexOf(ch)
    if (val === -1 || val >= base) {
      throw new Error(`字符 "${ch}" 不是有效的 ${base} 进制数字`)
    }
    result = result * BigInt(base) + BigInt(val)
  }

  return isNeg ? -result : result
}

function bigIntToBase(num, base) {
  if (num === 0n) return '0'

  const b = BigInt(base)
  let digits = ''
  let n = num < 0n ? -num : num

  while (n > 0n) {
    const rem = Number(n % b)
    digits = digitChars[rem] + digits
    n = n / b
  }

  return (num < 0n ? '-' : '') + digits
}
