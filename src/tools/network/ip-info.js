import { createElement, createSection } from '../../utils/dom.js'

export default {
  id: 'ip-info',
  name: 'IP 地址信息',
  description: '查询本机 IP 或指定 IP 地址的地理位置和网络信息',
  category: 'network',
  icon: 'unicode',
  render(container) {
    // --- Self IP section ---
    const selfIpValue = createElement('span', { className: 'stat-value', textContent: '--' })
    const selfIpRow = createElement('div', { className: 'stats-row' }, [
      createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: '本机 IP' }),
        selfIpValue
      ])
    ])

    const selfIpBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '获取本机 IP',
      onClick: async () => {
        selfIpBtn.disabled = true
        selfIpBtn.textContent = '获取中...'
        selfErrorEl.textContent = ''
        try {
          const resp = await fetch('https://api.ipify.org?format=json')
          if (!resp.ok) throw new Error('请求失败')
          const data = await resp.json()
          selfIpValue.textContent = data.ip
          // Auto-fill the lookup input
          lookupInput.value = data.ip
        } catch (e) {
          selfErrorEl.textContent = '获取本机 IP 失败: ' + e.message
          selfIpValue.textContent = '--'
        } finally {
          selfIpBtn.disabled = false
          selfIpBtn.textContent = '获取本机 IP'
        }
      }
    })

    const selfErrorEl = createElement('div', { className: 'error-text' })

    const selfContent = createElement('div', {}, [selfIpRow, selfErrorEl])
    const selfSection = createSection('本机 IP', selfContent, [selfIpBtn])

    // --- Lookup section ---
    const lookupInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '输入 IP 地址，如 8.8.8.8'
    })

    const lookupErrorEl = createElement('div', { className: 'error-text' })
    const lookupLoadingEl = createElement('div', { className: 'error-text' })

    // Result fields
    const fields = ['ip', 'country', 'region', 'city', 'org', 'latitude', 'longitude']
    const fieldLabels = {
      ip: 'IP 地址',
      country: '国家',
      region: '地区',
      city: '城市',
      org: 'ISP / 组织',
      latitude: '纬度',
      longitude: '经度'
    }

    const fieldEls = {}
    const statsItems = fields.map(key => {
      const valueEl = createElement('span', { className: 'stat-value', textContent: '--' })
      fieldEls[key] = valueEl
      return createElement('div', { className: 'stat-item' }, [
        createElement('span', { className: 'stat-label', textContent: fieldLabels[key] }),
        valueEl
      ])
    })

    const resultRow = createElement('div', { className: 'stats-row' }, statsItems)
    const resultBox = createElement('div', { className: 'result-box' }, [resultRow])

    async function lookupIp() {
      const ip = lookupInput.value.trim()
      if (!ip) {
        lookupErrorEl.textContent = '请输入 IP 地址'
        return
      }
      lookupErrorEl.textContent = ''
      lookupLoadingEl.textContent = '查询中...'
      resultBox.classList.add('loading')

      // Clear previous results
      fields.forEach(key => { fieldEls[key].textContent = '--' })

      try {
        const resp = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`)
        if (!resp.ok) throw new Error('请求失败')
        const data = await resp.json()
        if (data.error) {
          throw new Error(data.reason || '查询失败')
        }
        fieldEls.ip.textContent = data.ip || '--'
        fieldEls.country.textContent = data.country_name || '--'
        fieldEls.region.textContent = data.region || '--'
        fieldEls.city.textContent = data.city || '--'
        fieldEls.org.textContent = data.org || '--'
        fieldEls.latitude.textContent = data.latitude || '--'
        fieldEls.longitude.textContent = data.longitude || '--'
      } catch (e) {
        lookupErrorEl.textContent = '查询失败: ' + e.message
      } finally {
        lookupLoadingEl.textContent = ''
        resultBox.classList.remove('loading')
      }
    }

    const lookupBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '查询',
      onClick: lookupIp
    })

    lookupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') lookupIp()
    })

    const inputRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: 'IP 地址' }),
        lookupInput
      ])
    ])

    const lookupContent = createElement('div', {}, [
      inputRow,
      lookupErrorEl,
      lookupLoadingEl,
      resultBox
    ])
    const lookupSection = createSection('IP 查询', lookupContent, [lookupBtn])

    container.appendChild(selfSection)
    container.appendChild(lookupSection)
  }
}
