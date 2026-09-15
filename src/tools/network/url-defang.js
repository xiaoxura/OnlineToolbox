import { createElement, createSegmentedGroup } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// Defanging rewrites a URL/IP/email so it cannot be clicked or auto-linked when
// pasted into a chat, ticket or report, while staying readable for a human.

const DEFANG_SCHEMES = [
  [/^https(?=[^a-z]|$)/i, 'hxxps'],
  [/^http(?=[^a-z]|$)/i, 'hxxp'],
  [/^ftp(?=[^a-z]|$)/i, 'fxp']
]

export function defang(text) {
  let out = text
  // Bracket the scheme separator and the dots before touching anything else.
  out = out.replace(/([a-z][a-z0-9+.-]*):\/\//gi, (match, scheme) => {
    let safe = scheme
    for (const [pattern, replacement] of DEFANG_SCHEMES) {
      if (pattern.test(scheme)) {
        safe = scheme.replace(pattern, replacement)
        break
      }
    }
    return `${safe}[://]`
  })
  out = out.replace(/\./g, '[.]')
  out = out.replace(/@/g, '[@]')
  return out
}

export function refang(text) {
  let out = text
  out = out.replace(/\[:\/\/\]|\(:\/\/\)|\{:\/\/\}/g, '://')
  out = out.replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]/gi, '.')
  out = out.replace(/\[@\]|\(@\)|\{@\}|\[at\]/gi, '@')
  out = out.replace(/hxxps(?=[^a-z]|$)/gi, match => matchCase(match, 'https'))
  out = out.replace(/hxxp(?=[^a-z]|$)/gi, match => matchCase(match, 'http'))
  out = out.replace(/fxp(?=[^a-z]|$)/gi, match => matchCase(match, 'ftp'))
  return out
}

function matchCase(source, target) {
  if (source === source.toUpperCase()) return target.toUpperCase()
  if (source[0] === source[0].toUpperCase()) return target[0].toUpperCase() + target.slice(1)
  return target
}

const SAMPLE_URL = 'https://example.com/login?user=admin@example.com&next=http://evil.test'
const SAMPLE_DEFANGED = 'hxxps[://]example[.]com/login?user=admin[@]example[.]com&next=hxxp[://]evil[.]test'

export default {
  id: 'url-defang',
  name: 'URL 去毒化',
  description: '将链接、域名、IP 与邮箱转换为不可点击的安全形式（defang/refang）',
  category: 'network',
  icon: 'shield-link',
  keywords: ['defang', 'refang', '去毒', '安全分享', 'ioc', '威胁情报'],
  render(container) {
    let state
    const mode = createSegmentedGroup([
      { value: 'defang', label: '去毒化' },
      { value: 'refang', label: '还原' }
    ], () => state.run())

    const isDefang = () => mode.getValue() === 'defang'

    state = renderTextTransform(container, {
      inputTitle: '原始内容',
      outputTitle: '处理结果',
      inputPlaceholder: '粘贴包含链接、域名、IP 或邮箱的文本…',
      outputPlaceholder: '处理结果将显示在此…',
      actionLabel: '转换',
      sample: () => (isDefang() ? SAMPLE_URL : SAMPLE_DEFANGED),
      options: [
        createElement('div', { className: 'form-row' }, [
          createElement('div', { className: 'form-group' }, [
            createElement('div', { className: 'label', textContent: '转换方向' }),
            mode
          ])
        ])
      ],
      transform: text => (isDefang() ? defang(text) : refang(text))
    })
  }
}
