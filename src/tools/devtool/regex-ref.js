import { createElement, createSection } from '../../utils/dom.js'

const CATEGORIES = [
  {
    label: '字符类',
    entries: [
      { pattern: '\\d', desc: '数字字符', example: '匹配 "3" 在 "abc3"' },
      { pattern: '\\D', desc: '非数字字符', example: '匹配 "abc" 在 "abc3"' },
      { pattern: '\\w', desc: '单词字符（字母、数字、下划线）', example: '匹配 "hello" 在 "hello!"' },
      { pattern: '\\W', desc: '非单词字符', example: '匹配 "!" 在 "hello!"' },
      { pattern: '\\s', desc: '空白字符（空格、制表符、换行等）', example: '匹配 " " 在 "a b"' },
      { pattern: '\\S', desc: '非空白字符', example: '匹配 "a" 和 "b" 在 "a b"' },
      { pattern: '.', desc: '除换行外的任意字符', example: '匹配 "a","b","c" 在 "abc"' },
      { pattern: '[abc]', desc: '匹配方括号中的任意字符', example: '匹配 "a" 或 "b" 或 "c"' },
      { pattern: '[^abc]', desc: '匹配不在方括号中的任意字符', example: '匹配 "d" 在 "abcd"' },
      { pattern: '[a-z]', desc: '匹配范围内的字符', example: '匹配 a 到 z 的小写字母' },
      { pattern: '[0-9]', desc: '匹配数字范围', example: '等价于 \\d' }
    ]
  },
  {
    label: '量词',
    entries: [
      { pattern: '*', desc: '零次或多次', example: 'ab* 匹配 "a", "ab", "abb"' },
      { pattern: '+', desc: '一次或多次', example: 'ab+ 匹配 "ab", "abb"，不匹配 "a"' },
      { pattern: '?', desc: '零次或一次', example: 'colou?r 匹配 "color" 和 "colour"' },
      { pattern: '{n}', desc: '恰好 n 次', example: 'a{3} 匹配 "aaa"' },
      { pattern: '{n,}', desc: '至少 n 次', example: 'a{2,} 匹配 "aa", "aaa", "aaaa"...' },
      { pattern: '{n,m}', desc: 'n 到 m 次', example: 'a{2,4} 匹配 "aa", "aaa", "aaaa"' },
      { pattern: '*?', desc: '零次或多次（非贪婪）', example: 'a.*?b 尽可能少匹配' },
      { pattern: '+?', desc: '一次或多次（非贪婪）', example: 'a.+?b 尽可能少匹配' }
    ]
  },
  {
    label: '位置',
    entries: [
      { pattern: '^', desc: '字符串/行的开始', example: '^Hello 匹配以 Hello 开头' },
      { pattern: '$', desc: '字符串/行的结束', example: 'world$ 匹配以 world 结尾' },
      { pattern: '\\b', desc: '单词边界', example: '\\bcat\\b 匹配独立的 "cat"' },
      { pattern: '\\B', desc: '非单词边界', example: '\\Bcat 匹配 "concatenate" 中的 cat' }
    ]
  },
  {
    label: '分组与引用',
    entries: [
      { pattern: '(abc)', desc: '捕获分组', example: '(\\d+)-(\\d+) 捕获两组数字' },
      { pattern: '(?:abc)', desc: '非捕获分组', example: '(?:ab)+ 匹配 "ab" 重复但不捕获' },
      { pattern: '(?=abc)', desc: '正向前瞻（肯定）', example: 'a(?=b) 匹配后面是 b 的 a' },
      { pattern: '(?!abc)', desc: '正向前瞻（否定）', example: 'a(?!b) 匹配后面不是 b 的 a' },
      { pattern: '(?<=abc)', desc: '反向前瞻（肯定）', example: '(?<=a)b 匹配前面是 a 的 b' },
      { pattern: '(?<!abc)', desc: '反向前瞻（否定）', example: '(?<!a)b 匹配前面不是 a 的 b' },
      { pattern: '\\1', desc: '反向引用第一个捕获组', example: '(\\w+)\\s\\1 匹配重复的单词' }
    ]
  },
  {
    label: '标志',
    entries: [
      { pattern: 'g', desc: '全局匹配（查找所有匹配）', example: '/abc/g 匹配所有 "abc"' },
      { pattern: 'i', desc: '忽略大小写', example: '/abc/i 匹配 "ABC", "Abc"...' },
      { pattern: 'm', desc: '多行模式（^ 和 $ 匹配行首行尾）', example: '/^a/m 匹配每行开头的 a' },
      { pattern: 's', desc: '点号匹配所有字符（包括换行）', example: '/a.b/s 匹配 "a\\nb"' },
      { pattern: 'u', desc: 'Unicode 模式', example: '/\\u{1F600}/u 匹配 emoji' }
    ]
  }
]

export default {
  id: 'regex-ref',
  name: '正则表达式速查表',
  description: '正则表达式语法参考，按分类查看常用模式、描述和示例',
  category: 'devtool',
  icon: 'regex',
  render(container) {
    const searchInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '搜索正则模式或描述（如 \\d, 量词, 前瞻）...'
    })

    const searchRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '搜索' }),
        searchInput
      ])
    ])

    const contentEl = createElement('div', {})

    function renderContent() {
      const query = searchInput.value.trim().toLowerCase()
      contentEl.innerHTML = ''

      CATEGORIES.forEach(cat => {
        const filtered = cat.entries.filter(entry => {
          if (!query) return true
          return entry.pattern.toLowerCase().includes(query) ||
            entry.desc.toLowerCase().includes(query) ||
            entry.example.toLowerCase().includes(query) ||
            cat.label.toLowerCase().includes(query)
        })

        if (filtered.length === 0) return

        const tabLabel = `${cat.label} (${filtered.length})`
        const listEl = createElement('div', { className: 'result-box' })

        filtered.forEach(entry => {
          const item = createElement('div', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-value', textContent: entry.pattern }),
            createElement('span', { className: 'stat-label', textContent: entry.desc }),
            createElement('span', { className: 'stat-label', textContent: entry.example })
          ])
          listEl.appendChild(item)
        })

        const section = createSection(tabLabel, listEl)
        contentEl.appendChild(section)
      })

      if (contentEl.children.length === 0) {
        contentEl.appendChild(
          createElement('div', { className: 'inline-result', textContent: '没有匹配的正则表达式条目' })
        )
      }
    }

    searchInput.addEventListener('input', renderContent)
    renderContent()

    const searchSection = createSection('搜索', searchRow)

    container.appendChild(searchSection)
    container.appendChild(contentEl)
  }
}
