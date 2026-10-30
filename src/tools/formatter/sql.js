import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import { SQL_DIALECTS, formatSql } from '../../utils/format.js'

export default {
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 SQL 语句...',
      rows: 8
    })

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 10,
      readOnly: true
    })

    const dialect = createElement('select', { className: 'select', 'aria-label': 'SQL 方言' },
      SQL_DIALECTS.map(item => createElement('option', { value: item.value, textContent: item.label })))
    dialect.value = 'sql'

    const status = createElement('div', { className: 'form-hint', role: 'status', 'aria-live': 'polite' })
    const error = createElement('div', { className: 'error-text' })

    const beautifyBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '美化 SQL'
    })

    const copyBtn = createCopyButton(() => output.value)

    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据'
    })

    async function beautify() {
      const text = input.value.trim()
      error.textContent = ''
      if (!text) return
      beautifyBtn.disabled = true
      status.textContent = '正在加载格式化器…'
      try {
        output.value = await formatSql(text, dialect.value)
        status.textContent = ''
      } catch (cause) {
        output.value = ''
        status.textContent = ''
        error.textContent = `格式化失败：${cause instanceof Error ? cause.message : String(cause)}`
      } finally {
        beautifyBtn.disabled = false
      }
    }

    beautifyBtn.addEventListener('click', beautify)
    dialect.addEventListener('change', () => {
      if (input.value.trim() && output.value) beautify()
    })

    const btnGroup = createElement('div', { className: 'btn-group' }, [beautifyBtn, exampleBtn, copyBtn])

    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: 'SQL 方言' }),
        dialect
      ])
    ])

    const inputSection = createSection('输入 SQL', input)
    const outputSection = createSection('输出结果', output, [copyBtn])

    container.appendChild(options)
    container.appendChild(inputSection)
    container.appendChild(btnGroup)
    container.appendChild(status)
    container.appendChild(error)
    container.appendChild(outputSection)

    exampleBtn.addEventListener('click', () => {
      input.value = `select u.id, u.name, u.email, o.order_id, o.total_amount, o.created_at from users u left join orders o on u.id = o.user_id where u.status = 'active' and o.total_amount > 100 group by u.id, o.order_id order by o.created_at desc limit 50`
    })
  }
}
