import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import byteTruncate, { countGraphemes, truncateToBytes, truncateWithStats, utf8ByteLength } from '../src/tools/text/byte-truncate.js'
import zhConvert, { convertBatch, convertChinese } from '../src/tools/text/zh-convert.js'
import pinyinTool, { toPinyin } from '../src/tools/text/pinyin.js'
import dataTable, { collectColumns, filterRows, parseTableData, sortRows } from '../src/tools/converter/data-table.js'
import ogMeta, { buildMetaTags, buildTwitterTags, escapeHtml } from '../src/tools/devtool/og-meta.js'
import { clickText, setValue } from './helpers/tool-harness.js'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function statValues() {
  return [...root.querySelectorAll('.stat-item .stat-value')].map(el => el.textContent)
}

describe('byte-truncate', () => {
  it('counts UTF-8 bytes and never splits grapheme clusters', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('中文')).toBe(6)
    expect(utf8ByteLength('😀')).toBe(4)
    expect(utf8ByteLength('e\u0301')).toBe(3)

    expect(truncateToBytes('中文abc', 4)).toEqual({ text: '中', bytes: 3, removed: 4 })
    expect(truncateToBytes('😀😀😀', 5)).toEqual({ text: '😀', bytes: 4, removed: 2 })
    expect(truncateToBytes('e\u0301x', 3)).toEqual({ text: 'e\u0301', bytes: 3, removed: 1 })
    // Surrogate pairs survive intact, and the result never contains a lone half.
    const emoji = truncateToBytes('ab😀cd', 6)
    expect(emoji).toEqual({ text: 'ab😀', bytes: 6, removed: 2 })
    expect(emoji.text.includes('\ud83d') && !emoji.text.includes('\ude00')).toBe(false)

    expect(truncateToBytes('abcdef', 5, { ellipsis: true })).toEqual({ text: 'ab…', bytes: 5, removed: 4 })
    // A custom marker that does not fit falls back to the default one.
    expect(truncateToBytes('abcdef', 5, { ellipsis: true, ellipsisText: '中文' })).toEqual({ text: 'ab…', bytes: 5, removed: 4 })
    // With a two-byte budget the three-byte default marker cannot fit at all.
    expect(truncateToBytes('abc', 2, { ellipsis: true })).toEqual({ text: 'ab', bytes: 2, removed: 1 })
    expect(truncateToBytes('abc', 3)).toEqual({ text: 'abc', bytes: 3, removed: 0 })
    expect(countGraphemes('e\u0301👨‍👩‍👧‍👦')).toBe(2)
    expect(truncateWithStats('中文', 3)).toMatchObject({ text: '中', bytes: 3, removed: 1, originalBytes: 6, originalChars: 2 })
    expect(() => truncateToBytes('x', -1)).toThrow('最大字节数必须是非负整数')
  })

  it('updates the output and stats from the controls', () => {
    byteTruncate.render(root)
    const input = root.querySelector('#byte-truncate-input')
    const max = root.querySelector('#byte-truncate-max')
    const output = root.querySelector('#byte-truncate-output')
    const ellipsis = root.querySelector('#byte-truncate-ellipsis')

    setValue(max, '4')
    setValue(input, '中文abc')
    expect(output.value).toBe('中')
    expect(statValues()).toEqual(['9', '3', '4'])

    setValue(max, '6')
    ellipsis.click()
    expect(output.value).toBe('中…')
    expect(statValues()).toEqual(['9', '6', '4'])

    setValue(max, '')
    expect(output.value).toBe('')
    expect(root.querySelector('.error-text').textContent).toContain('请输入最大字节数')

    clickText(root, '示例数据')
    expect(input.value).toContain('📧')
    expect(ellipsis.checked).toBe(true)
    expect(output.value.length).toBeGreaterThan(0)
    expect(root.querySelector('.error-text').textContent).toBe('')
  })
})

describe('zh-convert', () => {
  it('converts one-to-many phrases and supports batch + variants', async () => {
    expect(await convertChinese('头发和发财')).toBe('頭髮和發財')
    expect(await convertChinese('頭髮和發財', { direction: 't2s' })).toBe('头发和发财')
    expect(await convertChinese('里面', { variant: 'tw' })).toBe('裡面')
    expect(await convertChinese('里面', { variant: 'standard' })).toBe('裏面')
    expect(await convertBatch(['头发', '发呆'], { direction: 's2t' })).toEqual(['頭髮', '發呆'])
    await expect(convertChinese('abc', { direction: 'x2y' })).rejects.toThrow('不支持的转换方向')
    await expect(convertChinese('abc', { variant: 'jp' })).rejects.toThrow('不支持的转换变体')
  }, 20000)

  it('converts typed text after debounce and applies direction changes', async () => {
    zhConvert.render(root)
    const input = root.querySelector('#zh-convert-input')
    const output = root.querySelector('#zh-convert-output')

    setValue(input, '头发和发财')
    await vi.waitFor(() => expect(output.value).toBe('頭髮和發財'), { timeout: 15000 })
    expect(root.querySelector('.error-text').textContent).toBe('')

    clickText(root, '繁体 → 简体')
    await vi.waitFor(() => expect(output.value).toBe('头发和发财'), { timeout: 15000 })
    expect(root.querySelector('.loading-text').textContent).toBe('')
  }, 20000)

  it('renders the sample through the primary button', async () => {
    zhConvert.render(root)
    clickText(root, '示例数据')
    const output = root.querySelector('#zh-convert-output')
    await vi.waitFor(() => expect(output.value).not.toBe(''), { timeout: 15000 })
    expect(output.value).toContain('髮')
  }, 20000)
})

describe('pinyin', () => {
  it('converts full, initial and first-reading styles', async () => {
    expect(await toPinyin('中国', { tone: true })).toBe('zhōng guó')
    expect(await toPinyin('中国')).toBe('zhong guo')
    expect(await toPinyin('你好世界', { style: 'initial', separator: '' })).toBe('nhsj')
    expect(await toPinyin('长大')).toBe('zhang da')
    expect(await toPinyin('长大', { style: 'first' })).toBe('chang da')
    expect(await toPinyin('重庆', { style: 'first' })).toBe('zhong qing')
    expect(await toPinyin('中文', { separator: '-' })).toBe('zhong-wen')
    expect(await toPinyin('Hello 中国!')).toBe('Hello zhong guo!')
    expect(await toPinyin('')).toBe('')
    await expect(toPinyin('x', { style: 'bad' })).rejects.toThrow('不支持的拼音风格')
  }, 20000)

  it('switches style and separator from the UI', async () => {
    pinyinTool.render(root)
    const input = root.querySelector('#pinyin-input')
    const output = root.querySelector('#pinyin-output')
    const separator = root.querySelector('#pinyin-separator')
    const tone = root.querySelector('#pinyin-tone')

    setValue(input, '重庆银行')
    await vi.waitFor(() => expect(output.value).toBe('chong qing yin hang'), { timeout: 15000 })

    clickText(root, '首字母')
    await vi.waitFor(() => expect(output.value).toBe('c q y h'), { timeout: 15000 })

    setValue(separator, '-')
    await vi.waitFor(() => expect(output.value).toBe('c-q-y-h'), { timeout: 15000 })

    clickText(root, '全拼')
    setValue(separator, ' ')
    tone.click()
    await vi.waitFor(() => expect(output.value).toBe('chóng qìng yín háng'), { timeout: 15000 })
    expect(root.querySelector('.error-text').textContent).toBe('')
  }, 20000)
})

describe('data-table', () => {
  it('parses CSV/JSON and filters or sorts rows', () => {
    expect(parseTableData('name,age\nAlice,30\nBob,25')).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' }
    ])
    const jsonRows = parseTableData('[{"name":"Alice","age":30},{"name":"Bob","city":"上海"}]')
    expect(jsonRows).toHaveLength(2)
    expect(collectColumns(jsonRows)).toEqual(['name', 'age', 'city'])
    expect(parseTableData('[["A","B"],["C","D"]]')).toEqual([
      { 列1: 'A', 列2: 'B' },
      { 列1: 'C', 列2: 'D' }
    ])

    expect(sortRows([{ n: '10' }, { n: '2' }, { n: 'abc' }], 'n', 'asc').map(row => row.n)).toEqual(['2', '10', 'abc'])
    expect(sortRows([{ n: '10' }, { n: '2' }, { n: 'abc' }], 'n', 'desc').map(row => row.n)).toEqual(['abc', '10', '2'])
    expect(filterRows(jsonRows, 'ali')).toEqual([jsonRows[0]])
    expect(filterRows(jsonRows, '上海')).toEqual([jsonRows[1]])
    expect(filterRows(jsonRows, '')).toHaveLength(2)
    expect(() => parseTableData('{"a":1}')).toThrow('JSON 数据必须是对象数组或二维数组')
    expect(() => parseTableData('{bad', 'json')).toThrow('JSON 解析失败')
  })

  it('renders a sortable table and filters it from the search box', () => {
    dataTable.render(root)
    const input = root.querySelector('#data-table-input')
    const search = root.querySelector('#data-table-search')
    const message = root.querySelector('#data-table-message')

    setValue(input, 'name,city\nAlice,北京\nBob,上海')
    clickText(root, '解析')

    let headers = [...root.querySelectorAll('.result-table th')]
    expect(headers.map(th => th.textContent.trim())).toEqual(['name', 'city'])
    expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(2)
    expect(headers[0].getAttribute('aria-sort')).toBe('none')

    const sortButton = root.querySelector('.result-table th .th-sort')
    sortButton.click()
    expect(root.querySelector('.result-table th').getAttribute('aria-sort')).toBe('ascending')
    expect(root.querySelector('.result-table tbody tr td').textContent).toBe('Alice')

    sortButton.click()
    expect(root.querySelector('.result-table th').getAttribute('aria-sort')).toBe('descending')
    expect(root.querySelector('.result-table tbody tr td').textContent).toBe('Bob')

    setValue(search, '上海')
    expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(1)
    expect(root.querySelector('.result-table tbody tr td').textContent).toBe('Bob')

    setValue(search, '不存在')
    expect(root.querySelector('.result-table')).toBeNull()
    expect(message.textContent).toContain('没有匹配')

    clickText(root, '清空')
    expect(message.textContent).toContain('暂无数据')
  })

  it('loads CSV data from an uploaded file', async () => {
    dataTable.render(root)
    const fileInput = root.querySelector('#data-table-file')
    const file = new File(['name,city\nAlice,北京'], 'people.csv', { type: 'text/csv' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(1), { timeout: 5000 })
    expect(root.querySelector('#data-table-format').value).toBe('csv')
    expect(root.querySelector('#data-table-input').value).toContain('Alice')
    expect(root.querySelector('.result-table tbody tr td').textContent).toBe('Alice')
  })

  it('caps rendering at 500 rows for large inputs', () => {
    dataTable.render(root)
    const csv = ['a,b', ...Array.from({ length: 6000 }, (_, index) => `${index},${index * 2}`)].join('\n')
    setValue(root.querySelector('#data-table-input'), csv)
    clickText(root, '解析')

    expect(root.querySelectorAll('.result-table tbody tr')).toHaveLength(500)
    expect(root.querySelector('#data-table-message').textContent).toContain('仅渲染结果的前 500 行')
    expect(statValues()).toEqual(['6000', '6000', '500'])
  })
})

describe('og-meta', () => {
  it('builds escaped OG, Twitter and canonical tags', () => {
    const html = buildMetaTags({
      title: 'A & B <x> "q" \'s',
      description: 'D',
      url: 'https://example.com/a?b=1&c=2',
      image: 'https://example.com/i.png',
      siteName: '站点 & 名',
      type: 'article',
      locale: 'zh_CN',
      themeColor: '#111111'
    })
    expect(html).toContain('<meta property="og:title" content="A &amp; B &lt;x&gt; &quot;q&quot; &#39;s">')
    expect(html).toContain('<meta property="og:type" content="article">')
    expect(html).toContain('<meta property="og:site_name" content="站点 &amp; 名">')
    expect(html).toContain('<meta name="theme-color" content="#111111">')
    expect(html).toContain('<link rel="canonical" href="https://example.com/a?b=1&amp;c=2">')
    expect(html).not.toContain('twitter:')

    const twitter = buildTwitterTags({ title: 'A', description: 'D', image: 'https://example.com/i.png', twitterCard: 'summary' })
    expect(twitter).toContain('<meta name="twitter:card" content="summary">')
    expect(twitter).toContain('<meta name="twitter:title" content="A">')
    expect(twitter).toContain('<meta name="twitter:description" content="D">')
    expect(twitter).toContain('<meta name="twitter:image" content="https://example.com/i.png">')
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;')
    expect(buildMetaTags({})).toContain('og:type')
    expect(() => buildMetaTags({ type: 'video' })).toThrow('不支持的 og:type')
    expect(() => buildTwitterTags({ twitterCard: 'player' })).toThrow('不支持的 twitter:card')
  })

  it('updates the preview, output and copy state safely', () => {
    ogMeta.render(root)
    const output = root.querySelector('#og-output')
    const copy = root.querySelector('.tool-section .btn-icon')

    expect(output.value).toContain('og:type')
    expect(copy.disabled).toBe(true)

    setValue(root.querySelector('#og-title'), '我的 & 标题')
    setValue(root.querySelector('#og-description'), '描述 <script>alert(1)</script>')
    setValue(root.querySelector('#og-url'), 'https://example.com/page')
    setValue(root.querySelector('#og-image'), 'https://example.com/cover.png')
    setValue(root.querySelector('#og-site-name'), '站点')

    expect(output.value).toContain('content="我的 &amp; 标题"')
    expect(output.value).toContain('twitter:title')
    expect(output.value).toContain('twitter:image')
    expect(output.value).toContain('<link rel="canonical" href="https://example.com/page">')
    expect(root.querySelector('.og-card-title').textContent).toBe('我的 & 标题')
    expect(root.querySelector('.og-card-description').textContent).toContain('<script>')
    expect(root.querySelector('.og-card-site').textContent).toContain('example.com')
    expect(root.querySelector('.og-card-image').getAttribute('src')).toBe('https://example.com/cover.png')
    expect(root.innerHTML).not.toContain('<script>')
    expect(copy.disabled).toBe(false)

    setValue(root.querySelector('#og-title'), '')
    expect(root.querySelector('.og-card-title').textContent).toBe('标题将显示在这里')
    expect(copy.disabled).toBe(true)
  })
})
