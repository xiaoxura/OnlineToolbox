import { createCopyButton, createElement, createSection, createTabGroup } from '../../utils/dom.js'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export default {
  id: 'date-calc',
  name: '日期计算器',
  description: '计算日期差和日期加减',
  category: 'converter',
  icon: 'timestamp',

  render(container) {
    const tabs = createTabGroup([
      {
        label: '日期差计算',
        content: renderDiffTab
      },
      {
        label: '日期加减',
        content: renderAddTab
      }
    ], () => {}, { label: '日期计算模式' })
    container.appendChild(tabs.element)

    function daysBetween(d1, d2) {
      const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())
      const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate())
      return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24))
    }

    function countWeekdays(d1, d2) {
      const start = d1 < d2 ? d1 : d2
      const end = d1 < d2 ? d2 : d1
      let count = 0
      const current = new Date(start)
      while (current <= end) {
        const day = current.getDay()
        if (day !== 0 && day !== 6) count++
        current.setDate(current.getDate() + 1)
      }
      return count
    }

    function formatDate(d) {
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    function renderDiffTab(container) {
      container.classList.add('tool-stack')
      const row = createElement('div', { className: 'form-row' })

      const startGroup = createElement('div', { className: 'form-group' })
      const startLabel = createElement('label', { className: 'label', textContent: '开始日期' })
      const startInput = createElement('input', {
        className: 'input',
        attrs: { type: 'date' }
      })
      startGroup.appendChild(startLabel)
      startGroup.appendChild(startInput)

      const endGroup = createElement('div', { className: 'form-group' })
      const endLabel = createElement('label', { className: 'label', textContent: '结束日期' })
      const endInput = createElement('input', {
        className: 'input',
        attrs: { type: 'date' }
      })
      endGroup.appendChild(endLabel)
      endGroup.appendChild(endInput)

      row.appendChild(startGroup)
      row.appendChild(endGroup)

      const btnGroup = createElement('div', { className: 'btn-group' })
      const calcBtn = createElement('button', {
        className: 'btn btn-primary',
        textContent: '计算'
      })
      const todayBtn = createElement('button', {
        className: 'btn btn-secondary',
        textContent: '使用今天'
      })
      btnGroup.appendChild(calcBtn)
      btnGroup.appendChild(todayBtn)

      let resultText = ''
      const resultContent = createElement('div', { className: 'section-result' })
      const copyBtn = createCopyButton(() => resultText)
      const resultSection = createSection('计算结果', resultContent, [copyBtn])
      const errorText = createElement('div', { className: 'error-text', style: 'display:none' })

      container.append(row, btnGroup, errorText, resultSection)

      function calculate() {
        errorText.style.display = 'none'
        resultContent.innerHTML = ''
        resultText = ''

        if (!startInput.value || !endInput.value) {
          errorText.textContent = '请选择开始和结束日期'
          errorText.style.display = 'block'
          return
        }

        const d1 = new Date(startInput.value)
        const d2 = new Date(endInput.value)

        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
          errorText.textContent = '无效的日期'
          errorText.style.display = 'block'
          return
        }

        const diff = Math.abs(daysBetween(d1, d2))
        const weekdays = countWeekdays(d1, d2)
        const weeks = Math.floor(diff / 7)

        const infoRow = createElement('div', { className: 'stats-row' })

        const startItem = createElement('div', { className: 'stat-item' })
        const startLabelEl = createElement('span', { className: 'stat-label', textContent: '开始日期' })
        const startVal = createElement('span', {
          className: 'stat-value',
          textContent: `${formatDate(d1)} ${WEEKDAYS[d1.getDay()]}`
        })
        startItem.appendChild(startLabelEl)
        startItem.appendChild(startVal)
        infoRow.appendChild(startItem)

        const endItem = createElement('div', { className: 'stat-item' })
        const endLabelEl = createElement('span', { className: 'stat-label', textContent: '结束日期' })
        const endVal = createElement('span', {
          className: 'stat-value',
          textContent: `${formatDate(d2)} ${WEEKDAYS[d2.getDay()]}`
        })
        endItem.appendChild(endLabelEl)
        endItem.appendChild(endVal)
        infoRow.appendChild(endItem)
        resultContent.appendChild(infoRow)

        const statsRow = createElement('div', { className: 'stats-row' })

        const daysItem = createElement('div', { className: 'stat-item' })
        const daysLabel = createElement('span', { className: 'stat-label', textContent: '天数差' })
        const daysValue = createElement('span', { className: 'stat-value', textContent: `${diff} 天` })
        daysItem.appendChild(daysLabel)
        daysItem.appendChild(daysValue)
        statsRow.appendChild(daysItem)

        const wdItem = createElement('div', { className: 'stat-item' })
        const wdLabel = createElement('span', { className: 'stat-label', textContent: '工作日差' })
        const wdValue = createElement('span', { className: 'stat-value', textContent: `${weekdays} 天` })
        wdItem.appendChild(wdLabel)
        wdItem.appendChild(wdValue)
        statsRow.appendChild(wdItem)

        const weekItem = createElement('div', { className: 'stat-item' })
        const weekLabel = createElement('span', { className: 'stat-label', textContent: '周数差' })
        const weekValue = createElement('span', {
          className: 'stat-value',
          textContent: `${weeks} 周 ${diff % 7} 天`
        })
        weekItem.appendChild(weekLabel)
        weekItem.appendChild(weekValue)
        statsRow.appendChild(weekItem)

        resultContent.appendChild(statsRow)
        resultText = `${formatDate(d1)} 至 ${formatDate(d2)}：相差 ${diff} 天，工作日 ${weekdays} 天，${weeks} 周 ${diff % 7} 天`
      }

      calcBtn.addEventListener('click', calculate)
      todayBtn.addEventListener('click', () => {
        const today = formatDate(new Date())
        endInput.value = today
        if (!startInput.value) startInput.value = today
      })
    }

    function renderAddTab(container) {
      container.classList.add('tool-stack')
      const inputGroup = createElement('div', { className: 'form-group' })
      const dateLabel = createElement('label', { className: 'label', textContent: '起始日期' })
      const dateInput = createElement('input', {
        className: 'input',
        attrs: { type: 'date' }
      })
      inputGroup.appendChild(dateLabel)
      inputGroup.appendChild(dateInput)

      const row = createElement('div', { className: 'form-row' })

      const daysGroup = createElement('div', { className: 'form-group' })
      const daysLabel = createElement('label', { className: 'label', textContent: '天数' })
      const daysInput = createElement('input', {
        className: 'input',
        attrs: { type: 'number', value: '30', placeholder: '30' }
      })
      daysGroup.appendChild(daysLabel)
      daysGroup.appendChild(daysInput)

      const opGroup = createElement('div', { className: 'form-group' })
      const opLabel = createElement('label', { className: 'label', textContent: '操作' })
      const opSelect = createElement('select', { className: 'select' })
      const addOpt = createElement('option', { attrs: { value: 'add' }, textContent: '加' })
      const subOpt = createElement('option', { attrs: { value: 'sub' }, textContent: '减' })
      opSelect.appendChild(addOpt)
      opSelect.appendChild(subOpt)
      opGroup.appendChild(opLabel)
      opGroup.appendChild(opSelect)

      row.appendChild(daysGroup)
      row.appendChild(opGroup)

      const btnGroup = createElement('div', { className: 'btn-group' })
      const calcBtn = createElement('button', {
        className: 'btn btn-primary',
        textContent: '计算'
      })
      btnGroup.appendChild(calcBtn)

      let resultText = ''
      const resultContent = createElement('div', { className: 'section-result' })
      const copyBtn = createCopyButton(() => resultText)
      const resultSection = createSection('计算结果', resultContent, [copyBtn])
      const errorText = createElement('div', { className: 'error-text', style: 'display:none' })

      container.append(inputGroup, row, btnGroup, errorText, resultSection)

      function calculate() {
        errorText.style.display = 'none'
        resultContent.innerHTML = ''
        resultText = ''

        if (!dateInput.value) {
          errorText.textContent = '请选择起始日期'
          errorText.style.display = 'block'
          return
        }

        const days = parseInt(daysInput.value, 10)
        if (isNaN(days)) {
          errorText.textContent = '请输入有效的天数'
          errorText.style.display = 'block'
          return
        }

        const base = new Date(dateInput.value)
        if (isNaN(base.getTime())) {
          errorText.textContent = '无效的日期'
          errorText.style.display = 'block'
          return
        }

        const op = opSelect.value
        const result = new Date(base)
        result.setDate(result.getDate() + (op === 'add' ? days : -days))

        const statsRow = createElement('div', { className: 'stats-row' })

        const baseItem = createElement('div', { className: 'stat-item' })
        const baseLabel = createElement('span', { className: 'stat-label', textContent: '起始日期' })
        const baseVal = createElement('span', {
          className: 'stat-value',
          textContent: `${formatDate(base)} ${WEEKDAYS[base.getDay()]}`
        })
        baseItem.appendChild(baseLabel)
        baseItem.appendChild(baseVal)
        statsRow.appendChild(baseItem)

        const resultItem = createElement('div', { className: 'stat-item' })
        const resultLabel = createElement('span', {
          className: 'stat-label',
          textContent: `结果 (${op === 'add' ? '+' : '-'}${days} 天)`
        })
        const resultVal = createElement('span', {
          className: 'stat-value',
          textContent: `${formatDate(result)} ${WEEKDAYS[result.getDay()]}`
        })
        resultItem.appendChild(resultLabel)
        resultItem.appendChild(resultVal)
        statsRow.appendChild(resultItem)

        resultContent.appendChild(statsRow)
        resultText = formatDate(result)
      }

      calcBtn.addEventListener('click', calculate)
    }
  }
}
