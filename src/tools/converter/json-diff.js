import { createCopyButton, createElement, createSection } from '../../utils/dom.js'

export default {
  id: 'json-diff',
  name: 'JSON 对比',
  description: '对比两个 JSON 对象的差异，显示新增、删除和修改的内容',
  category: 'converter',
  icon: 'json-yaml',

  render(container) {
    // Two input areas side by side
    const inputRow = createElement('div', { className: 'form-row' })

    const leftGroup = createElement('div', { className: 'form-group' })
    const leftLabel = createElement('label', { className: 'label', textContent: '原始 JSON' })
    const leftInput = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入原始 JSON...',
      rows: 10
    })
    leftGroup.append(leftLabel, leftInput)

    const rightGroup = createElement('div', { className: 'form-group' })
    const rightLabel = createElement('label', { className: 'label', textContent: '修改后 JSON' })
    const rightInput = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入修改后的 JSON...',
      rows: 10
    })
    rightGroup.append(rightLabel, rightInput)

    inputRow.append(leftGroup, rightGroup)

    // Compare button
    const btnGroup = createElement('div', { className: 'btn-group' })
    const compareBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '对比差异'
    })
    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '示例数据'
    })
    btnGroup.append(compareBtn, exampleBtn)

    // Output area
    const resultBox = createElement('div', { className: 'diff-output json-diff-output', role: 'status' }, [
      createElement('div', { className: 'diff-empty', textContent: '输入两组 JSON 后点击“对比差异”' })
    ])

    let lastDiffText = ''
    const copyBtn = createCopyButton(() => lastDiffText)
    const outputSection = createSection('差异结果', resultBox, [copyBtn])

    // Error display
    const errorEl = createElement('div', { className: 'error-text' })

    container.append(inputRow, btnGroup, errorEl, outputSection)

    // Deep diff between two objects
    function diffObjects(obj1, obj2, path) {
      const results = []

      if (typeof obj1 !== typeof obj2) {
        results.push({
          type: 'changed',
          path: path,
          oldValue: obj1,
          newValue: obj2
        })
        return results
      }

      if (obj1 === null || obj2 === null) {
        if (obj1 !== obj2) {
          results.push({
            type: 'changed',
            path: path,
            oldValue: obj1,
            newValue: obj2
          })
        }
        return results
      }

      if (typeof obj1 !== 'object') {
        if (obj1 !== obj2) {
          results.push({
            type: 'changed',
            path: path,
            oldValue: obj1,
            newValue: obj2
          })
        }
        return results
      }

      // Array comparison
      if (Array.isArray(obj1) && Array.isArray(obj2)) {
        const maxLen = Math.max(obj1.length, obj2.length)
        for (let i = 0; i < maxLen; i++) {
          const itemPath = `${path}[${i}]`
          if (i >= obj1.length) {
            results.push({ type: 'added', path: itemPath, newValue: obj2[i] })
          } else if (i >= obj2.length) {
            results.push({ type: 'removed', path: itemPath, oldValue: obj1[i] })
          } else {
            results.push(...diffObjects(obj1[i], obj2[i], itemPath))
          }
        }
        return results
      }

      // Object comparison
      const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])
      for (const key of allKeys) {
        const childPath = path ? `${path}.${key}` : key
        if (!(key in obj1)) {
          results.push({ type: 'added', path: childPath, newValue: obj2[key] })
        } else if (!(key in obj2)) {
          results.push({ type: 'removed', path: childPath, oldValue: obj1[key] })
        } else {
          results.push(...diffObjects(obj1[key], obj2[key], childPath))
        }
      }

      return results
    }

    // Render diff results
    function renderDiff(diffs) {
      resultBox.innerHTML = ''

      if (diffs.length === 0) {
        const msg = createElement('div', {
          className: 'diff-empty',
          textContent: '两个 JSON 完全相同，没有差异。'
        })
        resultBox.append(msg)
        return
      }

      // Summary
      const added = diffs.filter(d => d.type === 'added')
      const removed = diffs.filter(d => d.type === 'removed')
      const changed = diffs.filter(d => d.type === 'changed')

      const summary = createElement('div', { className: 'diff-summary' })
      summary.textContent = `共 ${diffs.length} 处差异：新增 ${added.length}，删除 ${removed.length}，修改 ${changed.length}`
      resultBox.append(summary)

      // Build text for copy
      const lines = [summary.textContent, '']

      // Render each diff
      diffs.forEach(d => {
        let lineClass = ''
        let text = ''

        if (d.type === 'added') {
          const val = typeof d.newValue === 'object' ? JSON.stringify(d.newValue, null, 2) : String(d.newValue)
          lineClass = 'diff-added'
          text = `+ ${d.path}: ${val}`
          lines.push(`[新增] ${d.path}: ${val}`)
        } else if (d.type === 'removed') {
          const val = typeof d.oldValue === 'object' ? JSON.stringify(d.oldValue, null, 2) : String(d.oldValue)
          lineClass = 'diff-removed'
          text = `- ${d.path}: ${val}`
          lines.push(`[删除] ${d.path}: ${val}`)
        } else if (d.type === 'changed') {
          const oldVal = typeof d.oldValue === 'object' ? JSON.stringify(d.oldValue, null, 2) : String(d.oldValue)
          const newVal = typeof d.newValue === 'object' ? JSON.stringify(d.newValue, null, 2) : String(d.newValue)
          lineClass = 'diff-changed'
          text = `~ ${d.path}: ${oldVal} → ${newVal}`
          lines.push(`[修改] ${d.path}: ${oldVal} -> ${newVal}`)
        }

        const line = createElement('div', { className: `diff-line ${lineClass}`, textContent: text })
        resultBox.append(line)
      })

      lastDiffText = lines.join('\n')
    }

    compareBtn.addEventListener('click', () => {
      errorEl.textContent = ''
      resultBox.innerHTML = ''
      lastDiffText = ''

      const leftStr = leftInput.value.trim()
      const rightStr = rightInput.value.trim()

      if (!leftStr || !rightStr) {
        errorEl.textContent = '请输入两个 JSON 进行对比'
        return
      }

      let leftObj, rightObj
      try {
        leftObj = JSON.parse(leftStr)
      } catch (e) {
        errorEl.textContent = '原始 JSON 解析失败: ' + e.message
        return
      }

      try {
        rightObj = JSON.parse(rightStr)
      } catch (e) {
        errorEl.textContent = '修改后 JSON 解析失败: ' + e.message
        return
      }

      const diffs = diffObjects(leftObj, rightObj, '')
      renderDiff(diffs)
    })

    exampleBtn.addEventListener('click', () => {
      leftInput.value = JSON.stringify({
        name: '张三',
        age: 28,
        email: 'zhangsan@example.com',
        address: { city: '北京', district: '朝阳区' },
        hobbies: ['阅读', '游泳'],
        active: true
      }, null, 2)
      rightInput.value = JSON.stringify({
        name: '张三',
        age: 29,
        email: 'zhangsan@newdomain.com',
        phone: '13800138000',
        address: { city: '北京', district: '海淀区', street: '中关村大街' },
        hobbies: ['阅读', '跑步', '编程'],
        active: false,
        role: 'admin'
      }, null, 2)
    })
  }
}
