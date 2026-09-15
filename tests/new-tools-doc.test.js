import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import htmlToMarkdownTool, { htmlToMarkdown } from '../src/tools/converter/html-to-markdown.js'
import markdownToc, { generateToc, slugifyHeading } from '../src/tools/converter/markdown-toc.js'
import csvToolbox, {
  addColumn,
  convertDelimiter,
  parseCsv,
  selectColumns,
  swapColumns,
  toCsv,
  transpose
} from '../src/tools/converter/csv-toolbox.js'
import wordFrequency, { countWords, summarize, tokenize } from '../src/tools/text/word-frequency.js'
import textExtract, {
  extractAll,
  extractChinese,
  extractEmails,
  extractHashtags,
  extractIpv4,
  extractIpv6,
  extractMentions,
  extractNumbers,
  extractPhones,
  extractUrls
} from '../src/tools/text/text-extract.js'
import { enhanceFormAccessibility } from '../src/utils/dom.js'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function editableTextarea() {
  return root.querySelector('textarea:not([readonly])')
}

function outputTextarea() {
  return root.querySelector('textarea[readonly]')
}

function runPrimaryAction() {
  root.querySelector('.btn-primary').click()
}

function setValue(control, value) {
  control.value = value
  control.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('html-to-markdown', () => {
  it('walks the DOM for headings, paragraphs and inline marks', () => {
    const markdown = htmlToMarkdown('<h2>标题</h2><p>这是 <strong>粗体</strong> 与 <em>斜体</em> 文本。</p>')
    expect(markdown).toBe('## 标题\n\n这是 **粗体** 与 *斜体* 文本。')
  })

  it('keeps list nesting and ordered numbering', () => {
    const markdown = htmlToMarkdown('<ul><li>一<ul><li>一之细节</li></ul></li><li>二</li></ul>')
    expect(markdown).toBe('- 一\n  - 一之细节\n- 二')

    expect(htmlToMarkdown('<ol start="3"><li>x</li><li>y</li></ol>')).toBe('3. x\n4. y')
    expect(htmlToMarkdown('<ul><li><p>松散项</p><p>第二段</p></li></ul>')).toBe('- 松散项\n\n  第二段')
  })

  it('renders GFM tables with the alignment of each column', () => {
    const markdown = htmlToMarkdown(
      '<table><thead><tr><th align="left">字段</th><th style="text-align:center">类型</th><th align="right">长度</th></tr></thead>' +
      '<tbody><tr><td>a|b</td><td>string</td><td>64</td></tr></tbody></table>'
    )
    expect(markdown.split('\n')).toEqual([
      '| 字段 | 类型 | 长度 |',
      '| --- | :---: | ---: |',
      '| a\\|b | string | 64 |'
    ])

    // GFM needs a header row even when the source table has none.
    const headerless = htmlToMarkdown('<table><tr><td>a</td><td>b</td></tr></table>')
    expect(headerless.split('\n')[1]).toBe('| --- | --- |')
    expect(headerless).toContain('| a | b |')
  })

  it('fences code blocks with the language taken from the class', () => {
    const markdown = htmlToMarkdown('<pre><code class="language-js">const a = 1\nconst b = 2</code></pre>')
    expect(markdown).toBe('```js\nconst a = 1\nconst b = 2\n```')
  })

  it('nests blockquotes and definition lists', () => {
    expect(htmlToMarkdown('<blockquote><p>外层</p><blockquote><p>内层</p></blockquote></blockquote>'))
      .toBe('> 外层\n>\n> > 内层')
    expect(htmlToMarkdown('<dl><dt>术语</dt><dd>定义</dd></dl>')).toBe('术语\n: 定义')
  })

  it('resolves relative links only when asked to', () => {
    const html = '<p><a href="/docs/start">文档</a></p>'
    expect(htmlToMarkdown(html)).toBe('[文档](/docs/start)')
    expect(htmlToMarkdown(html, { absoluteUrls: true, baseUrl: 'https://example.com/dir/page.html' }))
      .toBe('[文档](https://example.com/docs/start)')
    expect(htmlToMarkdown('<p><a href="next.html">下一页</a></p>', { absoluteUrls: true, baseUrl: 'https://example.com/dir/page.html' }))
      .toBe('[下一页](https://example.com/dir/next.html)')
    // In-page anchors and mail links stay as they are.
    expect(htmlToMarkdown('<p><a href="#top">顶部</a></p>', { absoluteUrls: true, baseUrl: 'https://example.com/' }))
      .toBe('[顶部](#top)')
  })

  it('escapes Markdown syntax that appears literally in the text', () => {
    expect(htmlToMarkdown('<p># 不是标题</p><p>- 不是列表</p>'))
      .toBe('\\# 不是标题\n\n\\- 不是列表')
    expect(htmlToMarkdown('<p>5 * 3 与 中文*强调*</p>')).toBe('5 \\* 3 与 中文\\*强调\\*')
    // snake_case identifiers survive unescaped.
    expect(htmlToMarkdown('<p>使用 user_name 字段</p>')).toBe('使用 user_name 字段')
  })

  it('follows the line break strategy and the HTML fallback switch', () => {
    expect(htmlToMarkdown('<p>一<br>二</p>')).toBe('一  \n二')
    expect(htmlToMarkdown('<p>一<br>二</p>', { lineBreak: 'html' })).toBe('一<br>二')
    expect(htmlToMarkdown('<p>一<br>二</p>', { lineBreak: 'backslash' })).toBe('一\\\n二')
    expect(htmlToMarkdown('<p>值 <sub>1</sub></p>')).toBe('值 1')
    expect(htmlToMarkdown('<p>值 <sub>1</sub></p>', { keepHtml: true })).toBe('值 <sub>1</sub>')
  })

  it('drops script, style and head content', () => {
    const markdown = htmlToMarkdown('<html><head><title>T</title><style>a{}</style></head><body><h1>标题</h1><script>var a=1</script><p>正文</p></body></html>')
    expect(markdown).toBe('# 标题\n\n正文')
  })

  it('renders a sanitised preview next to the output', () => {
    htmlToMarkdownTool.render(root)
    editableTextarea().value = '<h1>预览标题</h1><p>正文 <strong>加粗</strong></p>'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('# 预览标题\n\n正文 **加粗**')
    const preview = root.querySelector('.markdown-preview')
    expect(preview.innerHTML).toContain('<h1>预览标题</h1>')
    expect(preview.querySelector('strong').textContent).toBe('加粗')
    expect(root.querySelector('.markdown-preview').closest('.tool-section')).not.toBeNull()
  })

  it('falls back to the raw tag when 保留 HTML 标签 is checked in the UI', () => {
    htmlToMarkdownTool.render(root)
    editableTextarea().value = '<p>下角标 <sub>2</sub></p>'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('下角标 2')
    root.querySelectorAll('input[type="checkbox"]')[0].click()
    expect(outputTextarea().value).toBe('下角标 <sub>2</sub>')
  })
})

describe('markdown-toc', () => {
  it('builds GitHub style anchors', () => {
    expect(slugifyHeading('Hello, World! 你好')).toBe('hello-world-你好')
    expect(slugifyHeading('  **Bold** `code` title  ')).toBe('bold-code-title')
    expect(slugifyHeading('C++ 与 C#')).toBe('c-与-c')
  })

  it('nests the table of contents by heading level', () => {
    const toc = generateToc('# 标题\n\n## 小节\n\n### 细节\n\n## 另一节\n')
    expect(toc).toBe([
      '- [标题](#标题)',
      '  - [小节](#小节)',
      '    - [细节](#细节)',
      '  - [另一节](#另一节)'
    ].join('\n'))
  })

  it('ignores headings inside fenced code blocks', () => {
    const toc = generateToc('# 标题\n\n```bash\n# 注释不是标题\n```\n\n~~~\n## 也不是\n~~~\n\n## 真的标题\n')
    expect(toc).toBe('- [标题](#标题)\n  - [真的标题](#真的标题)')
  })

  it('deduplicates repeated anchors with a counter suffix', () => {
    const toc = generateToc('## 重复\n\n## 重复\n\n## 重复')
    expect(toc).toBe('- [重复](#重复)\n- [重复](#重复-1)\n- [重复](#重复-2)')
  })

  it('honours the level window, bullet and title switches', () => {
    const markdown = '# 文档标题\n\n## 第一节\n\n#### 深层\n'
    expect(generateToc(markdown, { minLevel: 2, maxLevel: 3 })).toBe('- [第一节](#第一节)')
    expect(generateToc(markdown, { bullet: '*' })).toContain('* [文档标题](#文档标题)')
    expect(generateToc(markdown, { includeTitle: false })).toBe('- [第一节](#第一节)\n  - [深层](#深层)')
    expect(generateToc('没有标题的正文')).toBe('')
  })

  it('parses Setext headings only when enabled', () => {
    const markdown = '文档标题\n===\n\n小节\n---\n'
    expect(generateToc(markdown)).toBe('')
    expect(generateToc(markdown, { setext: true })).toBe('- [文档标题](#文档标题)\n  - [小节](#小节)')
  })

  it('renders the generated toc into the output textarea', () => {
    markdownToc.render(root)
    editableTextarea().value = '# 标题\n\n## 小节\n'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('- [标题](#标题)\n  - [小节](#小节)')
  })
})

describe('csv-toolbox', () => {
  it('parses quoted fields and drops the trailing newline row', () => {
    const rows = parseCsv('姓名,城市\n张三,"上海, 浦东"\n')
    expect(rows).toEqual([['姓名', '城市'], ['张三', '上海, 浦东']])
    expect(parseCsv('')).toEqual([])
  })

  it('re-serialises with quoting only where it is required', () => {
    expect(toCsv([['a', 'b,c'], ['d"e', 'f\ng']], ',')).toBe('a,"b,c"\n"d""e","f\ng"')
    // A comma is plain text when the delimiter is a tab.
    expect(toCsv([['a,b', 'c']], '\t')).toBe('a,b\tc')
  })

  it('transposes a ragged matrix and pads the gaps', () => {
    expect(transpose([['a', 'b', 'c'], ['1', '2']])).toEqual([['a', '1'], ['b', '2'], ['c', '']])
    expect(transpose([])).toEqual([])
  })

  it('converts between delimiters without losing content', () => {
    expect(convertDelimiter('a,b\n1,2', ',', '\t')).toBe('a\tb\n1\t2')
    expect(convertDelimiter('a\tb\n1\t2', '\t', ',')).toBe('a,b\n1,2')
  })

  it('selects columns by index or by header name', () => {
    const rows = [['name', 'age', 'city'], ['张三', '28', '北京']]
    expect(selectColumns(rows, [0, 2])).toEqual([['name', 'city'], ['张三', '北京']])
    expect(selectColumns(rows, ['city', 'name'])).toEqual([['city', 'name'], ['北京', '张三']])
  })

  it('swaps and appends columns', () => {
    const rows = [['a', 'b', 'c'], ['1', '2', '3']]
    expect(swapColumns(rows, 0, 2)).toEqual([['c', 'b', 'a'], ['3', '2', '1']])
    expect(() => swapColumns(rows, 0, 9)).toThrow('要交换的列不存在')
    expect(addColumn(rows, '序号', (index) => String(index))).toEqual([
      ['a', 'b', 'c', '序号'],
      ['1', '2', '3', '1']
    ])
    // header:false keeps every row as data even when a name is supplied.
    expect(addColumn(rows.slice(1), 'fixed', 'x', { header: false })).toEqual([
      ['1', '2', '3', 'x']
    ])
  })

  it('runs the selected operation from the UI', () => {
    csvToolbox.render(root)
    editableTextarea().value = '姓名,城市\n张三,北京\n李四,上海\n'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('姓名,张三,李四\n城市,北京,上海')

    // keep column 2 (the visible column numbers are 1-based)
    const operation = root.querySelectorAll('select')[1]
    setValue(operation, 'keep')
    expect(outputTextarea().value).toBe('姓名\n张三\n李四')
    setValue(root.querySelector('.form-row input.input'), '2')
    expect(outputTextarea().value).toBe('城市\n北京\n上海')

    setValue(operation, 'add')
    expect(outputTextarea().value).toBe('姓名,城市,序号\n张三,北京,1\n李四,上海,2')
  })

  it('reports a parse error instead of an empty result', () => {
    csvToolbox.render(root)
    editableTextarea().value = 'a,b\n"未闭合'
    runPrimaryAction()
    expect(root.querySelector('.error-text').textContent).toContain('CSV 解析失败')
    expect(outputTextarea().value).toBe('')
  })
})

describe('word-frequency', () => {
  it('tokenizes Latin runs as whole words', () => {
    expect(tokenize('Hello, world! The O\'Brien\'s tools.')).toEqual(['hello', 'world', 'the', "o'brien's", 'tools'])
  })

  it('splits CJK runs into bigrams', () => {
    expect(tokenize('自然语言处理')).toEqual(['自然', '然语', '语言', '言处', '处理'])
    expect(tokenize('好')).toEqual(['好'])
  })

  it('handles mixed text, case and the language scope', () => {
    expect(tokenize('使用 Node.js 构建 API')).toEqual(['使用', 'node', 'js', '构建', 'api'])
    expect(tokenize('Node node NODE', { caseSensitive: true })).toEqual(['Node', 'node', 'NODE'])
    expect(tokenize('使用 Node.js 构建 API', { mode: 'cjk' })).toEqual(['使用', '构建'])
    expect(tokenize('使用 Node.js 构建 API', { mode: 'latin' })).toEqual(['node', 'js', 'api'])
  })

  it('applies the minimum length and stop words', () => {
    expect(tokenize('a an and 中文 的 的', { minLength: 2 })).toEqual(['an', 'and', '中文'])
    expect(tokenize('the quick brown fox', { ignoreStopwords: true })).toEqual(['quick', 'brown', 'fox'])
    expect(tokenize('我们 已经 完成', { ignoreStopwords: true })).toEqual(['完成'])
  })

  it('counts, ranks and percentages the tokens', () => {
    const results = countWords('apple banana apple cherry apple banana')
    expect(results[0]).toEqual({ word: 'apple', count: 3, percentage: 50 })
    expect(results[1]).toEqual({ word: 'banana', count: 2, percentage: 33.33 })
    expect(results[2].word).toBe('cherry')

    const summary = summarize('one two two three three three')
    expect(summary.total).toBe(6)
    expect(summary.unique).toBe(3)
    expect(summarize('a b c', { topN: 2 }).top).toHaveLength(2)
  })

  it('renders stats, bars and a ranked table', () => {
    wordFrequency.render(root)
    editableTextarea().value = 'apple banana apple cherry apple banana'
    runPrimaryAction()

    const values = [...root.querySelectorAll('.stat-value')].map(node => node.textContent)
    expect(values[0]).toBe('6')
    expect(values[1]).toBe('3')

    const rows = [...root.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(3)
    expect([...rows[0].children].map(cell => cell.textContent)).toEqual(['1', 'apple', '3', '50%'])
    expect(root.querySelectorAll('.freq-bar')).toHaveLength(3)
    expect(root.querySelector('.freq-bar-fill').style.width).toBe('100%')

    // 最小词长 filters the table: at 6 the 5-letter "apple" is gone.
    setValue(root.querySelector('input[type="number"]'), '6')
    expect([...root.querySelectorAll('tbody tr td:nth-child(2)')].map(cell => cell.textContent))
      .toEqual(['banana', 'cherry'])
  })
})

describe('text-extract', () => {
  it('extracts emails and urls', () => {
    expect(extractEmails('联系 a.b@example.com 或 c@sub.example.co.uk')).toEqual(['a.b@example.com', 'c@sub.example.co.uk'])
    expect(extractUrls('见 https://example.com/a?b=1). 以及 www.example.org/help')).toEqual([
      'https://example.com/a?b=1',
      'www.example.org/help'
    ])
    expect(extractUrls('https://www.example.com/x')).toEqual(['https://www.example.com/x'])
  })

  it('validates IPv4 octets and recognises IPv6 addresses', () => {
    expect(extractIpv4('192.168.1.10 与 999.999.999.999 与 256.1.1.1')).toEqual(['192.168.1.10'])
    expect(extractIpv4('010.1.1.1')).toEqual([])
    expect(extractIpv6('地址 2001:db8::1 与 ::1')).toEqual(['2001:db8::1', '::1'])
    // A clock reading is not an IPv6 address.
    expect(extractIpv6('时间 12:30:45')).toEqual([])
  })

  it('extracts phones, hashtags, mentions, numbers and Chinese', () => {
    expect(extractPhones('手机 13812345678 与 12812345678 与 +8613912345678')).toEqual(['13812345678', '+8613912345678'])
    expect(extractHashtags('关注 #开发者工具箱 和 #tools')).toEqual(['#开发者工具箱', '#tools'])
    expect(extractMentions('联系 @alice 或 @bob_2，邮箱 a@example.com')).toEqual(['@alice', '@bob_2'])
    expect(extractNumbers('v1.2 版本 42 与 3.14')).toEqual(['42', '3.14'])
    expect(extractChinese('hello 中文提取 world')).toEqual(['中文提取'])
  })

  it('aggregates the selected kinds with occurrence counts', () => {
    const entries = extractAll('a@b.com 与 c@d.com 与 a@b.com', ['email'])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ kind: 'email', label: '邮箱', value: 'a@b.com', count: 2 })
    expect(entries[1].count).toBe(1)
    expect(extractAll('a@b.com', ['ipv4'])).toEqual([])
  })

  it('fills the table and the copyable list from the UI', () => {
    textExtract.render(root)
    editableTextarea().value = '写信给 a@b.com 或 c@d.com，官网 https://example.com 。'
    runPrimaryAction()

    const rows = [...root.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(3)
    expect([...rows[0].children].map(cell => cell.textContent)).toEqual(['邮箱', 'a@b.com', '1'])
    expect(outputTextarea().value.split('\n')).toEqual(['a@b.com', 'c@d.com', 'https://example.com'])

    // 去重 off repeats each value as often as it occurs.
    const dedupeBox = [...root.querySelectorAll('input[type="checkbox"]')]
      .find(box => box.closest('label')?.textContent.trim() === '去重')
    expect(dedupeBox).toBeTruthy()
    editableTextarea().value = 'a@b.com 与 a@b.com'
    runPrimaryAction()
    expect(outputTextarea().value).toBe('a@b.com')
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1)
    dedupeBox.click()
    expect(outputTextarea().value.split('\n')).toEqual(['a@b.com', 'a@b.com'])
  })

  it('reports when nothing matches', () => {
    textExtract.render(root)
    editableTextarea().value = '没有任何可提取内容的纯文本。'
    runPrimaryAction()
    expect(root.querySelector('tbody').children).toHaveLength(0)
  })
})

describe('new document tools follow the UI conventions', () => {
  const descriptors = [
    ['html-to-markdown', htmlToMarkdownTool],
    ['markdown-toc', markdownToc],
    ['csv-toolbox', csvToolbox],
    ['word-frequency', wordFrequency],
    ['text-extract', textExtract]
  ]

  it.each(descriptors)('%s renders synchronously and stays accessible', (id, descriptor) => {
    expect(descriptor.id).toBe(id)
    expect(typeof descriptor.render).toBe('function')
    expect(() => descriptor.render(root)).not.toThrow()
    enhanceFormAccessibility(root)

    for (const control of root.querySelectorAll('input, textarea, select')) {
      const named = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
      expect(Boolean(named), `${id}: unnamed ${control.tagName}`).toBe(true)
    }
    expect(root.querySelector('select.input')).toBeNull()
    expect(root.querySelector('button[class="btn"]')).toBeNull()
    for (const choice of root.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
      expect(choice.closest('label')).not.toBeNull()
    }
    expect(root.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box')).toBeNull()
    for (const table of root.querySelectorAll('table.result-table')) {
      expect(table.parentElement?.classList.contains('table-scroll')).toBe(true)
    }
    for (const group of root.querySelectorAll('[role="radiogroup"]')) {
      expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
    }
  })

  it.each(descriptors)('%s ships a 示例数据 button that fills its input', (id, descriptor) => {
    descriptor.render(root)
    const sample = [...root.querySelectorAll('.btn-secondary')].find(button => button.textContent === '示例数据')
    expect(sample, `${id}: missing 示例数据 button`).toBeTruthy()
    sample.click()
    const filled = [...root.querySelectorAll('textarea')].some(area => area.value.trim().length > 0)
    expect(filled, `${id}: 示例数据 filled nothing`).toBe(true)
  })
})
