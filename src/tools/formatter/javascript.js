import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

const PARSERS = [
  { value: 'babel', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' }
]

const SAMPLE_JAVASCRIPT = `const user={name:'Ada',roles:['admin','developer']};
function greet(user){return \`Hello, \${user.name}!\`}
console.log(greet(user))`

const SAMPLE_TYPESCRIPT = `interface User {
  name: string
  roles: string[]
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`
}

const user: User = { name: 'Ada', roles: ['admin', 'developer'] }
console.log(greet(user))`

// The prettier modules are several hundred kilobytes. Keep them behind
// dynamic imports that only run when the user presses a button.
const prettierLoaders = new Map()

function loadPrettier(parser) {
  if (!prettierLoaders.has(parser)) {
    const parserPlugin = parser === 'typescript' ? import('prettier/plugins/typescript') : import('prettier/plugins/babel')
    const loader = Promise.all([import('prettier/standalone'), parserPlugin, import('prettier/plugins/estree')]).catch(cause => {
      prettierLoaders.delete(parser)
      throw cause
    })
    prettierLoaders.set(parser, loader)
  }
  return prettierLoaders.get(parser)
}

function normalizeParser(parser) {
  const value = parser || 'babel'
  if (!PARSERS.some(item => item.value === value)) {
    throw new Error(`不支持的解析器：${value}`)
  }
  return value
}

function normalizePrintWidth(value) {
  if (value === undefined || value === null || value === '') return 80
  const width = Number(value)
  if (!Number.isInteger(width) || width < 20 || width > 200) {
    throw new Error('每行宽度需要是 20-200 之间的整数')
  }
  return width
}

// Format JavaScript or TypeScript through Prettier's standalone build. The
// parser plugins are chosen at call time so a JavaScript run never downloads
// the TypeScript plugin (and vice versa).
export async function formatJavaScript(code, options = {}) {
  const source = String(code ?? '')
  if (!source.trim()) throw new Error('请输入 JavaScript 代码')

  const parser = normalizeParser(options.parser)
  const [prettier, parserPlugins, estreePlugin] = await loadPrettier(parser)

  try {
    return await prettier.format(source, {
      parser,
      plugins: [parserPlugins, estreePlugin],
      semi: options.semi ?? true,
      singleQuote: options.singleQuote ?? false,
      printWidth: normalizePrintWidth(options.printWidth)
    })
  } catch (cause) {
    throw new Error(`格式化失败：${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

const STRONG_TYPESCRIPT_SYNTAX = [
  /\binterface\s+[A-Za-z_$][\w$]*/,
  /\btype\s+[A-Za-z_$][\w$]*\s*=/,
  /\benum\s+[A-Za-z_$][\w$]*/,
  /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$[{]/,
  /\)\s*:\s*[A-Za-z_$][\w$<>[\]|., ]*\s*(?:=>|\{)/,
  /\bas\s+const\b/,
  /\bimplements\s+[A-Za-z_$]/,
  /^\s*@[A-Za-z_$][\w$]*\s*\(/m
]

// These patterns are ambiguous with valid JavaScript (destructured parameters,
// `import * as ns`), so they are only used to improve the message after terser
// has already rejected the input.
const TYPESCRIPT_HINTS = [
  ...STRONG_TYPESCRIPT_SYNTAX,
  /\b(?:function|class)\s+[A-Za-z_$][\w$]*[^{]*\([^)]*:\s*[A-Za-z_$[{]/,
  /\bas\s+(?:const|[A-Z][A-Za-z0-9_$]*)/
]

// Terser's parser rejects TypeScript with a generic parse error. Detect the
// common type-only constructs first so the message says what actually went
// wrong instead of "Missing initializer in const declaration".
function looksLikeTypeScript(code) {
  return STRONG_TYPESCRIPT_SYNTAX.some(pattern => pattern.test(code))
}

function hasTypeScriptHints(code) {
  return TYPESCRIPT_HINTS.some(pattern => pattern.test(code))
}

export async function minifyJavaScript(code) {
  const source = String(code ?? '')
  if (!source.trim()) return { code: '', error: '请输入要压缩的 JavaScript 代码' }

  const typescriptError = 'terser 不支持 TypeScript 语法：请先移除类型标注，或改用“格式化”中的 TypeScript 解析器。'
  if (looksLikeTypeScript(source)) return { code: '', error: typescriptError }

  try {
    const { minify } = await import('terser')
    const result = await minify(source, {
      compress: true,
      mangle: true,
      format: { comments: false }
    })
    if (!result.code) return { code: '', error: '压缩结果为空，请检查输入的代码。' }
    return { code: result.code, error: null }
  } catch (cause) {
    if (hasTypeScriptHints(source)) return { code: '', error: typescriptError }
    return { code: '', error: `压缩失败：${cause instanceof Error ? cause.message : String(cause)}` }
  }
}

export default {
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      rows: 12,
      placeholder: '粘贴 JavaScript 或 TypeScript 代码…',
      'aria-label': 'JavaScript 或 TypeScript 输入'
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      rows: 14,
      readOnly: true,
      placeholder: '格式化或压缩后的代码将显示在这里…',
      'aria-label': '格式化或压缩结果'
    })
    const errorEl = createElement('div', { className: 'error-text' })
    const status = createElement('div', {
      className: 'form-hint',
      role: 'status',
      'aria-live': 'polite'
    })

    const parserGroup = createSegmentedGroup(PARSERS, () => clearResult(), { label: '解析器' })

    const semiCheckbox = createElement('input', { type: 'checkbox', checked: true })
    const singleQuoteCheckbox = createElement('input', { type: 'checkbox' })
    const printWidthInput = createElement('input', {
      className: 'input',
      type: 'number',
      min: '20',
      max: '200',
      value: '80',
      'aria-label': '每行宽度'
    })

    const optionsRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'checkbox-label' }, [semiCheckbox, createElement('span', { textContent: '语句结尾分号' })])
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'checkbox-label' }, [singleQuoteCheckbox, createElement('span', { textContent: '使用单引号' })])
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '每行宽度' }),
        printWidthInput
      ])
    ])

    let runId = 0

    function currentParser() {
      return parserGroup.getValue()
    }

    function clearResult() {
      runId += 1
      errorEl.textContent = ''
      status.textContent = ''
      output.value = ''
    }

    async function onFormat() {
      const id = ++runId
      errorEl.textContent = ''
      output.value = ''
      status.textContent = '正在加载格式化器…'
      try {
        const formatted = await formatJavaScript(input.value, {
          parser: currentParser(),
          semi: semiCheckbox.checked,
          singleQuote: singleQuoteCheckbox.checked,
          printWidth: printWidthInput.value
        })
        if (id !== runId) return
        output.value = formatted
        status.textContent = '格式化完成'
      } catch (cause) {
        if (id !== runId) return
        status.textContent = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    async function onMinify() {
      const id = ++runId
      errorEl.textContent = ''
      output.value = ''
      if (currentParser() === 'typescript') {
        status.textContent = ''
        errorEl.textContent = 'terser 不支持 TypeScript 压缩：请切换到 JavaScript 解析器，或先移除类型标注。'
        return
      }
      status.textContent = '正在压缩…'
      const result = await minifyJavaScript(input.value)
      if (id !== runId) return
      if (result.error) {
        status.textContent = ''
        errorEl.textContent = result.error
        return
      }
      output.value = result.code
      status.textContent = '压缩完成'
    }

    const formatButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '格式化',
      onClick: onFormat
    })
    const minifyButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '压缩',
      onClick: onMinify
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = currentParser() === 'typescript' ? SAMPLE_TYPESCRIPT : SAMPLE_JAVASCRIPT
        clearResult()
      }
    })

    input.addEventListener('input', clearResult)

    const copyButton = createCopyButton(() => output.value)

    container.append(
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '解析器' }),
        parserGroup
      ]),
      optionsRow,
      createElement('div', { className: 'btn-group form-action-row' }, [formatButton, minifyButton, sampleButton]),
      status,
      errorEl,
      createSection('输入代码', input),
      createSection('输出结果', output, [copyButton])
    )
  }
}
