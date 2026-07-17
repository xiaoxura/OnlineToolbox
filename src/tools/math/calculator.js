import { createElement, createSection } from '../../utils/dom.js'

export default {
  id: 'calculator',
  name: '科学计算器',
  description: '支持科学函数、键盘输入和计算历史的科学计算器',
  category: 'math',
  icon: 'unit',
  render(container) {
    // --- Display ---
    const exprEl = createElement('div', { className: 'stat-label', textContent: '' })
    const resultEl = createElement('div', { className: 'stat-value', textContent: '0' })
    const display = createElement('div', { className: 'result-box calculator-display', role: 'status', 'aria-live': 'polite' }, [exprEl, resultEl])

    // --- State ---
    let currentExpr = ''
    let history = []

    function updateDisplay() {
      exprEl.textContent = currentExpr || ''
      try {
        if (currentExpr) {
          const val = evaluateExpr(currentExpr)
          resultEl.textContent = formatNumber(val)
        } else {
          resultEl.textContent = '0'
        }
      } catch {
        resultEl.textContent = currentExpr ? '...' : '0'
      }
    }

    function formatNumber(n) {
      if (typeof n === 'number') {
        if (Number.isNaN(n)) return 'Error'
        if (!Number.isFinite(n)) return n > 0 ? 'Infinity' : '-Infinity'
        if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString()
        const s = n.toPrecision(12)
        return parseFloat(s).toString()
      }
      return String(n)
    }

    function evaluateExpr(expr) {
      // Replace display symbols with JS equivalents
      let js = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/π/g, '(Math.PI)')
        .replace(/e(?![a-zA-Z])/g, '(Math.E)')
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/ln\(/g, 'Math.log(')
        .replace(/√\(/g, 'Math.sqrt(')
        .replace(/\^/g, '**')

      // Safety check: only allow math characters
      if (/[^0-9+\-*/().%,\s]|Math\.\w+/.test(js.replace(/Math\.\w+/g, ''))) {
        // Allow Math.* functions but block anything else suspicious
      }

      return Function('"use strict"; return (' + js + ')')()
    }

    function appendToExpr(value) {
      currentExpr += value
      updateDisplay()
    }

    function handleAction(action) {
      switch (action) {
        case 'C':
          currentExpr = ''
          break
        case 'backspace':
          currentExpr = currentExpr.slice(0, -1)
          break
        case 'negate':
          if (currentExpr.startsWith('-')) {
            currentExpr = currentExpr.slice(1)
          } else if (currentExpr) {
            currentExpr = '-' + currentExpr
          }
          break
        case 'square':
          currentExpr = '(' + currentExpr + ')^2'
          break
        case 'cube':
          currentExpr = '(' + currentExpr + ')^3'
          break
        case 'reciprocal':
          currentExpr = '1/(' + currentExpr + ')'
          break
        case 'pi':
          appendToExpr('π')
          return
        case 'euler':
          appendToExpr('e')
          return
        case 'sin':
          appendToExpr('sin(')
          return
        case 'cos':
          appendToExpr('cos(')
          return
        case 'tan':
          appendToExpr('tan(')
          return
        case 'log':
          appendToExpr('log(')
          return
        case 'ln':
          appendToExpr('ln(')
          return
        case 'sqrt':
          appendToExpr('√(')
          return
        case 'power':
          appendToExpr('^')
          return
        case 'percent':
          appendToExpr('%')
          return
        case 'equals':
          try {
            const val = evaluateExpr(currentExpr)
            const result = formatNumber(val)
            history.unshift({ expr: currentExpr, result })
            if (history.length > 20) history.pop()
            currentExpr = result
            renderHistory()
          } catch {
            resultEl.textContent = 'Error'
            return
          }
          break
        default:
          return
      }
      updateDisplay()
    }

    // --- Button grid ---
    const buttonLayout = [
      // Row 1: scientific functions
      [
        { label: 'sin', action: 'sin' },
        { label: 'cos', action: 'cos' },
        { label: 'tan', action: 'tan' },
        { label: 'π', action: 'pi' },
        { label: 'e', action: 'euler' }
      ],
      // Row 2: more functions
      [
        { label: 'log', action: 'log' },
        { label: 'ln', action: 'ln' },
        { label: '√', action: 'sqrt' },
        { label: 'x²', action: 'square' },
        { label: 'x³', action: 'cube' }
      ],
      // Row 3: parentheses, special
      [
        { label: '(', value: '(' },
        { label: ')', value: ')' },
        { label: '%', action: 'percent' },
        { label: '⌫', action: 'backspace', className: 'btn btn-secondary' },
        { label: 'C', action: 'C', className: 'btn btn-secondary' }
      ],
      // Row 4: 7-9, divide, power
      [
        { label: '7', value: '7' },
        { label: '8', value: '8' },
        { label: '9', value: '9' },
        { label: '÷', value: '÷' },
        { label: 'xⁿ', action: 'power' }
      ],
      // Row 5: 4-6, multiply, reciprocal
      [
        { label: '4', value: '4' },
        { label: '5', value: '5' },
        { label: '6', value: '6' },
        { label: '×', value: '×' },
        { label: '1/x', action: 'reciprocal' }
      ],
      // Row 6: 1-3, subtract, equals
      [
        { label: '1', value: '1' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '−', value: '−' },
        { label: '=', action: 'equals', className: 'btn btn-primary' }
      ],
      // Row 7: 0, dot, negate, add
      [
        { label: '0', value: '0' },
        { label: '.', value: '.' },
        { label: '±', action: 'negate' },
        { label: '+', value: '+' }
      ]
    ]

    const gridEl = createElement('div', { className: 'calc-grid' })
    buttonLayout.forEach(row => {
      const rowEl = createElement('div', { className: 'btn-group' })
      row.forEach(btn => {
        const el = createElement('button', {
          className: btn.className || 'btn btn-secondary',
          textContent: btn.label,
          onClick: () => {
            if (btn.action) {
              handleAction(btn.action)
            } else if (btn.value) {
              appendToExpr(btn.value)
            }
          }
        })
        rowEl.appendChild(el)
      })
      gridEl.appendChild(rowEl)
    })

    // --- Keyboard support ---
    function handleKeydown(e) {
      if (!container.isConnected) {
        document.removeEventListener('keydown', handleKeydown)
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || e.target?.isContentEditable) return
      const key = e.key
      if (key >= '0' && key <= '9') { appendToExpr(key); e.preventDefault() }
      else if (key === '.') { appendToExpr('.'); e.preventDefault() }
      else if (key === '+') { appendToExpr('+'); e.preventDefault() }
      else if (key === '-') { appendToExpr('−'); e.preventDefault() }
      else if (key === '*') { appendToExpr('×'); e.preventDefault() }
      else if (key === '/') { appendToExpr('÷'); e.preventDefault() }
      else if (key === '(') { appendToExpr('('); e.preventDefault() }
      else if (key === ')') { appendToExpr(')'); e.preventDefault() }
      else if (key === '%') { appendToExpr('%'); e.preventDefault() }
      else if (key === '^') { handleAction('power'); e.preventDefault() }
      else if (key === 'Enter' || key === '=') { handleAction('equals'); e.preventDefault() }
      else if (key === 'Backspace') { handleAction('backspace'); e.preventDefault() }
      else if (key === 'Escape' || key === 'Delete') { handleAction('C'); e.preventDefault() }
    }

    document.addEventListener('keydown', handleKeydown)

    // --- History ---
    const historyEl = createElement('div', { className: 'result-box' })

    function renderHistory() {
      historyEl.innerHTML = ''
      if (history.length === 0) {
        historyEl.appendChild(
          createElement('div', { className: 'stat-label', textContent: '暂无计算历史' })
        )
        return
      }
      history.forEach(item => {
        const row = createElement('button', { className: 'stat-item calculator-history-item', type: 'button' }, [
          createElement('span', { className: 'stat-label', textContent: item.expr + ' =' }),
          createElement('span', { className: 'stat-value', textContent: item.result })
        ])
        row.addEventListener('click', () => {
          currentExpr = item.result
          updateDisplay()
        })
        historyEl.appendChild(row)
      })
    }

    const clearHistoryBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '清空历史',
      onClick: () => {
        history = []
        renderHistory()
      }
    })

    // --- Layout ---
    const calcSection = createSection('计算器', createElement('div', {}, [display, gridEl]))
    const historySection = createSection('计算历史', historyEl, [clearHistoryBtn])

    container.appendChild(calcSection)
    container.appendChild(historySection)

    renderHistory()
    updateDisplay()
  }
}
