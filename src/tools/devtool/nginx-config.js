import { createElement, createCopyButton, createSection } from '../../utils/dom.js'

const DEFAULTS = {
  serverName: 'example.com',
  listen: '80',
  root: '/var/www/html',
  indexFile: 'index.html',
  proxyTarget: 'http://127.0.0.1:3000',
  enableProxy: true,
  enableGzip: true,
  enableHttps: false,
  certPath: '/etc/nginx/ssl/example.com.crt',
  keyPath: '/etc/nginx/ssl/example.com.key',
  spaFallback: true,
  clientMaxBodySize: '10m',
  proxyWebSocket: false
}

function text(value) {
  return String(value ?? '').trim()
}

function validateBodySize(value) {
  if (!/^\d+[kKmMgG]?$/.test(value)) {
    throw new Error('请求体上限格式无效，请使用 10m、1g 或字节数')
  }
  return value
}

export function buildNginxConfig(options = {}) {
  const serverName = text(options.serverName)
  if (!serverName) throw new Error('请输入站点域名（server_name）')

  const enableHttps = Boolean(options.enableHttps)
  const listen = text(options.listen ?? (enableHttps ? 443 : 80))
  if (listen !== '80' && listen !== '443') throw new Error('监听端口只能是 80 或 443')
  if (enableHttps && listen !== '443') throw new Error('启用 HTTPS 时监听端口应为 443')

  const root = text(options.root) || '/var/www/html'
  const indexFile = text(options.indexFile) || 'index.html'
  const clientMaxBodySize = validateBodySize(text(options.clientMaxBodySize) || '10m')

  const enableProxy = Boolean(options.enableProxy)
  let proxyTarget = text(options.proxyTarget)
  if (enableProxy) {
    if (!proxyTarget) throw new Error('启用反向代理时必须填写代理目标')
    if (!/^https?:\/\//i.test(proxyTarget)) proxyTarget = `http://${proxyTarget}`
  }

  const certPath = text(options.certPath)
  const keyPath = text(options.keyPath)
  if (enableHttps && !certPath) throw new Error('启用 HTTPS 时必须填写证书路径')
  if (enableHttps && !keyPath) throw new Error('启用 HTTPS 时必须填写私钥路径')

  const lines = [
    'server {',
    `    listen ${listen}${enableHttps ? ' ssl' : ''};`,
    `    listen [::]:${listen}${enableHttps ? ' ssl' : ''};`,
    `    server_name ${serverName};`,
    '',
    `    root ${root};`,
    `    index ${indexFile};`,
    '',
    `    client_max_body_size ${clientMaxBodySize};`
  ]

  if (enableHttps) {
    lines.push(
      '',
      `    ssl_certificate ${certPath};`,
      `    ssl_certificate_key ${keyPath};`,
      '    ssl_protocols TLSv1.2 TLSv1.3;',
      '    ssl_ciphers HIGH:!aNULL:!MD5;',
      '    ssl_session_cache shared:SSL:10m;',
      '    ssl_session_timeout 10m;'
    )
  }

  if (options.enableGzip) {
    lines.push(
      '',
      '    gzip on;',
      '    gzip_vary on;',
      '    gzip_min_length 1024;',
      '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss image/svg+xml;'
    )
  }

  lines.push(
    '',
    '    location / {',
    options.spaFallback ? '        try_files $uri $uri/ /index.html;' : '        try_files $uri $uri/ =404;',
    '    }'
  )

  if (enableProxy) {
    lines.push(
      '',
      '    location /api/ {',
      `        proxy_pass ${proxyTarget};`,
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;'
    )
    if (options.proxyWebSocket) {
      lines.push(
        '        proxy_set_header Upgrade $http_upgrade;',
        '        proxy_set_header Connection "upgrade";',
        '        proxy_read_timeout 3600s;'
      )
    }
    lines.push('    }')
  }

  lines.push('}')
  return `${lines.join('\n')}\n`
}

export default {
  render(container) {
    const serverNameInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: DEFAULTS.serverName,
      placeholder: 'example.com',
      'aria-label': '站点域名'
    })
    const listenSelect = createElement(
      'select',
      {
        className: 'select',
        'aria-label': '监听端口'
      },
      [
        createElement('option', { value: '80', textContent: '80（HTTP）' }),
        createElement('option', { value: '443', textContent: '443（HTTPS）' })
      ]
    )
    const rootInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: DEFAULTS.root,
      placeholder: '/var/www/html',
      'aria-label': '静态根目录'
    })
    const indexInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: DEFAULTS.indexFile,
      placeholder: 'index.html',
      'aria-label': '默认首页文件'
    })
    const proxyTargetInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: DEFAULTS.proxyTarget,
      placeholder: 'http://127.0.0.1:3000',
      'aria-label': '反向代理目标'
    })
    const bodySizeInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: DEFAULTS.clientMaxBodySize,
      placeholder: '10m',
      'aria-label': '请求体上限'
    })
    const certPathInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: DEFAULTS.certPath,
      placeholder: '/etc/nginx/ssl/example.com.crt',
      'aria-label': 'HTTPS 证书路径'
    })
    const keyPathInput = createElement('input', {
      className: 'input',
      type: 'text',
      value: DEFAULTS.keyPath,
      placeholder: '/etc/nginx/ssl/example.com.key',
      'aria-label': 'HTTPS 私钥路径'
    })

    function checkbox(label, checked, ariaLabel) {
      const input = createElement('input', { type: 'checkbox', checked, 'aria-label': ariaLabel })
      const wrapper = createElement('label', { className: 'checkbox-label' }, [input, createElement('span', { textContent: label })])
      return { input, wrapper }
    }

    const proxyCheck = checkbox('启用反向代理', DEFAULTS.enableProxy, '启用反向代理')
    const gzipCheck = checkbox('启用 gzip 压缩', DEFAULTS.enableGzip, '启用 gzip 压缩')
    const httpsCheck = checkbox('启用 HTTPS', DEFAULTS.enableHttps, '启用 HTTPS')
    const spaCheck = checkbox('SPA 回退到 index.html', DEFAULTS.spaFallback, '启用 SPA 回退')
    const webSocketCheck = checkbox('代理 WebSocket', DEFAULTS.proxyWebSocket, '启用 WebSocket 代理')

    const certFields = createElement('div', { className: 'form-row', hidden: true }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '证书路径' }),
        certPathInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '私钥路径' }),
        keyPathInput
      ])
    ])

    const output = createElement('textarea', {
      className: 'textarea large',
      rows: 22,
      readOnly: true,
      'aria-label': '生成的 nginx 配置'
    })
    const errorEl = createElement('div', { className: 'error-text' })

    function currentOptions() {
      return {
        serverName: serverNameInput.value,
        listen: listenSelect.value,
        root: rootInput.value,
        indexFile: indexInput.value,
        proxyTarget: proxyTargetInput.value,
        enableProxy: proxyCheck.input.checked,
        enableGzip: gzipCheck.input.checked,
        enableHttps: httpsCheck.input.checked,
        certPath: certPathInput.value,
        keyPath: keyPathInput.value,
        spaFallback: spaCheck.input.checked,
        clientMaxBodySize: bodySizeInput.value,
        proxyWebSocket: webSocketCheck.input.checked
      }
    }

    function refresh() {
      try {
        output.value = buildNginxConfig(currentOptions())
        errorEl.textContent = ''
      } catch (cause) {
        output.value = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const controls = [
      serverNameInput,
      listenSelect,
      rootInput,
      indexInput,
      proxyTargetInput,
      bodySizeInput,
      certPathInput,
      keyPathInput,
      proxyCheck.input,
      gzipCheck.input,
      httpsCheck.input,
      spaCheck.input,
      webSocketCheck.input
    ]
    for (const control of controls) {
      control.addEventListener('input', refresh)
      control.addEventListener('change', refresh)
    }

    httpsCheck.input.addEventListener('change', () => {
      certFields.hidden = !httpsCheck.input.checked
      if (httpsCheck.input.checked) listenSelect.value = '443'
      else if (listenSelect.value === '443') listenSelect.value = '80'
      refresh()
    })

    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例配置',
      onClick: () => {
        serverNameInput.value = DEFAULTS.serverName
        listenSelect.value = DEFAULTS.listen
        rootInput.value = DEFAULTS.root
        indexInput.value = DEFAULTS.indexFile
        proxyTargetInput.value = DEFAULTS.proxyTarget
        bodySizeInput.value = DEFAULTS.clientMaxBodySize
        certPathInput.value = DEFAULTS.certPath
        keyPathInput.value = DEFAULTS.keyPath
        proxyCheck.input.checked = DEFAULTS.enableProxy
        gzipCheck.input.checked = DEFAULTS.enableGzip
        httpsCheck.input.checked = DEFAULTS.enableHttps
        spaCheck.input.checked = DEFAULTS.spaFallback
        webSocketCheck.input.checked = DEFAULTS.proxyWebSocket
        certFields.hidden = !DEFAULTS.enableHttps
        refresh()
      }
    })

    const copyButton = createCopyButton(() => output.value)

    listenSelect.value = DEFAULTS.listen

    container.append(
      createSection(
        '站点与代理设置',
        createElement('div', {}, [
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', textContent: '站点域名' }),
              serverNameInput
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', textContent: '监听端口' }),
              listenSelect
            ])
          ]),
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', textContent: '静态根目录' }),
              rootInput
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', textContent: '默认首页' }),
              indexInput
            ])
          ]),
          createElement('div', { className: 'form-row' }, [
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', textContent: '反向代理目标' }),
              proxyTargetInput
            ]),
            createElement('div', { className: 'form-group' }, [
              createElement('label', { className: 'label', textContent: '请求体上限' }),
              bodySizeInput
            ])
          ]),
          certFields,
          createElement('div', { className: 'form-row' }, [
            proxyCheck.wrapper,
            gzipCheck.wrapper,
            httpsCheck.wrapper,
            spaCheck.wrapper,
            webSocketCheck.wrapper
          ])
        ])
      ),
      createElement('div', { className: 'btn-group form-action-row' }, [sampleButton]),
      errorEl,
      createSection('生成的配置', output, [copyButton])
    )

    refresh()
  }
}
