import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'
import jsYaml from 'js-yaml'

export default {
  id: 'json-yaml',
  name: 'JSON ↔ YAML 转换',
  description: 'JSON 和 YAML 格式相互转换',
  category: 'converter',
  icon: 'json-yaml',
  render(container) {
    // Input area
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '在此输入 JSON 或 YAML...',
      rows: 12
    })

    // Output area
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '转换结果将显示在此...',
      rows: 12,
      readOnly: true
    })

    // Error display
    const errorEl = createElement('div', {
      className: 'error-text'
    })

    // Sample data buttons
    const jsonSampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: 'JSON 示例',
      onClick: () => {
        inputTextarea.value = JSON.stringify({ name: '示例', version: 1, items: ['a', 'b', 'c'], config: { debug: true, timeout: 30 } }, null, 2)
        inputFormat = 'json'
        updateTabState()
      }
    })

    const yamlSampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: 'YAML 示例',
      onClick: () => {
        inputTextarea.value = 'name: 示例\nversion: 1\nitems:\n  - a\n  - b\n  - c\nconfig:\n  debug: true\n  timeout: 30'
        inputFormat = 'yaml'
        updateTabState()
      }
    })

    // Track current input format
    let inputFormat = 'json'

    // Tab-like indicator for detected format
    const jsonTabBtn = createElement('button', {
      className: 'tab-btn',
      textContent: 'JSON',
      onClick: () => { inputFormat = 'json'; updateTabState() }
    })
    const yamlTabBtn = createElement('button', {
      className: 'tab-btn',
      textContent: 'YAML',
      onClick: () => { inputFormat = 'yaml'; updateTabState() }
    })
    const tabGroup = createElement('div', { className: 'tab-group' }, [jsonTabBtn, yamlTabBtn])

    function updateTabState() {
      jsonTabBtn.classList.toggle('active', inputFormat === 'json')
      yamlTabBtn.classList.toggle('active', inputFormat === 'yaml')
    }
    updateTabState()

    // Auto-detect format on input
    inputTextarea.addEventListener('input', () => {
      const val = inputTextarea.value.trim()
      if (!val) return
      if (val.startsWith('{') || val.startsWith('[')) {
        inputFormat = 'json'
      } else {
        inputFormat = 'yaml'
      }
      updateTabState()
    })

    // Convert buttons
    const convertJsonToYamlBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'JSON → YAML',
      onClick: () => convert('json', 'yaml')
    })

    const convertYamlToJsonBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'YAML → JSON',
      onClick: () => convert('yaml', 'json')
    })

    const convertBothBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '智能转换 →',
      onClick: () => {
        if (inputFormat === 'json') convert('json', 'yaml')
        else convert('yaml', 'json')
      }
    })

    function convert(from, to) {
      errorEl.textContent = ''
      const input = inputTextarea.value.trim()
      if (!input) {
        errorEl.textContent = '请输入内容'
        return
      }

      try {
        let data
        if (from === 'json') {
          data = JSON.parse(input)
        } else {
          data = jsYaml.load(input)
        }

        let result
        if (to === 'json') {
          result = JSON.stringify(data, null, 2)
        } else {
          result = jsYaml.dump(data, { indent: 2, lineWidth: -1, noRefs: true })
        }

        outputTextarea.value = result
      } catch (e) {
        errorEl.textContent = `${from.toUpperCase()} 解析错误: ${e.message}`
        outputTextarea.value = ''
      }
    }

    const copyInputBtn = createCopyButton(() => inputTextarea.value)
    const copyOutputBtn = createCopyButton(() => outputTextarea.value)

    // Swap button
    const swapBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '⇄ 交换',
      onClick: () => {
        const temp = inputTextarea.value
        inputTextarea.value = outputTextarea.value
        outputTextarea.value = temp
        inputFormat = inputFormat === 'json' ? 'yaml' : 'json'
        updateTabState()
      }
    })

    const btnRow = createElement('div', { className: 'btn-group' }, [
      convertJsonToYamlBtn,
      convertYamlToJsonBtn,
      convertBothBtn,
      swapBtn
    ])

    const sampleRow = createElement('div', { className: 'btn-group' }, [jsonSampleBtn, yamlSampleBtn])

    const inputSection = createSection('输入', createElement('div', {}, [tabGroup, inputTextarea, sampleRow]), [copyInputBtn])
    const outputSection = createSection('输出', outputTextarea, [copyOutputBtn])

    container.appendChild(inputSection)
    container.appendChild(btnRow)
    container.appendChild(errorEl)
    container.appendChild(outputSection)
  }
}
