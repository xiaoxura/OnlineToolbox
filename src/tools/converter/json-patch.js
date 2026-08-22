import { createCopyButton, createElement, createSection } from '../../utils/dom.js'

function escapePointerToken(token) {
  return String(token).replaceAll('~', '~0').replaceAll('/', '~1')
}

function appendPath(path, token) {
  return `${path}/${escapePointerToken(token)}`
}

function isObject(value) {
  return value !== null && typeof value === 'object'
}

function createPatch(source, target, path = '') {
  if (source === target) return []

  if (!isObject(source) || !isObject(target) || Array.isArray(source) !== Array.isArray(target)) {
    return [{ op: 'replace', path, value: target }]
  }

  if (Array.isArray(source)) {
    const operations = []
    const sharedLength = Math.min(source.length, target.length)

    for (let index = 0; index < sharedLength; index++) {
      operations.push(...createPatch(source[index], target[index], appendPath(path, index)))
    }

    // Removing from the end keeps the remaining array indexes valid.
    for (let index = source.length - 1; index >= target.length; index--) {
      operations.push({ op: 'remove', path: appendPath(path, index) })
    }

    // Additions are emitted in ascending order so each target index exists.
    for (let index = sharedLength; index < target.length; index++) {
      operations.push({ op: 'add', path: appendPath(path, index), value: target[index] })
    }

    return operations
  }

  const operations = []
  for (const key of Object.keys(source)) {
    if (!Object.hasOwn(target, key)) {
      operations.push({ op: 'remove', path: appendPath(path, key) })
    }
  }

  for (const key of Object.keys(target)) {
    const childPath = appendPath(path, key)
    if (!Object.hasOwn(source, key)) {
      operations.push({ op: 'add', path: childPath, value: target[key] })
    } else {
      operations.push(...createPatch(source[key], target[key], childPath))
    }
  }

  return operations
}

function parseJson(value, label) {
  if (!value.trim()) throw new Error(`请输入${label} JSON`)
  try {
    return JSON.parse(value)
  } catch (error) {
    throw new Error(`${label} JSON 解析失败：${error.message}`)
  }
}

export default {
  id: 'json-patch',
  name: 'JSON Patch 生成',
  description: '对比两组 JSON，生成符合 RFC 6902 的 add、remove 和 replace 操作',
  category: 'converter',
  icon: 'json',

  render(container) {
    const sourceInput = createElement('textarea', {
      className: 'textarea',
      rows: 12,
      placeholder: '{\n  "name": "Alice",\n  "roles": ["user"]\n}'
    })
    const targetInput = createElement('textarea', {
      className: 'textarea',
      rows: 12,
      placeholder: '{\n  "name": "Bob",\n  "roles": ["user", "admin"]\n}'
    })
    const inputGrid = createElement('div', { className: 'grid-2' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '原始 JSON' }),
        sourceInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '目标 JSON' }),
        targetInput
      ])
    ])

    const generateButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '生成 JSON Patch'
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据'
    })
    const error = createElement('div', { className: 'error-text' })
    const output = createElement('textarea', {
      className: 'textarea large',
      rows: 14,
      readOnly: true,
      placeholder: '生成的 JSON Patch 将显示在这里…',
      'aria-label': 'JSON Patch 结果'
    })
    const outputSection = createSection('JSON Patch 结果', output, [
      createCopyButton(() => output.value)
    ])

    container.append(inputGrid, createElement('div', { className: 'btn-group' }, [generateButton, sampleButton]), error, outputSection)

    function generate() {
      error.textContent = ''
      output.value = ''

      try {
        const source = parseJson(sourceInput.value, '原始')
        const target = parseJson(targetInput.value, '目标')
        output.value = JSON.stringify(createPatch(source, target), null, 2)
      } catch (cause) {
        error.textContent = cause.message
      }
    }

    generateButton.addEventListener('click', generate)
    sampleButton.addEventListener('click', () => {
      sourceInput.value = JSON.stringify({
        name: 'Alice',
        age: 28,
        roles: ['user'],
        profile: { city: 'Shanghai' }
      }, null, 2)
      targetInput.value = JSON.stringify({
        name: 'Bob',
        roles: ['user', 'admin'],
        profile: { city: 'Beijing', timezone: 'Asia/Shanghai' },
        active: true
      }, null, 2)
      generate()
    })
  }
}
