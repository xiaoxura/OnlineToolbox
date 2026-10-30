import { describe, expect, it } from 'vitest'
import { SQL_DIALECTS, formatSql, formatWithPrettier } from '../src/utils/format.js'

describe('lazy formatters', () => {
  it('formats SQL with sql-formatter and uppercases keywords', async () => {
    const output = await formatSql('select id,name from users where age>18')
    expect(output).toContain('SELECT')
    expect(output).toContain('FROM')
    expect(output).toContain('WHERE')
    expect(output).toContain('  id,')
    expect(SQL_DIALECTS.map(item => item.value)).toContain('postgresql')
  })

  it('formats HTML and CSS through Prettier', async () => {
    await expect(formatWithPrettier('<div><p>x</p></div>', 'html')).resolves.toContain('<p>x</p>')
    await expect(formatWithPrettier('a:hover{color:red}', 'css')).resolves.toContain('color: red;')
  })

  it('rejects an unsupported parser', async () => {
    await expect(formatWithPrettier('x', 'nonsense')).rejects.toThrow(/不支持的格式化解析器/)
  })
})
