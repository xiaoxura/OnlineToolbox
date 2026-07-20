import { createElement, createSection } from '../../utils/dom.js'

function parseVersion(value) {
  const match = value.trim().replace(/^v/i, '').match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/)
  if (!match) throw new Error(`无效的 SemVer：${value || '(空)'}`)
  return { major: match[1], minor: match[2], patch: match[3], pre: match[4]?.split('.') || [] }
}

function compareNumeric(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1
  if (a === b) return 0
  return a < b ? -1 : 1
}

function comparePre(a, b) {
  if (!a.length && !b.length) return 0
  if (!a.length) return 1
  if (!b.length) return -1
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (a[index] === undefined) return -1
    if (b[index] === undefined) return 1
    if (a[index] === b[index]) continue
    const aNum = /^\d+$/.test(a[index])
    const bNum = /^\d+$/.test(b[index])
    if (aNum && bNum) return compareNumeric(a[index], b[index])
    if (aNum !== bNum) return aNum ? -1 : 1
    return a[index] < b[index] ? -1 : 1
  }
  return 0
}

function compare(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    const order = compareNumeric(a[key], b[key])
    if (order) return order
  }
  return comparePre(a.pre, b.pre)
}

function versionText(version) {
  return `${version.major}.${version.minor}.${version.patch}${version.pre.length ? `-${version.pre.join('.')}` : ''}`
}

export default {
  id: 'semver',
  name: 'SemVer 版本比较',
  description: '校验、比较和升级语义化版本号',
  category: 'devtool',
  icon: 'json',
  render(container) {
    const first = createElement('input', { className: 'input', type: 'text', value: '1.4.0', placeholder: '1.4.0' })
    const second = createElement('input', { className: 'input', type: 'text', value: '2.0.0-beta.1', placeholder: '2.0.0' })
    const operation = createElement('select', { className: 'select', 'aria-label': '版本操作' }, [
      createElement('option', { value: 'compare', textContent: '比较两个版本' }),
      createElement('option', { value: 'major', textContent: '升级 major' }),
      createElement('option', { value: 'minor', textContent: '升级 minor' }),
      createElement('option', { value: 'patch', textContent: '升级 patch' })
    ])
    const result = createElement('div', { className: 'result-box', role: 'status', 'aria-live': 'polite' })
    const run = () => {
      try {
        const a = parseVersion(first.value)
        if (operation.value !== 'compare') {
          if (operation.value === 'major') { a.major = (BigInt(a.major) + 1n).toString(); a.minor = '0'; a.patch = '0' }
          if (operation.value === 'minor') { a.minor = (BigInt(a.minor) + 1n).toString(); a.patch = '0' }
          if (operation.value === 'patch') a.patch = (BigInt(a.patch) + 1n).toString()
          a.pre = []
          result.textContent = `升级结果：${versionText(a)}`
          return
        }
        const b = parseVersion(second.value)
        const order = compare(a, b)
        result.textContent = order === 0 ? '两个版本相同' : `${versionText(a)} ${order > 0 ? '高于' : '低于'} ${versionText(b)}`
      } catch (error) {
        result.textContent = error.message
      }
    }
    ;[first, second].forEach(input => input.addEventListener('input', run))
    operation.addEventListener('change', run)
    const inputs = createElement('div', { className: 'grid-2' }, [
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '版本 A' }), first]),
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '版本 B' }), second])
    ])
    container.append(inputs, createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [createElement('label', { className: 'label', textContent: '操作' }), operation]),
      createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '执行', onClick: run })
    ]), createSection('结果', result))
    run()
  }
}
