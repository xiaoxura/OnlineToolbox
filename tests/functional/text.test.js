import { describe, it, expect } from 'vitest'
import {
  mountTool,
  editableTextareas,
  outputValue,
  setValue,
  clickText,
  clickPrimary,
  errorText,
  flush
} from '../helpers/tool-harness.js'

function statMap(container) {
  const map = {}
  container.querySelectorAll('.stat-item').forEach(item => {
    const value = item.querySelector('.stat-value')?.textContent ?? ''
    const label = item.querySelector('.stat-label')?.textContent ?? ''
    map[label] = value
  })
  return map
}

function checkbox(container, index) {
  return container.querySelectorAll('input[type="checkbox"]')[index]
}

function clickExact(container, text) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent.trim() === text)
  if (!button) throw new Error('button not found: ' + text)
  button.click()
  return button
}

describe('text tools functional audit', () => {
  it('char-count counts characters, lines, words, CJK and digits', async () => {
    const c = await mountTool('char-count')
    setValue(editableTextareas(c)[0], 'ab\n你好 123')
    const stats = statMap(c)
    expect(stats['字符数']).toBe('9')
    expect(stats['字节数(UTF-8)']).toBe('13')
    expect(stats['行数']).toBe('2')
    expect(stats['单词数']).toBe('3')
    expect(stats['中文字符数']).toBe('2')
    expect(stats['数字个数']).toBe('3')
  })

  it('char-count reports UTF-8 byte length for astral characters', async () => {
    const c = await mountTool('char-count')
    setValue(editableTextareas(c)[0], '😀')
    expect(statMap(c)['字节数(UTF-8)']).toBe('4')
  })

  it('text-diff renders added and removed lines', async () => {
    const c = await mountTool('text-diff')
    const [left, right] = editableTextareas(c)
    setValue(left, 'a\nb\nc')
    setValue(right, 'a\nX\nc')
    clickPrimary(c)
    const out = c.querySelector('.diff-output')
    expect(out.querySelector('.diff-removed')?.textContent).toBe('b')
    expect(out.querySelector('.diff-added')?.textContent).toBe('X')
  })

  it('text-diff reports identical input', async () => {
    const c = await mountTool('text-diff')
    const [left, right] = editableTextareas(c)
    setValue(left, 'same text')
    setValue(right, 'same text')
    clickPrimary(c)
    expect(c.querySelector('.diff-output').textContent).toContain('完全相同')
  })

  it('case-convert applies upper and lower case', async () => {
    const c = await mountTool('case-convert')
    const input = editableTextareas(c)[0]
    setValue(input, 'hello world')
    clickText(c, '全部大写')
    expect(outputValue(c)).toBe('HELLO WORLD')
    setValue(input, 'Hello World')
    clickText(c, '全部小写')
    expect(outputValue(c)).toBe('hello world')
  })

  it('case-convert capitalizes lines and words', async () => {
    const c = await mountTool('case-convert')
    const input = editableTextareas(c)[0]
    setValue(input, 'hello\nworld')
    clickText(c, '首字母大写')
    expect(outputValue(c)).toBe('Hello\nWorld')
    setValue(input, 'hello world foo')
    clickText(c, '每个单词首字母大写')
    expect(outputValue(c)).toBe('Hello World Foo')
  })

  it('case-convert handles fullwidth and traditional characters', async () => {
    const c = await mountTool('case-convert')
    const input = editableTextareas(c)[0]
    setValue(input, 'Ｈｅｌｌｏ　Ｗｏｒｌｄ　１２３')
    clickText(c, '全角→半角')
    expect(outputValue(c)).toBe('Hello World 123')
    setValue(input, 'Hello World 123')
    clickText(c, '半角→全角')
    expect(outputValue(c)).toBe('Ｈｅｌｌｏ　Ｗｏｒｌｄ　１２３')
    setValue(input, '國學機時會開點長問')
    clickText(c, '繁体→简体')
    expect(outputValue(c)).toBe('国学机时会开点长问')
  })

  it('text-dedup removes duplicate lines', async () => {
    const c = await mountTool('text-dedup')
    setValue(editableTextareas(c)[0], 'a\nb\na\nb\nc')
    clickText(c, '去重')
    expect(outputValue(c)).toBe('a\nb\nc')
  })

  it('text-dedup honors the ignore-case option', async () => {
    const c = await mountTool('text-dedup')
    setValue(editableTextareas(c)[0], 'A\na\nB')
    checkbox(c, 0).click()
    clickText(c, '去重')
    expect(outputValue(c)).toBe('A\nB')
  })

  it('text-sort sorts ascending, descending, by length and reversed', async () => {
    const c = await mountTool('text-sort')
    const input = editableTextareas(c)[0]
    setValue(input, 'b\na\nc')
    clickText(c, '升序 (A-Z)')
    expect(outputValue(c)).toBe('a\nb\nc')
    clickText(c, '降序 (Z-A)')
    expect(outputValue(c)).toBe('c\nb\na')
    setValue(input, 'aaa\na\naa')
    clickText(c, '按长度排序')
    expect(outputValue(c)).toBe('a\naa\naaa')
    setValue(input, '1\n2\n3')
    clickText(c, '反转顺序')
    expect(outputValue(c)).toBe('3\n2\n1')
  })

  it('regex finds and highlights global matches', async () => {
    const c = await mountTool('regex')
    setValue(c.querySelector('input[type="text"]'), '\\d+')
    setValue(editableTextareas(c)[0], 'a1b22c333')
    expect(c.querySelector('.inline-result').textContent).toContain('3')
    const marks = c.querySelectorAll('mark.regex-match')
    expect([...marks].map(m => m.textContent)).toEqual(['1', '22', '333'])
  })

  it('regex builds a capture group table', async () => {
    const c = await mountTool('regex')
    setValue(c.querySelector('input[type="text"]'), '(\\w)(\\d)')
    setValue(editableTextareas(c)[0], 'a1 b2')
    const table = c.querySelector('table')
    expect(table).toBeTruthy()
    expect(table.querySelectorAll('thead th').length).toBe(4)
    expect(table.querySelectorAll('tbody tr').length).toBe(2)
  })

  it('regex supports non-global and ignore-case flags', async () => {
    const c = await mountTool('regex')
    const pattern = c.querySelector('input[type="text"]')
    const text = editableTextareas(c)[0]
    const [globalFlag, ignoreCaseFlag] = c.querySelectorAll('input[type="checkbox"]')
    setValue(pattern, '\\d')
    setValue(text, 'a1b2')
    globalFlag.click()
    expect(c.querySelectorAll('mark.regex-match').length).toBe(1)
    globalFlag.click()
    setValue(pattern, 'abc')
    setValue(text, 'ABC abc')
    ignoreCaseFlag.click()
    expect(c.querySelectorAll('mark.regex-match').length).toBe(2)
  })

  it('regex reports invalid patterns', async () => {
    const c = await mountTool('regex')
    setValue(editableTextareas(c)[0], 'abc')
    setValue(c.querySelector('input[type="text"]'), '(')
    expect(errorText(c)).toContain('正则表达式语法错误')
  })

  it('text-replace replaces globally and counts occurrences', async () => {
    const c = await mountTool('text-replace')
    const text = editableTextareas(c)[0]
    const search = c.querySelector('input[placeholder="查找内容"]')
    const replace = c.querySelector('input[placeholder="替换为"]')
    setValue(text, 'Hello World Hello')
    setValue(search, 'Hello')
    setValue(replace, 'Hi')
    expect(outputValue(c)).toBe('Hi World Hi')
    expect(c.querySelector('.inline-result').textContent).toContain('2')
  })

  it('text-replace supports non-global and ignore-case modes', async () => {
    const c = await mountTool('text-replace')
    const text = editableTextareas(c)[0]
    const search = c.querySelector('input[placeholder="查找内容"]')
    const replace = c.querySelector('input[placeholder="替换为"]')
    setValue(text, 'Hello World Hello')
    setValue(search, 'Hello')
    setValue(replace, 'Hi')
    checkbox(c, 1).click()
    expect(outputValue(c)).toBe('Hi World Hello')
    checkbox(c, 1).click()
    setValue(text, 'hello HELLO')
    setValue(search, 'hello')
    setValue(replace, 'x')
    checkbox(c, 2).click()
    expect(outputValue(c)).toBe('x x')
  })

  it('text-replace supports regex replacement and errors', async () => {
    const c = await mountTool('text-replace')
    const text = editableTextareas(c)[0]
    const search = c.querySelector('input[placeholder="查找内容"]')
    const replace = c.querySelector('input[placeholder="替换为"]')
    setValue(text, 'a12b3')
    setValue(search, '(\\d+)')
    setValue(replace, '[$1]')
    checkbox(c, 0).click()
    expect(outputValue(c)).toBe('a[12]b[3]')
    setValue(search, '(')
    expect(errorText(c)).toContain('正则表达式语法错误')
  })

  it('escape escapes JSON and can round-trip it', async () => {
    const c = await mountTool('escape')
    const input = editableTextareas(c)[0]
    setValue(input, 'a"b\nc\\d')
    clickExact(c, '转义')
    expect(outputValue(c)).toBe(JSON.stringify('a"b\nc\\d').slice(1, -1))
    setValue(input, outputValue(c))
    clickExact(c, '反转义')
    expect(outputValue(c)).toBe('a"b\nc\\d')
  })

  it('escape escapes HTML mode', async () => {
    const c = await mountTool('escape')
    clickExact(c, 'HTML转义')
    setValue(editableTextareas(c)[0], '<a href="x">&')
    clickExact(c, '转义')
    expect(outputValue(c)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;')
  })

  it('escape escapes URL mode', async () => {
    const c = await mountTool('escape')
    clickExact(c, 'URL转义')
    setValue(editableTextareas(c)[0], '你好 world')
    clickExact(c, '转义')
    expect(outputValue(c)).toBe(encodeURIComponent('你好 world'))
  })

  it('escape round-trips JavaScript quotes', async () => {
    const c = await mountTool('escape')
    const input = editableTextareas(c)[0]
    clickExact(c, 'JavaScript转义')
    setValue(input, `a'b"c`)
    clickExact(c, '转义')
    setValue(input, outputValue(c))
    clickExact(c, '反转义')
    expect(outputValue(c)).toBe(`a'b"c`)
  })

  it('escape round-trips a JavaScript literal backslash sequence', async () => {
    const c = await mountTool('escape')
    const input = editableTextareas(c)[0]
    clickExact(c, 'JavaScript转义')
    setValue(input, 'a\\nb')
    clickExact(c, '转义')
    setValue(input, outputValue(c))
    clickExact(c, '反转义')
    expect(outputValue(c)).toBe('a\\nb')
  })

  it('markdown renders headings and emphasis', async () => {
    const c = await mountTool('markdown')
    setValue(editableTextareas(c)[0], '# Title\n\n**bold**')
    const preview = c.querySelector('.markdown-preview')
    expect(preview.innerHTML).toContain('<h1')
    expect(preview.innerHTML).toContain('<strong>bold</strong>')
  })

  it('markdown sanitizes dangerous HTML', async () => {
    const c = await mountTool('markdown')
    setValue(editableTextareas(c)[0], '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
    const preview = c.querySelector('.markdown-preview')
    expect(preview.innerHTML).not.toContain('<script')
    expect(preview.innerHTML).not.toContain('onerror')
  })

  it('set-operations computes all five operations', async () => {
    const c = await mountTool('set-operations')
    const [a, b] = editableTextareas(c)
    const select = c.querySelector('select')
    setValue(a, 'apple\nbanana\norange')
    setValue(b, 'banana\ngrape\norange')
    clickPrimary(c)
    expect(outputValue(c)).toBe('banana\norange')
    setValue(select, 'union')
    clickPrimary(c)
    expect(outputValue(c)).toBe('apple\nbanana\norange\ngrape')
    setValue(select, 'a-b')
    clickPrimary(c)
    expect(outputValue(c)).toBe('apple')
    setValue(select, 'b-a')
    clickPrimary(c)
    expect(outputValue(c)).toBe('grape')
    setValue(select, 'symmetric')
    clickPrimary(c)
    expect(outputValue(c)).toBe('apple\ngrape')
  })

  it('set-operations ignores case when requested', async () => {
    const c = await mountTool('set-operations')
    const [a, b] = editableTextareas(c)
    setValue(a, 'Apple\nBanana')
    setValue(b, 'apple')
    checkbox(c, 0).click()
    clickPrimary(c)
    expect(outputValue(c)).toBe('Apple')
  })

  it('text-encrypt round-trips AES encryption', async () => {
    const c = await mountTool('text-encrypt')
    const input = editableTextareas(c)[0]
    const key = c.querySelector('input[type="text"]')
    setValue(input, '机密 secret 42')
    setValue(key, 'pass123')
    clickPrimary(c)
    const cipher = outputValue(c)
    expect(cipher).not.toBe('')
    expect(cipher).not.toContain('失败')
    setValue(input, cipher)
    clickText(c, '解密')
    clickPrimary(c)
    expect(outputValue(c)).toBe('机密 secret 42')
  })

  it('text-encrypt reports a wrong key', async () => {
    const c = await mountTool('text-encrypt')
    const input = editableTextareas(c)[0]
    const key = c.querySelector('input[type="text"]')
    setValue(input, 'hello')
    setValue(key, 'right')
    clickPrimary(c)
    setValue(input, outputValue(c))
    setValue(key, 'wrong')
    clickText(c, '解密')
    clickPrimary(c)
    expect(outputValue(c)).toBe('解密失败，请检查密钥和密文')
  })

  it('slugify generates slugs and honors the separator option', async () => {
    const c = await mountTool('slugify')
    const input = editableTextareas(c)[0]
    setValue(input, 'Hello, World! 你好')
    expect(outputValue(c)).toBe('hello-world-你好')
    setValue(c.querySelector('select'), '_')
    expect(outputValue(c)).toBe('hello_world_你好')
    setValue(c.querySelector('select'), '')
    expect(outputValue(c)).toBe('helloworld你好')
  })

  it('slugify strips Latin accents with the default option', async () => {
    const c = await mountTool('slugify')
    setValue(editableTextareas(c)[0], 'Café Résumé')
    expect(outputValue(c)).toBe('cafe-resume')
  })

  it('line-endings converts between LF, CRLF and CR', async () => {
    const c = await mountTool('line-endings')
    const input = editableTextareas(c)[0]
    const select = c.querySelector('select')
    const copy = c.querySelector('.btn-icon[title="复制"]')
    setValue(input, 'a\r\nb\r\nc\r\n')
    clickPrimary(c)
    expect(outputValue(c)).toBe('a\nb\nc\n')
    copy.click()
    await flush()
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('a\nb\nc\n')
    setValue(select, '\r\n')
    copy.click()
    await flush()
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('a\r\nb\r\nc\r\n')
    setValue(select, '\r')
    copy.click()
    await flush()
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('a\rb\rc\r')
  })

  it('line-endings trims trailing whitespace when enabled', async () => {
    const c = await mountTool('line-endings')
    const input = editableTextareas(c)[0]
    setValue(input, 'a  \nb\t\n')
    checkbox(c, 0).click()
    clickPrimary(c)
    expect(outputValue(c)).toBe('a\nb\n')
  })

  it('text-wrap wraps long lines without splitting words', async () => {
    const c = await mountTool('text-wrap')
    const input = editableTextareas(c)[0]
    setValue(c.querySelector('input[type="number"]'), '10')
    checkbox(c, 0).click()
    setValue(input, 'supercalifragilistic short words after')
    clickPrimary(c)
    expect(outputValue(c)).toBe('supercalifragilistic\nshort\nwords\nafter')
  })

  it('text-wrap splits long words when enabled', async () => {
    const c = await mountTool('text-wrap')
    const input = editableTextareas(c)[0]
    setValue(c.querySelector('input[type="number"]'), '10')
    setValue(input, 'abcdefghijkl')
    clickPrimary(c)
    expect(outputValue(c)).toBe('abcdefghij\nkl')
  })

  it('markdown-table converts CSV with left alignment', async () => {
    const c = await mountTool('markdown-table')
    setValue(editableTextareas(c)[0], 'name,age\nAlice,30\nBob,25')
    clickPrimary(c)
    expect(outputValue(c)).toBe('| name | age |\n| :--- | :--- |\n| Alice | 30 |\n| Bob | 25 |')
  })

  it('markdown-table honors alignment and escapes pipes', async () => {
    const c = await mountTool('markdown-table')
    const input = editableTextareas(c)[0]
    const [, alignment] = c.querySelectorAll('select')
    setValue(alignment, 'center')
    setValue(input, 'x,y\na|b,c')
    clickPrimary(c)
    expect(outputValue(c)).toBe('| x | y |\n| :---: | :---: |\n| a\\|b | c |')
  })
})
