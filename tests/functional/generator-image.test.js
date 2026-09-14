import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  mountTool,
  editableTextareas,
  outputValue,
  outputValues,
  setValue,
  clickText,
  clickPrimary,
  errorText,
  flush
} from '../helpers/tool-harness.js'
import { calculateTargetSize } from '../../src/tools/image/image-compress.js'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/

function attachFile(input, file) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true, writable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generator / uuid', () => {
  it('generates one hyphenated lowercase uuid v4 by default', async () => {
    const container = await mountTool('uuid')
    clickPrimary(container)
    const out = outputValue(container)
    expect(out).toMatch(UUID_V4)
    expect(out).not.toMatch(/\n/)
  })

  it('honours count, uppercase and hyphen toggles', async () => {
    const container = await mountTool('uuid')
    const countInput = container.querySelector('input[type="number"]')
    const uppercase = container.querySelector('#uuid-uppercase')
    const hyphen = container.querySelector('#uuid-hyphen')
    setValue(countInput, '3')
    uppercase.click()
    hyphen.click()
    clickPrimary(container)
    const lines = outputValue(container).split('\n')
    expect(lines).toHaveLength(3)
    lines.forEach(line => {
      expect(line).toMatch(/^[0-9A-F]{32}$/)
    })
  })
})

describe('generator / password', () => {
  it('generates a password of the requested length', async () => {
    const container = await mountTool('password')
    clickPrimary(container)
    const lines = outputValue(container).split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveLength(16)
  })

  it('reports when no character class is selected', async () => {
    const container = await mountTool('password')
    for (const id of ['#pw-upper', '#pw-lower', '#pw-digits', '#pw-symbols']) {
      const box = container.querySelector(id)
      if (box.checked) box.click()
    }
    clickPrimary(container)
    expect(outputValue(container)).toContain('请至少选择一种字符类型')
  })
})

describe('generator / random', () => {
  it('generates the requested count of integers in range', async () => {
    const container = await mountTool('random')
    clickPrimary(container)
    const lines = outputValue(container).split('\n')
    expect(lines).toHaveLength(10)
    for (const line of lines) {
      const n = Number(line)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(100)
    }
  })

  it('generates strings on the string tab', async () => {
    const container = await mountTool('random')
    clickText(container, '随机字符串')
    clickPrimary(container)
    const lines = outputValue(container).split('\n')
    expect(lines).toHaveLength(5)
    lines.forEach(line => expect(line).toHaveLength(16))
  })
})

describe('generator / lorem', () => {
  it('generates the requested number of paragraphs', async () => {
    const container = await mountTool('lorem')
    clickPrimary(container)
    const out = outputValue(container)
    expect(out.split('\n\n')).toHaveLength(3)
    expect(out).toContain('.')
  })

  it('switches to word mode', async () => {
    const container = await mountTool('lorem')
    setValue(container.querySelector('input[type="number"]'), '4')
    clickText(container, '单词')
    clickPrimary(container)
    expect(outputValue(container).split(' ')).toHaveLength(4)
  })
})

describe('generator / qrcode', () => {
  it('renders a qr code and reports the selected size', async () => {
    const container = await mountTool('qrcode')
    setValue(editableTextareas(container)[0], 'https://example.com')
    clickPrimary(container)
    await flush()
    expect(errorText(container)).toBe('')
    expect(container.querySelector('.qr-status-text').textContent).toContain('256x256')
    expect(container.querySelector('canvas').classList.contains('hidden')).toBe(false)
  })

  it('asks for input when empty', async () => {
    const container = await mountTool('qrcode')
    clickPrimary(container)
    await flush()
    expect(container.querySelector('.qr-status-text').textContent).toContain('请输入文本或链接')
  })
})

describe('generator / placeholder-img', () => {
  it('generates svg with the configured size on mount and on demand', async () => {
    const container = await mountTool('placeholder-img')
    const out = outputValue(container)
    expect(out).toContain('<svg')
    expect(out).toContain('width="300"')
    expect(out).toContain('height="200"')
    expect(out).toContain('#cccccc')

    setValue(container.querySelector('#ph-width'), '400')
    setValue(container.querySelector('#ph-height'), '120')
    setValue(container.querySelector('#ph-text'), 'Hi & <b>')
    clickPrimary(container)
    const updated = outputValue(container)
    expect(updated).toContain('width="400"')
    expect(updated).toContain('height="120"')
    expect(updated).toContain('Hi &amp; &lt;b&gt;')
  })
})

describe('generator / gradient-gen', () => {
  it('emits linear gradient css by default', async () => {
    const container = await mountTool('gradient-gen')
    expect(outputValue(container)).toBe('background: linear-gradient(90deg, #ff0000 0%, #0000ff 100%);')
  })

  it('emits radial gradient css after switching mode', async () => {
    const container = await mountTool('gradient-gen')
    clickText(container, '径向渐变')
    expect(outputValue(container)).toBe('background: radial-gradient(ellipse, #ff0000 0%, #0000ff 100%);')
  })

  it('reflects a changed angle', async () => {
    const container = await mountTool('gradient-gen')
    setValue(container.querySelector('#gg-angle'), '45')
    expect(outputValue(container)).toBe('background: linear-gradient(45deg, #ff0000 0%, #0000ff 100%);')
  })
})

describe('generator / shadow-gen', () => {
  it('emits box-shadow css by default', async () => {
    const container = await mountTool('shadow-gen')
    expect(outputValue(container)).toBe('box-shadow: 5px 5px 10px 0px rgba(0, 0, 0, 0.5);')
  })

  it('supports fully transparent shadows (opacity 0)', async () => {
    const container = await mountTool('shadow-gen')
    setValue(container.querySelector('#sg-opacity'), '0')
    expect(outputValue(container)).toBe('box-shadow: 5px 5px 10px 0px rgba(0, 0, 0, 0);')
  })

  it('supports inset and updated offsets', async () => {
    const container = await mountTool('shadow-gen')
    setValue(container.querySelector('#sg-x'), '10')
    setValue(container.querySelector('#sg-y'), '-2')
    container.querySelector('#sg-inset').click()
    expect(outputValue(container)).toBe('box-shadow: inset 10px -2px 10px 0px rgba(0, 0, 0, 0.5);')
  })
})

describe('generator / palette-gen', () => {
  it('emits five monochromatic css variables by default', async () => {
    const container = await mountTool('palette-gen')
    const out = outputValue(container)
    const lines = out.split('\n')
    expect(lines).toHaveLength(5)
    lines.forEach(line => expect(line).toMatch(/^--color-\d+: #[0-9a-f]{6};$/))
  })

  it('computes the complement of red exactly', async () => {
    const container = await mountTool('palette-gen')
    setValue(container.querySelector('#pg-base-color'), '#ff0000')
    setValue(container.querySelector('#pg-mode'), 'complement')
    expect(outputValue(container)).toBe('--color-1: #ff0000;\n--color-2: #00ffff;')
  })

  it('switches to scss variable syntax', async () => {
    const container = await mountTool('palette-gen')
    setValue(container.querySelector('#pg-export'), 'scss')
    expect(outputValue(container)).toMatch(/^\$color-1: #[0-9a-f]{6};/)
  })
})

describe('generator / ulid', () => {
  it('generates the requested number of monotonic ulids', async () => {
    const container = await mountTool('ulid')
    clickPrimary(container)
    const lines = outputValue(container).split('\n')
    expect(lines).toHaveLength(5)
    lines.forEach(line => expect(line).toMatch(ULID))
    const sorted = [...lines].sort()
    expect(sorted).toEqual(lines)
  })
})

describe('image / image-compress', () => {
  function stubCanvas() {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })))
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      writable: true,
      value: vi.fn((cb, type) => cb(new Blob(['x'.repeat(100)], { type })))
    })
  }

  it('computes target sizes while preserving aspect ratio', () => {
    expect(calculateTargetSize(800, 600, 400, 400)).toEqual({ width: 400, height: 300 })
    expect(calculateTargetSize(800, 600, 0, 0)).toEqual({ width: 800, height: 600 })
    expect(calculateTargetSize(100, 100, 200, 200)).toEqual({ width: 100, height: 100 })
  })

  it('processes a file and reports the resized dimensions', async () => {
    stubCanvas()
    const container = await mountTool('image-compress')
    const fileInput = container.querySelector('input[type="file"]')
    const [maxWidth, maxHeight] = container.querySelectorAll('input[type="number"]')
    setValue(maxWidth, '400')
    setValue(maxHeight, '400')
    attachFile(fileInput, new File(['x'.repeat(500)], 'big.png', { type: 'image/png' }))
    clickPrimary(container)
    await flush(50)
    const status = container.querySelector('.loading-text').textContent
    expect(status).toContain('800×600')
    expect(status).toContain('400×300')
    expect(container.querySelector('button.btn-success').disabled).toBe(false)
  })

  it('asks for a file when none is selected', async () => {
    const container = await mountTool('image-compress')
    clickPrimary(container)
    await flush()
    expect(container.querySelector('.loading-text').textContent).toContain('请先选择图片')
  })
})

describe('image / img-to-base64', () => {
  it('converts a file into data uri, raw base64 and css', async () => {
    const container = await mountTool('img-to-base64')
    const fileInput = container.querySelector('input[type="file"]')
    attachFile(fileInput, new File(['hello world'], 'x.png', { type: 'image/png' }))
    await flush(80)
    const [full, raw, css] = outputValues(container)
    expect(full).toMatch(/^data:image\/png;base64,/)
    expect(raw).toBe(full.split(',')[1])
    expect(raw).toBe('aGVsbG8gd29ybGQ=')
    expect(css).toBe(`background-image: url("${full}");`)
  })

  it('ignores non-image files', async () => {
    const container = await mountTool('img-to-base64')
    const fileInput = container.querySelector('input[type="file"]')
    attachFile(fileInput, new File(['hi'], 'x.txt', { type: 'text/plain' }))
    await flush(80)
    expect(outputValues(container).every(v => v === '')).toBe(true)
  })
})

describe('image / svg-compress', () => {
  const svg = `<?xml version="1.0"?>
<!-- a comment -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="100" height="100" class="icon" id="main">
  <metadata>meta</metadata>
  <g>
  </g>
  <rect x="0" y="0" width="100" height="100" fill="red"/>
</svg>`

  it('strips comments, metadata, namespaces, ids and whitespace', async () => {
    const container = await mountTool('svg-compress')
    setValue(editableTextareas(container)[0], svg)
    clickPrimary(container)
    expect(outputValue(container)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="0" y="0" width="100" height="100" fill="red"/></svg>'
    )
    expect(container.querySelector('.inline-result').textContent).toContain('压缩率')
  })
})

describe('image / svg-compress references', () => {
  it('does not break url(#id) references when removing ids', async () => {
    const container = await mountTool('svg-compress')
    const withRef = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g1"><stop offset="0" stop-color="red"/></linearGradient></defs><rect fill="url(#g1)" width="10" height="10"/></svg>'
    setValue(editableTextareas(container)[0], withRef)
    clickPrimary(container)
    const out = outputValue(container)
    expect(out).toContain('url(#g1)')
    expect(out).toContain('id="g1"')
  })
})

describe('generator / extra behaviour probes', () => {
  it('random: decimal mode produces fractional values', async () => {
    const container = await mountTool('random')
    const [min, max] = container.querySelectorAll('input[type="number"]')
    setValue(min, '0')
    setValue(max, '1')
    container.querySelector('#random-dec').click()
    clickPrimary(container)
    const values = outputValue(container).split('\n').map(Number)
    expect(values.some(v => !Number.isInteger(v))).toBe(true)
  })

  it('random: reports invalid min/max', async () => {
    const container = await mountTool('random')
    const [min, max] = container.querySelectorAll('input[type="number"]')
    setValue(min, '10')
    setValue(max, '1')
    clickPrimary(container)
    expect(outputValue(container)).toContain('最小值不能大于最大值')
  })

  it('password: honours a custom length and count', async () => {
    const container = await mountTool('password')
    const [length, count] = container.querySelectorAll('input[type="number"]')
    setValue(length, '32')
    setValue(count, '2')
    clickPrimary(container)
    const lines = outputValue(container).split('\n')
    expect(lines).toHaveLength(2)
    lines.forEach(l => expect(l).toHaveLength(32))
  })

  it('gradient: adding a stop includes it and sorted order', async () => {
    const container = await mountTool('gradient-gen')
    clickText(container, '+ 添加色标')
    expect(outputValue(container)).toBe('background: linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%);')
  })

  it('qrcode: honours the selected size', async () => {
    const container = await mountTool('qrcode')
    setValue(editableTextareas(container)[0], 'hello')
    setValue(container.querySelector('select'), '512')
    clickPrimary(container)
    await flush()
    expect(container.querySelector('.qr-status-text').textContent).toContain('512x512')
  })

  it('placeholder-img: falls back to the size text when custom text is empty', async () => {
    const container = await mountTool('placeholder-img')
    expect(outputValue(container)).toContain('>300x200</text>')
  })

  it('palette-gen: analogous of red is the expected triad', async () => {
    const container = await mountTool('palette-gen')
    setValue(container.querySelector('#pg-base-color'), '#ff0000')
    setValue(container.querySelector('#pg-mode'), 'analogous')
    expect(outputValue(container)).toBe('--color-1: #ff0080;\n--color-2: #ff0000;\n--color-3: #ff8000;')
  })

  it('shadow-gen: full opacity yields rgba alpha 1', async () => {
    const container = await mountTool('shadow-gen')
    setValue(container.querySelector('#sg-opacity'), '100')
    expect(outputValue(container)).toContain('rgba(0, 0, 0, 1)')
  })
})
