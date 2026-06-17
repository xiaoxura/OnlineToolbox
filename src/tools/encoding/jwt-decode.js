import { createElement, createCopyButton } from '../../utils/dom.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default {
  id: 'jwt',
  name: 'JWT 解析',
  description: '解析 JWT Token，显示 Header、Payload 和 Signature',
  category: 'encoding',
  icon: 'jwt',
  render(container) {
    function base64UrlDecode(str) {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
      const pad = base64.length % 4
      if (pad) base64 += '='.repeat(4 - pad)
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return new TextDecoder('utf-8').decode(bytes)
    }

    function formatJson(obj) {
      return JSON.stringify(obj, null, 2)
    }

    function formatTimestamp(ts) {
      const date = new Date(ts * 1000)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    }

    const inputLabel = createElement('label', { className: 'label' }, ['输入 JWT Token'])
    const inputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '请粘贴 JWT Token（如 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.xxx）...',
      rows: 4
    })

    const headerLabel = createElement('label', { className: 'label' }, ['Header'])
    const headerOutput = createElement('pre', { className: 'code-block' }, ['等待输入...'])
    const headerCopyBtn = createCopyButton(() => headerOutput.textContent === '等待输入...' ? '' : headerOutput.textContent)

    const payloadLabel = createElement('label', { className: 'label' }, ['Payload'])
    const payloadOutput = createElement('pre', { className: 'code-block' }, ['等待输入...'])
    const payloadCopyBtn = createCopyButton(() => payloadOutput.textContent === '等待输入...' ? '' : payloadOutput.textContent)

    const signatureLabel = createElement('label', { className: 'label' }, ['Signature'])
    const signatureOutput = createElement('pre', { className: 'code-block' }, ['等待输入...'])

    const expiryInfo = createElement('div', { className: 'expiry-info' })

    function decode() {
      const token = inputTextarea.value.trim()
      if (!token) {
        headerOutput.textContent = '等待输入...'
        payloadOutput.textContent = '等待输入...'
        signatureOutput.textContent = '等待输入...'
        expiryInfo.style.display = 'none'
        return
      }

      const parts = token.split('.')
      if (parts.length < 2 || parts.length > 3) {
        headerOutput.textContent = '错误: 无效的 JWT 格式（需要 2 或 3 个部分）'
        payloadOutput.textContent = ''
        signatureOutput.textContent = ''
        expiryInfo.style.display = 'none'
        return
      }

      try {
        const headerJson = JSON.parse(base64UrlDecode(parts[0]))
        headerOutput.textContent = formatJson(headerJson)
      } catch (e) {
        headerOutput.textContent = '解析错误: ' + e.message
      }

      try {
        const payloadJson = JSON.parse(base64UrlDecode(parts[1]))
        payloadOutput.textContent = formatJson(payloadJson)

        // Check for exp claim
        if (payloadJson.exp) {
          const expDate = new Date(payloadJson.exp * 1000)
          const now = new Date()
          const isExpired = expDate < now
          expiryInfo.style.display = 'block'
          expiryInfo.className = 'expiry-info ' + (isExpired ? 'expired' : 'valid')
          expiryInfo.textContent = `过期时间: ${formatTimestamp(payloadJson.exp)} ${isExpired ? '(已过期)' : '(未过期)'}`
        } else {
          expiryInfo.style.display = 'none'
        }
      } catch (e) {
        payloadOutput.textContent = '解析错误: ' + e.message
        expiryInfo.style.display = 'none'
      }

      if (parts[2]) {
        signatureOutput.textContent = parts[2]
      } else {
        signatureOutput.textContent = '(无签名)'
      }
    }

    inputTextarea.addEventListener('input', decode)

    const decodeBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: decode
    }, ['解析'])

    const headerSection = createElement('div', { className: 'result-box' }, [
      headerLabel,
      headerOutput,
      headerCopyBtn
    ])

    const payloadSection = createElement('div', { className: 'result-box' }, [
      payloadLabel,
      payloadOutput,
      expiryInfo,
      payloadCopyBtn
    ])

    const signatureSection = createElement('div', { className: 'result-box' }, [
      signatureLabel,
      signatureOutput
    ])

    const inputGroup = createElement('div', { className: 'form-group' }, [inputLabel, inputTextarea])
    const btnGroup = createElement('div', { className: 'btn-group' }, [decodeBtn])

    container.appendChild(inputGroup)
    container.appendChild(btnGroup)
    container.appendChild(headerSection)
    container.appendChild(payloadSection)
    container.appendChild(signatureSection)
  }
}
