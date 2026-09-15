import '../../styles/tools/qr.css'
import { createElement, createSection } from '../../utils/dom.js'
import QRCode from 'qrcode'

// The WIFI: URI scheme understood by Android / iOS camera apps:
//   WIFI:T:<WPA|WEP|nopass>;S:<ssid>;P:<password>;H:<true>;;
// Backslash, semicolon, comma, colon and double quote must be escaped inside a
// value, otherwise the scanner splits the field in the wrong place.

const ESCAPE_PATTERN = /([\\;,:"])/g

export const ENCRYPTION_TYPES = [
  { id: 'WPA', name: 'WPA/WPA2' },
  { id: 'WEP', name: 'WEP' },
  { id: 'nopass', name: '无加密' }
]

export function escapeWifiValue(value) {
  return String(value ?? '').replace(ESCAPE_PATTERN, '\\$1')
}

export function buildWifiPayload({ ssid = '', encryption = 'WPA', password = '', hidden = false } = {}) {
  const type = encryption === 'nopass' ? 'nopass' : encryption
  let payload = `WIFI:T:${type};S:${escapeWifiValue(ssid)};`
  if (type !== 'nopass') payload += `P:${escapeWifiValue(password)};`
  if (hidden) payload += 'H:true;'
  return payload + ';'
}

const SAMPLE = { ssid: 'Toolbox-5G', password: 'P@ss;word,1' }

export default {
  id: 'wifi-qr',
  name: 'WiFi 二维码',
  description: '生成包含 SSID 与密码的 WiFi 二维码，扫码即可连接',
  category: 'generator',
  icon: 'qrcode',
  keywords: ['wifi', '无线网络', '二维码', 'ssid', 'qrcode'],
  render(container) {
    const ssidInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '例如：MyHome-5G',
      'aria-label': '网络名称 SSID'
    })

    const encryptionSelect = createElement('select', { className: 'select', 'aria-label': '加密方式' },
      ENCRYPTION_TYPES.map(item => createElement('option', { value: item.id, textContent: item.name })))

    const passwordInput = createElement('input', {
      className: 'input',
      type: 'password',
      placeholder: 'WiFi 密码',
      'aria-label': 'WiFi 密码'
    })

    const showPasswordCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    const showPasswordOption = createElement('label', { className: 'option-item' }, [
      showPasswordCheckbox,
      createElement('span', { textContent: '显示密码' })
    ])

    const hiddenCheckbox = createElement('input', { className: 'checkbox', type: 'checkbox' })
    const hiddenOption = createElement('label', { className: 'option-item' }, [
      hiddenCheckbox,
      createElement('span', { textContent: '隐藏网络' })
    ])

    const passwordGroup = createElement('div', { className: 'form-group' }, [
      createElement('div', { className: 'label', textContent: 'WiFi 密码' }),
      passwordInput
    ])

    const payloadOutput = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      readOnly: true,
      'aria-label': 'WiFi 二维码内容',
      placeholder: '二维码内容将显示在此…'
    })

    const errorEl = createElement('div', { className: 'error-text' })
    const canvas = createElement('canvas', { className: 'qrcode-canvas' })
    const statusText = createElement('div', { className: 'qr-status-text' })
    const canvasWrap = createElement('div', { className: 'qr-canvas-wrap' }, [canvas, statusText])

    const currentEncryption = () => encryptionSelect.value
    const isOpenNetwork = () => currentEncryption() === 'nopass'

    function syncPasswordVisibility() {
      passwordGroup.hidden = isOpenNetwork()
      showPasswordOption.hidden = isOpenNetwork()
    }

    function currentPayload() {
      return buildWifiPayload({
        ssid: ssidInput.value,
        encryption: currentEncryption(),
        password: passwordInput.value,
        hidden: hiddenCheckbox.checked
      })
    }

    function validate() {
      if (!ssidInput.value) return '请输入 WiFi 名称（SSID）'
      if (!isOpenNetwork() && !passwordInput.value) return '请输入 WiFi 密码，或将加密方式改为「无加密」'
      if (currentEncryption() === 'WEP' && passwordInput.value) {
        const length = passwordInput.value.length
        const hex = /^[0-9a-fA-F]+$/.test(passwordInput.value)
        const valid = hex ? length === 10 || length === 26 : length === 5 || length === 13
        if (!valid) return 'WEP 密码通常是 5/13 位字符或 10/26 位十六进制，请确认无误'
      }
      return ''
    }

    function refreshPayload() {
      payloadOutput.value = currentPayload()
    }

    async function generate() {
      errorEl.textContent = ''
      refreshPayload()
      const message = validate()
      if (message) {
        errorEl.textContent = message
        statusText.textContent = ''
        canvas.width = 0
        canvas.height = 0
        canvas.hidden = true
        return
      }
      try {
        statusText.textContent = '生成中…'
        canvas.hidden = true
        await QRCode.toCanvas(canvas, payloadOutput.value, {
          width: 320,
          errorCorrectionLevel: 'M',
          margin: 2
        })
        canvas.hidden = false
        statusText.textContent = `${ssidInput.value} · ${ENCRYPTION_TYPES.find(item => item.id === currentEncryption())?.name || ''}`
      } catch (cause) {
        canvas.hidden = true
        statusText.textContent = ''
        errorEl.textContent = `生成失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }

    function downloadPng() {
      if (!canvas.width || !canvas.height) {
        errorEl.textContent = '请先生成二维码'
        return
      }
      const link = document.createElement('a')
      link.download = 'wifi-qrcode.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    ssidInput.addEventListener('input', refreshPayload)
    passwordInput.addEventListener('input', refreshPayload)
    hiddenCheckbox.addEventListener('change', refreshPayload)
    encryptionSelect.addEventListener('change', () => { syncPasswordVisibility(); refreshPayload() })
    showPasswordCheckbox.addEventListener('change', () => {
      passwordInput.type = showPasswordCheckbox.checked ? 'text' : 'password'
    })

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '生成二维码',
      onClick: () => { generate() }
    })

    const downloadBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '下载 PNG',
      onClick: downloadPng
    })

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        ssidInput.value = SAMPLE.ssid
        passwordInput.value = SAMPLE.password
        encryptionSelect.value = 'WPA'
        hiddenCheckbox.checked = false
        syncPasswordVisibility()
        refreshPayload()
        generate()
      }
    })

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '网络名称（SSID）' }),
          ssidInput
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '加密方式' }),
          encryptionSelect
        ])
      ]),
      createElement('div', { className: 'form-row' }, [
        passwordGroup,
        createElement('div', { className: 'form-group option-control-group' }, [
          showPasswordOption,
          hiddenOption
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [generateBtn, downloadBtn, sampleBtn]),
      errorEl,
      createSection('二维码预览', canvasWrap),
      createSection('二维码内容', payloadOutput)
    )

    syncPasswordVisibility()
    refreshPayload()
    canvas.hidden = true
    statusText.textContent = '填写网络信息后点击「生成二维码」'
  }
}
