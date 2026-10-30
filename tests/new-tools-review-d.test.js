import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setValue, clickText, findButton, errorText, flush } from './helpers/tool-harness.js'
import { enhanceFormAccessibility } from '../src/utils/dom.js'

import imageEditor, { rotateDimensions, clampCropRect, buildWatermarkLayout } from '../src/tools/image/image-editor.js'
import imagePalette, { extractPalette, rgbToHex, relativeLuminance } from '../src/tools/image/image-palette.js'
import svgConverter, { svgToDataUrl, svgToJsx, normalizeSvgSize } from '../src/tools/image/svg-converter.js'
import cubicBezierTool, { cubicBezier, bezierPath, sampleBezier } from '../src/tools/generator/cubic-bezier.js'
import clampGenerator, { buildClamp } from '../src/tools/generator/clamp-generator.js'

function mount(tool) {
  const container = document.createElement('main')
  document.body.replaceChildren(container)
  tool.render(container)
  return container
}

function attachFile(input, file) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true, writable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(() => {
  document.body.replaceChildren()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// 1. 图片编辑器
// ---------------------------------------------------------------------------

describe('image-editor', () => {
  it('rotates dimensions for the four supported right angles', () => {
    expect(rotateDimensions(800, 600, 0)).toEqual({ width: 800, height: 600 })
    expect(rotateDimensions(800, 600, 90)).toEqual({ width: 600, height: 800 })
    expect(rotateDimensions(800, 600, 180)).toEqual({ width: 800, height: 600 })
    expect(rotateDimensions(800, 600, 270)).toEqual({ width: 600, height: 800 })
    expect(rotateDimensions(800, 600, -90)).toEqual({ width: 600, height: 800 })
    expect(rotateDimensions(800, 600, 450)).toEqual({ width: 600, height: 800 })
  })

  it('clamps crop rectangles inside the canvas and falls back to full size', () => {
    expect(clampCropRect({ x: -10, y: -5, width: 1000, height: 1000 }, 200, 100)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100
    })
    expect(clampCropRect({ x: 150, y: 80, width: 100, height: 80 }, 200, 100)).toEqual({
      x: 150,
      y: 80,
      width: 50,
      height: 20
    })
    expect(clampCropRect({ x: 0, y: 0, width: 0, height: 0 }, 200, 100)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100
    })
    expect(clampCropRect({ x: 999, y: 999 }, 200, 100)).toEqual({ x: 199, y: 99, width: 1, height: 1 })
  })

  it('builds watermark layouts for corners, edges and centre', () => {
    expect(buildWatermarkLayout({ canvasWidth: 800, canvasHeight: 600, position: 'bottom-right', text: '©' })).toEqual({
      x: 782,
      y: 582,
      align: 'right',
      baseline: 'bottom',
      margin: 18,
      text: '©'
    })
    expect(buildWatermarkLayout({ canvasWidth: 400, canvasHeight: 300, position: 'top-left', text: 'A' })).toEqual({
      x: 12,
      y: 12,
      align: 'left',
      baseline: 'top',
      margin: 12,
      text: 'A'
    })
    expect(buildWatermarkLayout({ canvasWidth: 400, canvasHeight: 300, position: 'center', text: 'B' })).toEqual({
      x: 200,
      y: 150,
      align: 'center',
      baseline: 'middle',
      margin: 12,
      text: 'B'
    })
    expect(buildWatermarkLayout({ canvasWidth: 400, canvasHeight: 300, position: 'bottom-center', text: '' })).toMatchObject({
      x: 200,
      align: 'center',
      baseline: 'bottom'
    })
  })

  it('renders its controls synchronously without decoding an image', () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    const container = mount(imageEditor)

    expect(decode).not.toHaveBeenCalled()
    expect(container.querySelector('.privacy-notice').textContent).toContain('🔒')
    expect(container.querySelector('#ie-file')).not.toBeNull()
    expect(container.querySelector('canvas')).not.toBeNull()
    expect(container.querySelectorAll('#ie-format option')).toHaveLength(3)
    expect(container.querySelectorAll('[role="radio"]')).toHaveLength(4)
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
    expect(container.querySelector('.segmented-group')).not.toBeNull()

    clickText(container, '应用处理')
    expect(errorText(container)).toContain('请先选择图片')
  })

  it('reports a Chinese error when image decoding is unavailable', async () => {
    const container = mount(imageEditor)
    attachFile(container.querySelector('#ie-file'), new File(['x'], 'photo.png', { type: 'image/png' }))
    await flush()
    expect(errorText(container)).toContain('当前浏览器不支持图片解码')
  })

  it('processes a decoded image with rotation, flip, crop and watermark', async () => {
    const bitmap = { width: 400, height: 300, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const toBlob = vi.fn((callback, mime) => callback(new Blob(['image'], { type: mime })))
    const hadToBlob = 'toBlob' in HTMLCanvasElement.prototype
    const originalToBlob = HTMLCanvasElement.prototype.toBlob
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', { configurable: true, value: toBlob })

    try {
      const container = mount(imageEditor)
      attachFile(container.querySelector('#ie-file'), new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))
      await vi.waitFor(() => expect(container.querySelector('#ie-crop-width').value).toBe('400'))
      expect(container.querySelector('.loading-text').textContent).toContain('已加载 400 × 300px')

      container.querySelector('[data-value="90"]').click()
      expect(container.querySelector('.form-hint').textContent).toContain('旋转后画布 300 × 400px')
      setValue(container.querySelector('#ie-crop-x'), '0')
      setValue(container.querySelector('#ie-crop-y'), '0')
      setValue(container.querySelector('#ie-crop-width'), '300')
      setValue(container.querySelector('#ie-crop-height'), '400')
      setValue(container.querySelector('#ie-watermark-text'), '本地水印')
      container.querySelector('#ie-flip-horizontal').click()

      clickText(container, '应用处理')
      await vi.waitFor(() => expect(container.querySelector('.btn-success').disabled).toBe(false))
      expect(toBlob).toHaveBeenCalled()
      expect(container.querySelector('.loading-text').textContent).toContain('处理完成：输出 300 × 400px')
    } finally {
      if (hadToBlob) Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', { configurable: true, value: originalToBlob })
      else delete HTMLCanvasElement.prototype.toBlob
    }
  })
})

// ---------------------------------------------------------------------------
// 2. 图片主色调
// ---------------------------------------------------------------------------

describe('image-palette', () => {
  it('converts RGB values to lower-case hex and clamps out-of-range channels', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
    expect(rgbToHex(0, 128, 255)).toBe('#0080ff')
    expect(rgbToHex(300, -10, 12.6)).toBe('#ff000d')
    expect(rgbToHex(1, 2, 3)).toBe('#010203')
  })

  it('computes WCAG relative luminance', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBe(1)
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2158605, 6)
    expect(() => relativeLuminance('not-a-colour')).toThrow('十六进制颜色')
  })

  it('extracts dominant colours and ratios from a tiny pixel buffer', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255
    ])
    const palette = extractPalette({ data, width: 4, height: 2 }, 3)
    expect(palette.map(color => color.hex)).toEqual(['#ff0000', '#0000ff', '#00ff00'])
    expect(palette.map(color => color.ratio)).toEqual([0.5, 0.25, 0.25])
    expect(palette[0]).toMatchObject({ r: 255, g: 0, b: 0 })
    expect(palette.reduce((sum, color) => sum + color.ratio, 0)).toBeCloseTo(1, 10)
  })

  it('ignores transparent pixels and caps the number of colours', () => {
    const transparentRed = [255, 0, 0, 0]
    const opaqueBlue = [0, 0, 255, 255]
    const palette = extractPalette(new Uint8ClampedArray([...transparentRed, ...opaqueBlue]), 6)
    expect(palette).toHaveLength(1)
    expect(palette[0].hex).toBe('#0000ff')
    expect(palette[0].ratio).toBe(1)
    expect(extractPalette(new Uint8ClampedArray([0, 0, 0, 0]), 6)).toEqual([])
  })

  it('renders the count selector and reports a missing file', () => {
    const container = mount(imagePalette)
    expect(container.querySelectorAll('#ip-count option')).toHaveLength(3)
    expect(container.querySelector('a[href="#/palette-gen"]')).not.toBeNull()
    expect(container.querySelector('.privacy-notice').textContent).toContain('🔒')

    clickText(container, '提取主色调')
    expect(errorText(container)).toContain('请先选择图片文件')
  })

  it('renders swatches with adaptive text and copies the hex on click', async () => {
    const decode = vi.fn().mockResolvedValue({ width: 2, height: 2, close: vi.fn() })
    vi.stubGlobal('createImageBitmap', decode)
    const context = {
      drawImage: vi.fn(),
      getImageData: () => ({
        data: new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
      })
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const container = mount(imagePalette)
    attachFile(container.querySelector('#ip-file'), new File(['x'], 'colors.png', { type: 'image/png' }))
    clickText(container, '提取主色调')
    await vi.waitFor(() => expect(container.querySelectorAll('.palette-card')).toHaveLength(3))

    const cards = [...container.querySelectorAll('.palette-card')]
    const redCard = cards.find(card => card.textContent.includes('#ff0000'))
    const blueCard = cards.find(card => card.textContent.includes('#0000ff'))
    const whiteCard = cards.find(card => card.textContent.includes('#ffffff'))
    expect(redCard.style.color).toBe('rgb(17, 24, 39)')
    expect(blueCard.style.color).toBe('rgb(255, 255, 255)')
    expect(whiteCard.style.color).toBe('rgb(17, 24, 39)')

    navigator.clipboard.writeText.mockClear()
    cards[0].click()
    await flush()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('#ff0000')
  })
})

// ---------------------------------------------------------------------------
// 3. SVG 转换器
// ---------------------------------------------------------------------------

describe('svg-converter', () => {
  it('builds UTF-8 percent-encoded data URLs, including Chinese text', () => {
    const url = svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg"><text>你好</text></svg>')
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(url).toContain('%E4%BD%A0%E5%A5%BD')
    expect(url).not.toContain('你好')
    expect(svgToDataUrl('<svg/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')
    expect(svgToDataUrl('<svg/>', 'image/svg+xml;charset=utf-8')).toBe('data:image/svg+xml;charset=utf-8;charset=utf-8,%3Csvg%2F%3E')
  })

  it('converts attributes, styles and namespaces to JSX and strips active content', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" class="icon">' +
      '<script>alert(1)</script>' +
      '<rect x="0" y="0" width="10" height="10" stroke-width="2" style="fill:red; stroke-width: 3" onclick="alert(1)" />' +
      '<use xlink:href="#shape" class="ref" />' +
      '<text>你好</text>' +
      '</svg>'
    const jsx = svgToJsx(svg)

    expect(jsx).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" className="icon">'
    )
    expect(jsx).toContain('strokeWidth="2"')
    expect(jsx).toContain("style={{ fill: 'red', strokeWidth: '3' }}")
    expect(jsx).toContain('xlinkHref="#shape"')
    expect(jsx).toContain('className="ref"')
    expect(jsx).toContain('/>')
    expect(jsx).toContain('你好')
    expect(jsx).not.toContain('<script')
    expect(jsx).not.toContain('onclick')
    expect(jsx).not.toContain('alert(1)')
  })

  it('normalizes width and height from attributes, viewBox or defaults', () => {
    expect(normalizeSvgSize('<svg xmlns="http://www.w3.org/2000/svg" width="200px" height="100px" viewBox="0 0 10 20"></svg>')).toEqual({
      width: 200,
      height: 100
    })
    expect(normalizeSvgSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"></svg>')).toEqual({
      width: 120,
      height: 80
    })
    expect(normalizeSvgSize('<svg></svg>')).toEqual({ width: 300, height: 150 })
    expect(() => normalizeSvgSize('<div>not svg</div>')).toThrow('根元素')
  })

  it('renders three output tabs and converts to JSX and Data URI', async () => {
    const container = mount(svgConverter)
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3)
    expect(container.querySelector('[aria-label="JSX 输出"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Data URI 输出"]')).not.toBeNull()

    const input = container.querySelector('#sc-svg-input')
    setValue(
      input,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" stroke-width="2" style="fill:red" /></svg>'
    )
    clickText(container, '转换')
    await flush()

    const jsx = container.querySelector('[aria-label="JSX 输出"]').value
    const dataUri = container.querySelector('[aria-label="Data URI 输出"]').value
    expect(jsx).toContain('<rect')
    expect(jsx).toContain('strokeWidth="2"')
    expect(jsx).toContain("style={{ fill: 'red' }}")
    expect(dataUri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(errorText(container)).toContain('PNG 渲染失败')
  })

  it('explains missing xmlns and empty input', async () => {
    const container = mount(svgConverter)
    const input = container.querySelector('#sc-svg-input')

    setValue(input, '<svg viewBox="0 0 10 10"><rect width="10" height="10" /></svg>')
    clickText(container, '转换')
    await flush()
    expect(errorText(container)).toContain('缺少 xmlns')

    setValue(input, '')
    clickText(container, '转换')
    expect(errorText(container)).toContain('请先粘贴 SVG 代码')
  })
})

// ---------------------------------------------------------------------------
// 4. cubic-bezier
// ---------------------------------------------------------------------------

describe('cubic-bezier', () => {
  it('evaluates a linear curve exactly at endpoints and midpoint', () => {
    const linear = cubicBezier(0, 0, 1, 1)
    expect(linear.at(0)).toBe(0)
    expect(linear.at(1)).toBe(1)
    expect(linear.at(0.5)).toBeCloseTo(0.5, 8)
    expect(linear.css).toBe('cubic-bezier(0, 0, 1, 1)')
  })

  it('solves ease-in-out symmetric points', () => {
    const easeInOut = cubicBezier(0.42, 0, 0.58, 1)
    expect(easeInOut.at(0)).toBe(0)
    expect(easeInOut.at(0.5)).toBeCloseTo(0.5, 6)
    expect(easeInOut.at(0.25)).toBeLessThan(0.25)
    expect(easeInOut.at(0.75)).toBeGreaterThan(0.75)
    expect(easeInOut.css).toBe('cubic-bezier(0.42, 0, 0.58, 1)')
  })

  it('builds SVG paths and samples with the expected coordinates', () => {
    expect(bezierPath(0, 0, 1, 1)).toBe('M 0 100 C 0 100, 100 0, 100 0')
    expect(bezierPath(0.25, 0.1, 0.75, 0.9, 200)).toBe('M 0 200 C 50 180, 150 20, 200 0')

    const samples = sampleBezier(0, 0, 1, 1, 4)
    expect(samples).toHaveLength(5)
    expect(samples[0]).toEqual({ x: 0, y: 0 })
    expect(samples[2].x).toBeCloseTo(0.5, 10)
    expect(samples[2].y).toBeCloseTo(0.5, 10)
    expect(samples[4]).toEqual({ x: 1, y: 1 })
  })

  it('updates CSS output, clamps X values and applies presets', () => {
    const container = mount(cubicBezierTool)
    const output = container.querySelector('[aria-label="CSS 缓动函数"]')
    expect(output.value).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)')
    expect(container.querySelector('.bezier-curve').getAttribute('d')).toBe(bezierPath(0.25, 0.1, 0.25, 1))

    setValue(container.querySelector('#cb-x1'), '0.5')
    setValue(container.querySelector('#cb-y1'), '0.2')
    setValue(container.querySelector('#cb-x2'), '0.8')
    setValue(container.querySelector('#cb-y2'), '0.9')
    expect(output.value).toBe('cubic-bezier(0.5, 0.2, 0.8, 0.9)')

    setValue(container.querySelector('#cb-x1'), '2')
    expect(container.querySelector('#cb-x1').value).toBe('1')
    expect(output.value).toBe('cubic-bezier(1, 0.2, 0.8, 0.9)')

    clickText(container, '回弹')
    expect(output.value).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)')
  })

  it('starts and stops the preview animation from the same button', () => {
    const container = mount(cubicBezierTool)
    const play = findButton(container, '播放预览')
    play.click()
    expect(play.textContent).toBe('停止')
    play.click()
    expect(play.textContent).toBe('播放预览')
  })
})

// ---------------------------------------------------------------------------
// 5. clamp() 流体字号
// ---------------------------------------------------------------------------

describe('clamp-generator', () => {
  it('computes slope, intercept and the exact clamp string', () => {
    const result = buildClamp({ minSize: 16, maxSize: 24, minViewport: 320, maxViewport: 1200, rootFontSize: 16 })
    expect(result.min).toBe(16)
    expect(result.max).toBe(24)
    expect(result.slope).toBeCloseTo(8 / 880, 12)
    expect(result.intercept).toBeCloseTo(16 - (8 / 880) * 320, 12)
    expect(result.preferred).toBe('calc(0.8182rem + 0.9091vw)')
    expect(result.clamp).toBe('clamp(16px, calc(0.8182rem + 0.9091vw), 24px)')
    expect(result.lineHeight).toBe(1.5)
  })

  it('supports a zero slope and a custom root font size and line height', () => {
    const flat = buildClamp({ minSize: 20, maxSize: 20, minViewport: 400, maxViewport: 1200, rootFontSize: 20, lineHeight: 1.6 })
    expect(flat.slope).toBe(0)
    expect(flat.intercept).toBe(20)
    expect(flat.preferred).toBe('calc(1rem + 0vw)')
    expect(flat.clamp).toBe('clamp(20px, calc(1rem + 0vw), 20px)')
    expect(flat.lineHeight).toBe(1.6)
  })

  it('rejects inverted ranges and invalid sizes', () => {
    expect(() => buildClamp({ minSize: 30, maxSize: 20, minViewport: 320, maxViewport: 1200 })).toThrow('最小字号不能大于最大字号')
    expect(() => buildClamp({ minSize: 16, maxSize: 24, minViewport: 1200, maxViewport: 320 })).toThrow('最大视口必须大于最小视口')
    expect(() => buildClamp({ minSize: 0, maxSize: 24, minViewport: 320, maxViewport: 1200 })).toThrow('字号必须大于 0')
    expect(() => buildClamp({ minSize: 16, maxSize: 24, minViewport: 320, maxViewport: 1200, rootFontSize: 0 })).toThrow('根字号必须大于 0')
  })

  it('renders live CSS output, preview and the viewport ruler', () => {
    const container = mount(clampGenerator)
    const output = container.querySelector('[aria-label="CSS clamp 输出"]')
    expect(output.value).toBe('font-size: clamp(16px, calc(0.8182rem + 0.9091vw), 24px);\nline-height: 1.5;')
    expect(container.querySelectorAll('.clamp-ruler-row')).toHaveLength(5)
    expect(container.querySelector('.clamp-ruler-size').textContent).toBe('16.0px')

    setValue(container.querySelector('#cg-min-size'), '20')
    setValue(container.querySelector('#cg-max-size'), '40')
    expect(output.value).toBe('font-size: clamp(20px, calc(0.7955rem + 2.2727vw), 40px);\nline-height: 1.5;')
    expect(container.querySelector('.clamp-ruler-size').textContent).toBe('20.0px')
  })

  it('shows an error and clears the output for invalid input', () => {
    const container = mount(clampGenerator)
    setValue(container.querySelector('#cg-min-size'), '30')
    setValue(container.querySelector('#cg-max-size'), '20')
    expect(errorText(container)).toContain('最小字号不能大于最大字号')
    expect(container.querySelector('[aria-label="CSS clamp 输出"]').value).toBe('')
    expect(container.querySelectorAll('.clamp-ruler-row')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 共享结构规则（与 tools-smoke.test.js 保持一致）
// ---------------------------------------------------------------------------

describe('shared structural rules', () => {
  const tools = [
    ['image-editor', imageEditor],
    ['image-palette', imagePalette],
    ['svg-converter', svgConverter],
    ['cubic-bezier', cubicBezierTool],
    ['clamp-generator', clampGenerator]
  ]

  for (const [id, tool] of tools) {
    it(`${id} names every control and uses valid button/tab/choice markup`, () => {
      const container = mount(tool)
      enhanceFormAccessibility(container)

      expect(container.childElementCount).toBeGreaterThan(0)
      for (const control of container.querySelectorAll('input, textarea, select')) {
        const named = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
        expect(Boolean(named), `${id}: unnamed ${control.tagName}`).toBe(true)
      }
      expect(container.querySelector('select.input'), `${id}: select uses text-input styling`).toBeNull()
      expect(container.querySelector('button[class="btn"]'), `${id}: button has no variant`).toBeNull()
      for (const choice of container.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
        expect(choice.closest('label'), `${id}: choice is not wrapped by a label`).not.toBeNull()
      }
      expect(container.querySelector('.tool-section .tool-section, .result-box .tool-section'), `${id}: nested section`).toBeNull()

      for (const tab of container.querySelectorAll('[role="tab"]')) {
        const panelId = tab.getAttribute('aria-controls')
        expect(panelId, `${id}: tab without aria-controls`).toBeTruthy()
        expect(container.querySelector(`#${panelId}`)?.getAttribute('role')).toBe('tabpanel')
      }
      for (const group of container.querySelectorAll('[role="radiogroup"]')) {
        expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
      }
    })
  }
})
