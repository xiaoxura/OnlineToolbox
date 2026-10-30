import { createElement, createCopyButton, createSection } from '../../utils/dom.js'
import '../../styles/tools/og-meta.css'

// Open Graph / Twitter Card generator. The tag builders are pure string
// functions; the preview panel is assembled exclusively through DOM APIs so
// user input never goes through innerHTML.

const META_TYPES = new Set(['website', 'article', 'product'])
const TWITTER_CARDS = new Set(['summary', 'summary_large_image'])

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function readOptions(options) {
  const source = options && typeof options === 'object' ? options : {}
  const type = source.type === undefined || source.type === '' ? 'website' : String(source.type)
  return {
    title: String(source.title ?? '').trim(),
    description: String(source.description ?? '').trim(),
    url: String(source.url ?? '').trim(),
    image: String(source.image ?? '').trim(),
    siteName: String(source.siteName ?? '').trim(),
    type,
    twitterCard: source.twitterCard === undefined || source.twitterCard === '' ? 'summary_large_image' : String(source.twitterCard),
    locale: String(source.locale ?? '').trim(),
    themeColor: String(source.themeColor ?? '').trim()
  }
}

function propertyMeta(property, content) {
  return `<meta property="${property}" content="${escapeHtml(content)}">`
}

function nameMeta(name, content) {
  return `<meta name="${name}" content="${escapeHtml(content)}">`
}

export function buildMetaTags(options = {}) {
  const data = readOptions(options)
  if (!META_TYPES.has(data.type)) {
    throw new Error(`不支持的 og:type：${data.type}（可选 website / article / product）`)
  }
  const lines = []
  if (data.title) lines.push(propertyMeta('og:title', data.title))
  if (data.description) lines.push(propertyMeta('og:description', data.description))
  lines.push(propertyMeta('og:type', data.type))
  if (data.url) lines.push(propertyMeta('og:url', data.url))
  if (data.image) lines.push(propertyMeta('og:image', data.image))
  if (data.siteName) lines.push(propertyMeta('og:site_name', data.siteName))
  if (data.locale) lines.push(propertyMeta('og:locale', data.locale))
  if (data.themeColor) lines.push(nameMeta('theme-color', data.themeColor))
  if (data.url) lines.push(`<link rel="canonical" href="${escapeHtml(data.url)}">`)
  return lines.join('\n')
}

export function buildTwitterTags(options = {}) {
  const data = readOptions(options)
  if (!TWITTER_CARDS.has(data.twitterCard)) {
    throw new Error(`不支持的 twitter:card：${data.twitterCard}（可选 summary / summary_large_image）`)
  }
  const lines = [nameMeta('twitter:card', data.twitterCard)]
  if (data.title) lines.push(nameMeta('twitter:title', data.title))
  if (data.description) lines.push(nameMeta('twitter:description', data.description))
  if (data.image) lines.push(nameMeta('twitter:image', data.image))
  return lines.join('\n')
}

const SAMPLE = {
  title: 'OnlineToolbox - 在线开发者工具箱',
  description: '180 个常用编解码、文本处理、格式化与生成器工具，全部在浏览器本地运行。',
  url: 'https://tools.xiaoxura.com/',
  image: 'https://tools.xiaoxura.com/og-cover.png',
  siteName: 'OnlineToolbox',
  type: 'website',
  twitterCard: 'summary_large_image',
  locale: 'zh_CN',
  themeColor: '#5e6ad2'
}

function field(labelText, id, control) {
  return createElement('div', { className: 'form-group' }, [
    createElement('label', { className: 'label', for: id, textContent: labelText }),
    control
  ])
}

function displayDomain(url) {
  if (!url) return 'example.com'
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./i, '') || 'example.com'
  } catch {
    return url
  }
}

function isDisplayableImage(url) {
  if (!url) return false
  if (/^(https?:)?\/\//i.test(url)) return true
  if (/^data:image\//i.test(url) || /^blob:/i.test(url)) return true
  return !/^[a-z][a-z0-9+.-]*:/i.test(url)
}

export default {
  render(container) {
    const titleInput = createElement('input', {
      className: 'input',
      id: 'og-title',
      type: 'text',
      placeholder: '页面标题（必填）',
      'aria-label': '页面标题'
    })
    const descriptionInput = createElement('textarea', {
      className: 'textarea',
      id: 'og-description',
      rows: 3,
      placeholder: '页面描述，建议 120 字以内',
      'aria-label': '页面描述'
    })
    const urlInput = createElement('input', {
      className: 'input',
      id: 'og-url',
      type: 'url',
      placeholder: 'https://example.com/page',
      'aria-label': '页面 URL'
    })
    const imageInput = createElement('input', {
      className: 'input',
      id: 'og-image',
      type: 'url',
      placeholder: 'https://example.com/cover.png',
      'aria-label': '分享图片 URL'
    })
    const siteNameInput = createElement('input', {
      className: 'input',
      id: 'og-site-name',
      type: 'text',
      placeholder: '网站名称',
      'aria-label': '网站名称'
    })
    const typeSelect = createElement('select', { className: 'select', id: 'og-type', 'aria-label': '页面类型' }, [
      createElement('option', { value: 'website', textContent: 'website（网站）' }),
      createElement('option', { value: 'article', textContent: 'article（文章）' }),
      createElement('option', { value: 'product', textContent: 'product（产品）' })
    ])
    const twitterSelect = createElement('select', { className: 'select', id: 'og-twitter-card', 'aria-label': 'Twitter 卡片类型' }, [
      createElement('option', { value: 'summary_large_image', textContent: 'summary_large_image（大图）' }),
      createElement('option', { value: 'summary', textContent: 'summary（小图）' })
    ])
    const localeInput = createElement('input', {
      className: 'input',
      id: 'og-locale',
      type: 'text',
      placeholder: 'zh_CN',
      'aria-label': '语言地区'
    })
    const themeColorInput = createElement('input', {
      className: 'input',
      id: 'og-theme-color',
      type: 'text',
      placeholder: '#5e6ad2',
      'aria-label': '主题颜色'
    })

    const output = createElement('textarea', {
      className: 'textarea',
      id: 'og-output',
      rows: 14,
      readOnly: true,
      placeholder: 'Meta 标签将实时显示在此…',
      'aria-label': '生成的 Meta 标签'
    })
    const copyBtn = createCopyButton(() => output.value)
    const errorEl = createElement('div', { className: 'error-text' })

    const card = createElement('div', { className: 'og-card', 'aria-label': '社交卡片预览' })
    const imageWrap = createElement('div', { className: 'og-card-media' })
    const previewImage = createElement('img', { className: 'og-card-image', alt: '社交卡片预览图' })
    const imagePlaceholder = createElement('div', {
      className: 'og-card-placeholder',
      'aria-hidden': 'true',
      textContent: '🖼'
    })
    imageWrap.append(previewImage, imagePlaceholder)
    const cardBody = createElement('div', { className: 'og-card-body' })
    const siteLine = createElement('div', { className: 'og-card-site' })
    const cardTitle = createElement('div', { className: 'og-card-title' })
    const cardDescription = createElement('div', { className: 'og-card-description' })
    cardBody.append(siteLine, cardTitle, cardDescription)
    card.append(imageWrap, cardBody)

    const readForm = () => ({
      title: titleInput.value,
      description: descriptionInput.value,
      url: urlInput.value,
      image: imageInput.value,
      siteName: siteNameInput.value,
      type: typeSelect.value,
      twitterCard: twitterSelect.value,
      locale: localeInput.value,
      themeColor: themeColorInput.value
    })

    const updatePreview = data => {
      const hasTitle = Boolean(data.title.trim())
      cardTitle.textContent = hasTitle ? data.title : '标题将显示在这里'
      cardTitle.classList.toggle('og-placeholder', !hasTitle)
      cardDescription.textContent = data.description.trim() || '描述将显示在这里，建议控制在 120 字以内。'
      cardDescription.classList.toggle('og-placeholder', !data.description.trim())
      siteLine.textContent = `${data.siteName.trim() || '站点名称'} · ${displayDomain(data.url.trim())}`
      const showImage = isDisplayableImage(data.image.trim())
      previewImage.hidden = !showImage
      imagePlaceholder.hidden = showImage
      if (showImage) previewImage.src = data.image.trim()
      else previewImage.removeAttribute('src')
      previewImage.alt = hasTitle ? `${data.title} 预览图` : '社交卡片预览图'
    }

    const update = () => {
      const data = readForm()
      try {
        const code = [buildMetaTags(data), buildTwitterTags(data)].filter(Boolean).join('\n')
        output.value = code
        errorEl.textContent = ''
      } catch (cause) {
        output.value = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
      updatePreview(data)
      const disabled = !data.title.trim()
      copyBtn.disabled = disabled
      copyBtn.setAttribute('aria-disabled', String(disabled))
    }

    for (const control of [titleInput, descriptionInput, urlInput, imageInput, siteNameInput, localeInput, themeColorInput]) {
      control.addEventListener('input', update)
    }
    typeSelect.addEventListener('change', update)
    twitterSelect.addEventListener('change', update)

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        titleInput.value = SAMPLE.title
        descriptionInput.value = SAMPLE.description
        urlInput.value = SAMPLE.url
        imageInput.value = SAMPLE.image
        siteNameInput.value = SAMPLE.siteName
        typeSelect.value = SAMPLE.type
        twitterSelect.value = SAMPLE.twitterCard
        localeInput.value = SAMPLE.locale
        themeColorInput.value = SAMPLE.themeColor
        update()
      }
    })
    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        for (const control of [titleInput, descriptionInput, urlInput, imageInput, siteNameInput, localeInput, themeColorInput]) {
          control.value = ''
        }
        typeSelect.value = 'website'
        twitterSelect.value = 'summary_large_image'
        update()
      }
    })
    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '生成代码',
      onClick: update
    })

    container.append(
      createElement('div', { className: 'form-row' }, [
        field('页面标题', 'og-title', titleInput),
        field('网站名称', 'og-site-name', siteNameInput)
      ]),
      field('页面描述', 'og-description', descriptionInput),
      createElement('div', { className: 'form-row' }, [
        field('页面 URL', 'og-url', urlInput),
        field('分享图片 URL', 'og-image', imageInput)
      ]),
      createElement('div', { className: 'form-row' }, [
        field('页面类型', 'og-type', typeSelect),
        field('Twitter 卡片', 'og-twitter-card', twitterSelect),
        field('语言地区', 'og-locale', localeInput),
        field('主题颜色', 'og-theme-color', themeColorInput)
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [generateBtn, sampleBtn, clearBtn]),
      errorEl,
      createSection('社交卡片预览', card),
      createSection('生成的 Meta 标签', output, [copyBtn])
    )

    update()
  }
}
