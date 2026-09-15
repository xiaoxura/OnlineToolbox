import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'
import { chatFormats, formatById } from './chat-formats.js'

const ROLES = [
  { value: 'system', label: 'system' },
  { value: 'user', label: 'user' },
  { value: 'assistant', label: 'assistant' }
]

const formatOptions = chatFormats.map(format => ({ value: format.id, label: format.label }))

export default {
  id: 'chat-builder',
  name: '对话消息组装器',
  description: '可视化拼装 system / user / assistant 消息，导出为各家 API 的消息格式',
  category: 'ai',
  icon: 'ai-chat',
  render(container) {
    const rowsHost = createElement('div')
    // A result box rather than a read-only textarea: the builder's "input" is a
    // dynamic list of rows, so the automatic input→output split would offer a
    // "swap" button that dumps the JSON into whichever row happens to be first.
    const output = createElement('pre', { className: 'result-box' })

    let rows = []
    let targetId = 'openai'
    let seed = 0

    // Rebuild the neutral representation from the current rows. system rows
    // collapse into the top-level system field, the rest become messages.
    function buildIr() {
      const ir = { system: '', messages: [] }
      for (const row of rows) {
        const text = row.content.value.trim()
        if (!text) continue
        const role = row.role.value
        if (role === 'system') {
          ir.system = ir.system ? `${ir.system}\n\n${text}` : text
        } else {
          ir.messages.push({ role, parts: [{ type: 'text', text }] })
        }
      }
      return ir
    }

    function render() {
      if (!rows.length) {
        output.textContent = ''
        return
      }
      const ir = buildIr()
      if (!ir.system && !ir.messages.length) {
        output.textContent = '（还没有内容，请在上方填写消息）'
        return
      }
      try {
        output.textContent = JSON.stringify(formatById(targetId).generate(ir), null, 2)
      } catch (cause) {
        output.textContent = `生成失败：${cause.message}`
      }
    }

    function addRow(role = 'user', text = '') {
      const id = ++seed
      const select = createElement('select', { className: 'select', 'aria-label': `第 ${rows.length + 1} 条消息的角色` }, ROLES.map(item =>
        createElement('option', { value: item.value, textContent: item.label })
      ))
      select.value = role
      const content = createElement('textarea', {
        className: 'textarea',
        placeholder: role === 'system' ? '系统提示词…' : '消息内容…',
        'aria-label': `第 ${rows.length + 1} 条消息的内容`,
        rows: 3
      })
      content.value = text

      const row = { id, role: select, content }
      const remove = createElement('button', {
        className: 'btn btn-secondary btn-sm',
        type: 'button',
        textContent: '删除',
        onClick: () => {
          rows = rows.filter(item => item.id !== id)
          renderRows()
        }
      })

      const node = createElement('div', { className: 'form-group' }, [
        createElement('div', { className: 'form-row' }, [select, remove]),
        content
      ])
      row.node = node
      rows.push(row)

      select.addEventListener('change', () => {
        content.placeholder = select.value === 'system' ? '系统提示词…' : '消息内容…'
        render()
      })
      content.addEventListener('input', render)
      return row
    }

    function renderRows() {
      rowsHost.replaceChildren(...rows.map(row => row.node))
      render()
    }

    targetId = 'openai'
    const formatGroup = createSegmentedGroup(formatOptions, value => {
      targetId = value
      render()
    }, { label: '导出格式' })

    addRow('system', '你是一个严谨的技术助手，回答尽量简洁。')
    addRow('user', '什么是向量数据库？')
    renderRows()

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '导出格式' }),
          formatGroup
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '添加消息',
          onClick: () => {
            addRow('user')
            renderRows()
          }
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '清空',
          onClick: () => {
            rows = []
            renderRows()
            addRow('user')
            renderRows()
          }
        })
      ]),
      createSection('消息列表', rowsHost),
      createSection('导出结果', output)
    )
  }
}
