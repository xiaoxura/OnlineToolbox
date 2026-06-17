import { createElement, createCopyButton, createSection, createTabGroup } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'sql',
  name: 'SQL 格式化',
  description: 'SQL 语句美化',
  category: 'formatter',
  icon: 'sql',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      placeholder: '请输入 SQL 语句...',
      rows: 8
    })

    const output = createElement('textarea', {
      className: 'textarea',
      placeholder: '结果将显示在这里...',
      rows: 10,
      readOnly: true
    })

    const SQL_KEYWORDS = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT',
      'INNER', 'OUTER', 'CROSS', 'FULL', 'ON', 'GROUP BY', 'ORDER BY',
      'HAVING', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
      'INTO', 'VALUES', 'SET', 'AS', 'IN', 'NOT', 'NULL', 'IS',
      'BETWEEN', 'LIKE', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT',
      'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'BEGIN',
      'COMMIT', 'ROLLBACK', 'TABLE', 'INDEX', 'VIEW', 'TRIGGER',
      'PROCEDURE', 'FUNCTION', 'DECLARE', 'RETURN', 'RETURNS',
      'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT',
      'DEFAULT', 'AUTO_INCREMENT', 'IF', 'REPLACE', 'TOP',
      'WITH', 'RECURSIVE', 'OVER', 'PARTITION', 'ROW_NUMBER',
      'RANK', 'DENSE_RANK', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
      'COALESCE', 'CAST', 'CONVERT', 'TRIM', 'UPPER', 'LOWER',
      'SUBSTRING', 'CONCAT', 'LENGTH', 'NOW', 'DATE', 'YEAR',
      'MONTH', 'DAY', 'ASC', 'DESC', 'FETCH', 'NEXT', 'ROWS',
      'ONLY', 'NATURAL', 'USING', 'BOTH', 'LEADING', 'TRAILING',
      'TRUE', 'FALSE'
    ]

    // Major clauses that should start on a new line
    const MAJOR_CLAUSES = [
      'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'CROSS JOIN', 'FULL JOIN', 'OUTER JOIN', 'GROUP BY', 'ORDER BY',
      'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'INTERSECT',
      'EXCEPT', 'ON', 'VALUES', 'SET', 'INTO'
    ]

    // Subquery indicators
    const SUBQUERY_START = ['SELECT', 'CASE', 'WHEN', 'EXISTS']

    function formatSQL(sql) {
      // Normalize whitespace
      let text = sql.replace(/\s+/g, ' ').trim()

      // Tokenize: split by strings (single-quoted) and keywords
      // First, protect string literals
      const strings = []
      text = text.replace(/'([^']*)'/g, (match) => {
        strings.push(match)
        return '___STRING_' + (strings.length - 1) + '___'
      })

      // Also protect backtick-quoted identifiers
      text = text.replace(/`([^`]*)`/g, (match) => {
        strings.push(match)
        return '___STRING_' + (strings.length - 1) + '___'
      })

      // Normalize keywords: uppercase all known keywords
      for (const kw of SQL_KEYWORDS) {
        const regex = new RegExp('\\b' + kw.replace(/\s+/g, '\\s+') + '\\b', 'gi')
        text = text.replace(regex, kw)
      }

      // Add newlines before major clauses
      for (const clause of MAJOR_CLAUSES) {
        const regex = new RegExp('\\b(' + clause.replace(/\s+/g, '\\s+') + ')\\b', 'gi')
        text = text.replace(regex, '\n$1')
      }

      // Handle commas: put each select column on its own line
      // First, handle SELECT ... FROM (columns)
      text = text.replace(/SELECT\s/gi, 'SELECT\n  ')
      text = text.replace(/,\s*/g, ',\n  ')

      // Handle subquery indentation: (SELECT ... )
      // Simple approach: track parentheses depth
      const lines = text.split('\n')
      let formatted = ''
      let depth = 0
      const indentStr = '  '

      for (let line of lines) {
        line = line.trim()
        if (!line) continue

        // Count opening and closing parens to adjust depth
        let openParens = 0
        let closeParens = 0
        for (const ch of line) {
          if (ch === '(') openParens++
          if (ch === ')') closeParens++
        }

        // If line starts with ), decrease depth before printing
        if (line.startsWith(')')) {
          depth = Math.max(0, depth - 1)
        }

        formatted += indentStr.repeat(depth) + line + '\n'

        // Adjust depth for next line
        depth += openParens - closeParens
        if (depth < 0) depth = 0
      }

      // Clean up: remove extra indentation from commas that are part of column lists
      formatted = formatted
        .replace(/,\n(\s*)/g, ',\n  ')

      // Restore strings
      for (let i = 0; i < strings.length; i++) {
        formatted = formatted.replace('___STRING_' + i + '___', strings[i])
      }

      // Final cleanup
      return formatted
        .split('\n')
        .map(l => l.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }

    const beautifyBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: () => {
        const text = input.value.trim()
        if (!text) return
        output.value = formatSQL(text)
      }
    }, ['美化 SQL'])

    const copyBtn = createCopyButton(() => output.value)

    const exampleBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '示例数据'
    })

    const btnGroup = createElement('div', {
      className: 'btn-group'
    }, [beautifyBtn, exampleBtn, copyBtn])

    const inputSection = createSection('输入 SQL', input)
    const outputSection = createSection('输出结果', output, [copyBtn])

    container.appendChild(inputSection)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)

    exampleBtn.addEventListener('click', () => {
      input.value = `select u.id, u.name, u.email, o.order_id, o.total_amount, o.created_at from users u left join orders o on u.id = o.user_id where u.status = 'active' and o.total_amount > 100 group by u.id, o.order_id order by o.created_at desc limit 50`
    })
  }
}
