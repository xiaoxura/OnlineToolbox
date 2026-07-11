import { createElement, createSection } from '../../utils/dom.js'

const REQUEST_TIMEOUT = 8000

async function fetchJson(url, externalSignal) {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT)
  const abort = () => controller.abort()
  externalSignal?.addEventListener('abort', abort, { once: true })

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (timedOut) throw new Error(`请求超时（${REQUEST_TIMEOUT / 1000} 秒）`)
    if (externalSignal?.aborted) throw new DOMException('请求已取消', 'AbortError')
    throw error
  } finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abort)
  }
}

async function requestWithFallback(providers, signal) {
  const errors = []
  for (const provider of providers) {
    if (signal.aborted) throw new DOMException('请求已取消', 'AbortError')
    try {
      const data = await fetchJson(provider.url, signal)
      return { data, provider: provider.name }
    } catch (error) {
      if (error.name === 'AbortError') throw error
      errors.push(`${provider.name}: ${error.message}`)
    }
  }
  throw new Error(`所有查询服务均不可用（${errors.join('；')}）`)
}

export default {
  id: 'ip-info',
  name: 'IP 地址信息',
  description: '查询本机 IP 或指定 IP 地址的地理位置和网络信息',
  category: 'network',
  icon: 'unicode',
  render(container) {
    let selfController = null
    let lookupController = null

    const privacyNotice = createElement('div', { className: 'privacy-notice', role: 'note' }, [
      createElement('strong', { textContent: '隐私提示：' }),
      '只有点击获取或查询按钮后，浏览器才会向第三方 IP 服务发送请求。查询指定 IP 时，该地址会发送给 ipapi.co，失败时改用 ipwho.is。'
    ])
    container.appendChild(privacyNotice)

    const selfIpValue = createElement('span', { className: 'stat-value', textContent: '--' })
    const selfProvider = createElement('span', { className: 'stat-label', textContent: '' })
    const selfIpRow = createElement('div', { className: 'stats-row' }, [
      createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: '本机公网 IP' }),
        selfIpValue,
        selfProvider
      ])
    ])
    const selfErrorEl = createElement('div', { className: 'error-text' })

    const lookupInput = createElement('input', {
      className: 'input',
      type: 'text',
      inputmode: 'text',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: '输入 IPv4 或 IPv6 地址，如 8.8.8.8'
    })

    const selfIpBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '获取本机 IP',
      onClick: async () => {
        selfController?.abort()
        selfController = new AbortController()
        selfIpBtn.disabled = true
        selfIpBtn.textContent = '获取中…'
        selfErrorEl.textContent = ''
        selfProvider.textContent = ''
        try {
          const { data, provider } = await requestWithFallback([
            { name: 'ipify', url: 'https://api64.ipify.org?format=json' },
            { name: 'ipify IPv4', url: 'https://api.ipify.org?format=json' }
          ], selfController.signal)
          const ip = data.ip
          if (!ip) throw new Error('服务未返回 IP 地址')
          selfIpValue.textContent = ip
          selfProvider.textContent = `数据来源：${provider}`
          lookupInput.value = ip
        } catch (error) {
          if (error.name !== 'AbortError') selfErrorEl.textContent = `获取失败：${error.message}`
          selfIpValue.textContent = '--'
        } finally {
          selfIpBtn.disabled = false
          selfIpBtn.textContent = '获取本机 IP'
        }
      }
    })

    const selfSection = createSection('本机 IP', createElement('div', {}, [selfIpRow, selfErrorEl]), [selfIpBtn])

    const lookupErrorEl = createElement('div', { className: 'error-text' })
    const lookupLoadingEl = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const fields = ['ip', 'country', 'region', 'city', 'org', 'latitude', 'longitude', 'source']
    const fieldLabels = {
      ip: 'IP 地址', country: '国家', region: '地区', city: '城市', org: 'ISP / 组织',
      latitude: '纬度', longitude: '经度', source: '数据来源'
    }
    const fieldEls = {}
    const statsItems = fields.map(key => {
      const value = createElement('span', { className: 'stat-value', textContent: '--' })
      fieldEls[key] = value
      return createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: fieldLabels[key] }),
        value
      ])
    })
    const resultBox = createElement('div', { className: 'result-box' }, [
      createElement('div', { className: 'stats-row' }, statsItems)
    ])

    function normalizeIpApi(data, provider) {
      if (provider === 'ipwho.is') {
        if (data.success === false) throw new Error(data.message || '查询失败')
        return {
          ip: data.ip, country: data.country, region: data.region, city: data.city,
          org: data.connection?.org || data.connection?.isp,
          latitude: data.latitude, longitude: data.longitude
        }
      }
      if (data.error) throw new Error(data.reason || '查询失败')
      return {
        ip: data.ip, country: data.country_name, region: data.region, city: data.city,
        org: data.org, latitude: data.latitude, longitude: data.longitude
      }
    }

    async function lookupIp() {
      const ip = lookupInput.value.trim()
      if (!ip) {
        lookupInput.setAttribute('aria-invalid', 'true')
        lookupErrorEl.textContent = '请输入 IP 地址'
        lookupInput.focus()
        return
      }

      lookupController?.abort()
      lookupController = new AbortController()
      lookupInput.removeAttribute('aria-invalid')
      lookupErrorEl.textContent = ''
      lookupLoadingEl.textContent = '查询中…'
      lookupBtn.disabled = true
      resultBox.classList.add('loading')
      fields.forEach(key => { fieldEls[key].textContent = '--' })

      try {
        const encodedIp = encodeURIComponent(ip)
        const { data, provider } = await requestWithFallback([
          { name: 'ipapi.co', url: `https://ipapi.co/${encodedIp}/json/` },
          { name: 'ipwho.is', url: `https://ipwho.is/${encodedIp}` }
        ], lookupController.signal)
        const normalized = normalizeIpApi(data, provider)
        for (const key of fields.filter(key => key !== 'source')) {
          fieldEls[key].textContent = normalized[key] ?? '--'
        }
        fieldEls.source.textContent = provider
      } catch (error) {
        if (error.name !== 'AbortError') lookupErrorEl.textContent = `查询失败：${error.message}`
      } finally {
        lookupLoadingEl.textContent = ''
        lookupBtn.disabled = false
        resultBox.classList.remove('loading')
      }
    }

    const lookupBtn = createElement('button', { className: 'btn btn-primary', textContent: '查询', onClick: lookupIp })
    lookupInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') lookupIp()
    })

    const inputGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'label', textContent: 'IP 地址' }),
      lookupInput
    ])
    const lookupContent = createElement('div', {}, [inputGroup, lookupErrorEl, lookupLoadingEl, resultBox])
    container.appendChild(selfSection)
    container.appendChild(createSection('IP 查询', lookupContent, [lookupBtn]))
  }
}
