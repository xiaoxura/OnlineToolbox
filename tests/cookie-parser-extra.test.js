import { afterEach, describe, expect, it } from 'vitest'
import { mountTool, clickText } from './helpers/tool-harness.js'
import { parseCookieHeader, parseCookies, parseSetCookie } from '../src/tools/network/cookie-viewer.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('cookie parser edge cases', () => {
  it('ignores unknown attributes and parses flag attributes', () => {
    const [cookie] = parseSetCookie('Set-Cookie: sid=1; Secure; HttpOnly; Partitioned; Priority=High; Unknown=x')
    expect(cookie.name).toBe('sid')
    expect(cookie.attributes).toMatchObject({ secure: true, httponly: true, partitioned: true, priority: 'High' })
    expect(cookie.attributes.unknown).toBeUndefined()
  })

  it('splits multiple cookies separated by commas after Expires', () => {
    const cookies = parseSetCookie('a=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/, b=2; HttpOnly')
    expect(cookies.map(item => item.name)).toEqual(['a', 'b'])
    expect(cookies[0].attributes.expires).toContain('2026')
    expect(cookies[1].attributes.httponly).toBe(true)
  })

  it('handles pairs without = and empty input', () => {
    expect(parseCookieHeader('flag; empty=')).toEqual([
      { name: 'flag', value: '', attributes: {} },
      { name: 'empty', value: '', attributes: {} }
    ])
    expect(parseCookies('   ')).toEqual({ kind: 'empty', cookies: [] })
    expect(parseCookies('Set-Cookie: a=1; Path=/').kind).toBe('set-cookie')
  })

  it('shows an error for input without any cookie', async () => {
    const container = await mountTool('cookie-viewer')
    container.querySelector('textarea').value = ';;;'
    clickText(container, '解析 Cookie')
    expect(container.querySelector('.error-text').textContent).toContain('没有解析到 Cookie')
    clickText(container, '清空')
    expect(container.querySelector('textarea').value).toBe('')
  })
})
