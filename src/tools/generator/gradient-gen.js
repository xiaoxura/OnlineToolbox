import { createElement, createSection, createTabGroup, createCopyButton } from '../../utils/dom.js'

export default {
  id: 'gradient-gen',
  name: 'CSS 渐变生成器',
  description: '生成线性渐变和径向渐变的 CSS 代码',
  category: 'generator',
  icon: 'color',
  render(container) {
    let currentMode = 'linear'
    let colorStops = [
      { color: '#ff0000', position: 0 },
      { color: '#0000ff', position: 100 }
    ]

    const angleGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'gg-angle' }, ['角度 (0-360)']),
      createElement('input', {
        className: 'input',
        type: 'number',
        id: 'gg-angle',
        value: '90',
        min: '0',
        max: '360'
      })
    ])

    const shapeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', for: 'gg-shape' }, ['形状']),
      createElement('select', { className: 'select', id: 'gg-shape' }, [
        createElement('option', { value: 'circle' }, ['圆形 (circle)']),
        createElement('option', { value: 'ellipse', selected: 'true' }, ['椭圆 (ellipse)'])
      ])
    ])

    const linearOptions = createElement('div', { className: 'form-group' }, [angleGroup])
    const radialOptions = createElement('div', { className: 'form-group' }, [shapeGroup])
    radialOptions.setAttribute('hidden', 'true')

    const stopsContainer = createElement('div', { className: 'form-group' })

    const addStopBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: '+ 添加色标',
      onClick: () => {
        colorStops.push({ color: '#00ff00', position: 50 })
        renderStops()
        updatePreview()
      }
    })

    const previewArea = createElement('div', { className: 'result-box' })

    const cssOutput = createElement('textarea', {
      className: 'textarea',
      rows: '3',
      readonly: 'readonly'
    })

    const copyBtn = createCopyButton(() => cssOutput.value)

    function renderStops() {
      stopsContainer.innerHTML = ''
      colorStops.forEach((stop, index) => {
        const colorInput = createElement('input', {
          className: 'input',
          type: 'color',
          value: stop.color,
          onChange: (e) => {
            colorStops[index].color = e.target.value
            updatePreview()
          }
        })

        const posInput = createElement('input', {
          className: 'input',
          type: 'number',
          value: String(stop.position),
          min: '0',
          max: '100',
          onChange: (e) => {
            colorStops[index].position = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
            updatePreview()
          }
        })

        const removeBtn = createElement('button', {
          className: 'btn btn-secondary',
          textContent: '删除',
          onClick: () => {
            if (colorStops.length > 2) {
              colorStops.splice(index, 1)
              renderStops()
              updatePreview()
            }
          }
        })

        const stopRow = createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label' }, ['颜色']),
            colorInput
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label' }, ['位置 (%)']),
            posInput
          ]),
          createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'label' }, [' ']),
            removeBtn
          ])
        ])

        stopsContainer.appendChild(stopRow)
      })
    }

    function buildGradientCSS() {
      const sortedStops = [...colorStops].sort((a, b) => a.position - b.position)
      const stopsStr = sortedStops.map(s => `${s.color} ${s.position}%`).join(', ')

      if (currentMode === 'linear') {
        const angle = parseInt(document.getElementById('gg-angle').value) || 90
        return `background: linear-gradient(${angle}deg, ${stopsStr});`
      } else {
        const shape = document.getElementById('gg-shape').value
        return `background: radial-gradient(${shape}, ${stopsStr});`
      }
    }

    function updatePreview() {
      const css = buildGradientCSS()
      previewArea.setAttribute('style', css)
      cssOutput.value = css
    }

    const tabGroup = createTabGroup([
      { label: '线性渐变', value: 'linear' },
      { label: '径向渐变', value: 'radial' }
    ], (value) => {
      currentMode = value
      if (value === 'linear') {
        linearOptions.removeAttribute('hidden')
        radialOptions.setAttribute('hidden', 'true')
      } else {
        linearOptions.setAttribute('hidden', 'true')
        radialOptions.removeAttribute('hidden')
      }
      updatePreview()
    })

    const angleRow = createElement('div', { className: 'form-row' }, [linearOptions, radialOptions])

    container.appendChild(tabGroup)
    container.appendChild(angleRow)
    container.appendChild(stopsContainer)
    container.appendChild(addStopBtn)
    container.appendChild(previewArea)
    container.appendChild(createSection('CSS 代码', cssOutput, [copyBtn]))

    renderStops()
    updatePreview()
  }
}
