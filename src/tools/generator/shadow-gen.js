import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

export default {
  id: 'shadow-gen',
  name: 'CSS 阴影生成器',
  description: '可视化调整并生成 box-shadow CSS 代码',
  category: 'generator',
  icon: 'json',
  render(container) {
    function createSliderGroup(labelText, id, min, max, defaultValue) {
      const input = createElement('input', {
        className: 'input',
        type: 'number',
        id: `sg-${id}`,
        value: String(defaultValue),
        min: String(min),
        max: String(max),
        onInput: updatePreview
      })

      const slider = createElement('input', {
        className: 'input',
        type: 'range',
        id: `sg-${id}-slider`,
        'aria-label': `${labelText}滑块`,
        value: String(defaultValue),
        min: String(min),
        max: String(max),
        onInput: (e) => {
          input.value = e.target.value
          updatePreview()
        }
      })

      input.addEventListener('input', () => {
        slider.value = input.value
      })

      return createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', for: `sg-${id}` }, [labelText]),
        slider,
        input
      ])
    }

    const xGroup = createSliderGroup('X 偏移', 'x', -50, 50, 5)
    const yGroup = createSliderGroup('Y 偏移', 'y', -50, 50, 5)
    const blurGroup = createSliderGroup('模糊半径', 'blur', 0, 100, 10)
    const spreadGroup = createSliderGroup('扩展半径', 'spread', -50, 50, 0)

    const row1 = createElement('div', { className: 'form-row' }, [xGroup, yGroup])
    const row2 = createElement('div', { className: 'form-row' }, [blurGroup, spreadGroup])

    const colorGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'sg-color' }, ['阴影颜色']),
      createElement('input', {
        className: 'input',
        type: 'color',
        id: 'sg-color',
        value: '#000000',
        onInput: updatePreview
      })
    ])

    const opacityGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'sg-opacity' }, ['不透明度 (%)']),
      createElement('input', {
        className: 'input',
        type: 'number',
        id: 'sg-opacity',
        value: '50',
        min: '0',
        max: '100',
        onInput: updatePreview
      })
    ])

    const insetCheck = createElement('input', {
      className: 'checkbox',
      type: 'checkbox',
      id: 'sg-inset',
      onChange: updatePreview
    })
    const insetLabel = createElement('label', { className: 'option-item option-control-group' }, [
      insetCheck,
      createElement('span', { textContent: '内阴影 (inset)' })
    ])

    const optionsRow = createElement('div', { className: 'form-row' }, [colorGroup, opacityGroup])
    const insetRow = insetLabel

    const previewBox = createElement('div', { className: 'result-box' })
    const previewInner = createElement('div', { className: 'stat-item' }, ['阴影预览'])
    previewBox.appendChild(previewInner)

    const cssOutput = createElement('textarea', {
      className: 'textarea',
      rows: '2',
      readonly: 'readonly'
    })

    const copyBtn = createCopyButton(() => cssOutput.value)

    function hexToRgba(hex, opacity) {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      const a = opacity / 100
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }

    function updatePreview() {
      const x = parseInt(document.getElementById('sg-x').value) || 0
      const y = parseInt(document.getElementById('sg-y').value) || 0
      const blur = parseInt(document.getElementById('sg-blur').value) || 0
      const spread = parseInt(document.getElementById('sg-spread').value) || 0
      const color = document.getElementById('sg-color').value
      const opacity = parseInt(document.getElementById('sg-opacity').value) || 50
      const inset = document.getElementById('sg-inset').checked

      const rgba = hexToRgba(color, opacity)
      const insetStr = inset ? 'inset ' : ''
      const shadowValue = `${insetStr}${x}px ${y}px ${blur}px ${spread}px ${rgba}`

      previewInner.setAttribute('style', `box-shadow: ${shadowValue}`)
      cssOutput.value = `box-shadow: ${shadowValue};`
    }

    container.appendChild(row1)
    container.appendChild(row2)
    container.appendChild(optionsRow)
    container.appendChild(insetRow)
    container.appendChild(previewBox)
    container.appendChild(createSection('CSS 代码', cssOutput, [copyBtn]))

    updatePreview()
  }
}
