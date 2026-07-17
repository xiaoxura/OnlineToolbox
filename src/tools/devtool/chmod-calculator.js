import { createElement, createCopyButton, createSection } from '../../utils/dom.js'

const groups = [['user', '所有者'], ['group', '所属组'], ['other', '其他用户']]
const permissions = [['read', '读', 4, 'r'], ['write', '写', 2, 'w'], ['execute', '执行', 1, 'x']]

export function permissionFromMode(mode) {
  if (!/^[0-7]{3}$/.test(mode)) throw new Error('权限值应为三位八进制数，例如 755')
  return [...mode].map(Number)
}

export default {
  id: 'chmod-calculator', name: 'chmod 权限计算器', description: '可视化计算 Linux 文件权限和 chmod 命令', category: 'devtool', icon: 'linux-ref',
  render(container) {
    const modeInput = createElement('input', { className: 'input', value: '755', inputMode: 'numeric', maxlength: '3', placeholder: '755' })
    const command = createElement('input', { className: 'input', readOnly: true, 'aria-label': 'chmod 命令' })
    const symbolic = createElement('div', { className: 'inline-result' })
    const checks = []
    const grid = createElement('div', { className: 'permission-grid' })
    for (const [groupId, groupLabel] of groups) {
      const fieldset = createElement('fieldset', { className: 'tool-section' }, [createElement('legend', { className: 'label', textContent: groupLabel })])
      permissions.forEach(([id, label, value]) => {
        const checkbox = createElement('input', { className: 'checkbox', type: 'checkbox', 'data-value': String(value), id: `${groupId}-${id}` })
        checks.push(checkbox)
        fieldset.appendChild(createElement('label', { className: 'option-item', for: checkbox.id }, [checkbox, createElement('span', { textContent: label })]))
      })
      grid.appendChild(fieldset)
    }
    const updateOutput = () => {
      const digits = groups.map((_, groupIndex) => checks.slice(groupIndex * 3, groupIndex * 3 + 3).reduce((sum, box) => sum + (box.checked ? Number(box.dataset.value) : 0), 0))
      const mode = digits.join(''); modeInput.value = mode; command.value = `chmod ${mode} <文件>`
      symbolic.textContent = digits.map(digit => permissions.map(([, , value, char]) => digit & value ? char : '-').join('')).join('')
    }
    const updateChecks = () => {
      try { permissionFromMode(modeInput.value).forEach((digit, groupIndex) => permissions.forEach(([, , value], permissionIndex) => { checks[groupIndex * 3 + permissionIndex].checked = Boolean(digit & value) })); updateOutput() } catch { /* Wait for valid input. */ }
    }
    checks.forEach(box => box.addEventListener('change', updateOutput)); modeInput.addEventListener('input', updateChecks)
    container.append(createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '八进制权限' }), modeInput]), grid, createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '符号权限' }), symbolic]), createSection('chmod 命令', command, [createCopyButton(() => command.value)]))
    updateChecks()
  }
}
