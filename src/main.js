import './styles/base.css'
import './styles/layout.css'
import './styles/tool.css'

import { $, cleanupFormAccessibility, createElement, enhanceFormAccessibility } from './utils/dom.js'
import { initRouter, registerRoute, navigate } from './router.js'
import { categories, tools, getToolsByCategoryAndSearch, getToolById, loadToolById } from './tools/registry.js'
import icons from './icons.js'

const STORAGE = {
  favorites: 'toolbox:favorites',
  recent: 'toolbox:recent'
}
const MAX_RECENT = 6

let currentCategory = 'all'
let searchQuery = ''
let homeScrollY = 0
let renderRequestId = 0
let returnFocusToolId = null
let favorites = readStoredList(STORAGE.favorites)
let recentTools = readStoredList(STORAGE.recent)

function readStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter(id => getToolById(id)) : []
  } catch {
    return []
  }
}

function storeList(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage may be unavailable. */ }
}

function setPageMetadata(title, description) {
  document.title = title
  document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
}

function setupTheme() {
  const button = $('#themeToggle')
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const updateButton = () => {
    const isDark = document.documentElement.dataset.theme === 'dark'
    button.setAttribute('aria-label', isDark ? '切换到浅色主题' : '切换到深色主题')
    button.setAttribute('title', isDark ? '切换到浅色主题' : '切换到深色主题')
    button.setAttribute('aria-pressed', String(isDark))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0c1220' : '#4355d9')
  }

  button.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = nextTheme
    try { localStorage.setItem('theme', nextTheme) } catch { /* Storage may be unavailable. */ }
    updateButton()
  })
  media.addEventListener?.('change', event => {
    try { if (localStorage.getItem('theme')) return } catch { /* Follow system theme when storage is unavailable. */ }
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'
    updateButton()
  })
  updateButton()
}

function setupHeader() {
  const searchInput = $('#searchInput')
  searchInput.addEventListener('input', event => {
    searchQuery = event.target.value.trim()
    renderGrid()
  })

  document.addEventListener('keydown', event => {
    const target = event.target
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable
    const isSearchShortcut = event.key === '/' && !isTyping
      || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey))
    if (!isSearchShortcut) return
    event.preventDefault()
    if (window.location.hash !== '#/' && window.location.hash !== '') navigate('/')
    requestAnimationFrame(() => {
      searchInput.focus()
      searchInput.select()
    })
  })
}

function setupCategoryNav() {
  const nav = $('#categoryNav')
  const inner = createElement('div', { className: 'category-nav-inner' })
  categories.forEach(cat => {
    const count = cat.id === 'all' ? tools.length : tools.filter(tool => tool.category === cat.id).length
    const btn = createElement('button', {
      className: `category-tab${cat.id === currentCategory ? ' active' : ''}`,
      type: 'button',
      'data-category': cat.id,
      'aria-pressed': String(cat.id === currentCategory),
      onClick: () => {
        currentCategory = cat.id
        inner.querySelectorAll('.category-tab').forEach(button => {
          button.classList.toggle('active', button === btn)
          button.setAttribute('aria-pressed', String(button === btn))
        })
        btn.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        renderGrid()
      }
    }, [
      createElement('span', { textContent: cat.name }),
      createElement('span', { className: 'category-count', textContent: String(count), 'aria-hidden': 'true' })
    ])
    inner.appendChild(btn)
  })
  nav.appendChild(inner)
}

function favoriteIcon(isFavorite) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
}

function createToolCard(tool) {
  const isFavorite = favorites.includes(tool.id)
  const link = createElement('a', {
    className: 'tool-card',
    href: `#/${tool.id}`,
    'aria-label': `${tool.name}：${tool.description}`,
    onClick: () => { homeScrollY = window.scrollY }
  }, [
    createElement('div', { className: 'tool-icon-wrap' }, [
      createElement('div', { className: 'tool-icon', innerHTML: icons[tool.icon] || icons.wrench })
    ]),
    createElement('div', { className: 'tool-name', textContent: tool.name }),
    createElement('div', { className: 'tool-desc', textContent: tool.description })
  ])
  const favoriteButton = createElement('button', {
    className: `favorite-btn${isFavorite ? ' active' : ''}`,
    type: 'button',
    title: isFavorite ? '取消收藏' : '收藏工具',
    'aria-label': `${isFavorite ? '取消收藏' : '收藏'}${tool.name}`,
    'aria-pressed': String(isFavorite),
    innerHTML: favoriteIcon(isFavorite),
    onClick: () => toggleFavorite(tool.id)
  })
  return createElement('div', { className: 'tool-card-wrap' }, [link, favoriteButton])
}

function toggleFavorite(toolId) {
  favorites = favorites.includes(toolId) ? favorites.filter(id => id !== toolId) : [toolId, ...favorites]
  storeList(STORAGE.favorites, favorites)
  renderGrid()
}

function renderToolSection(title, toolIds, className = '') {
  const sectionTools = toolIds.map(getToolById).filter(Boolean)
  if (!sectionTools.length) return null
  const section = createElement('section', { className: `home-tool-section ${className}`.trim() }, [
    createElement('div', { className: 'home-section-header' }, [
      createElement('h2', { textContent: title }),
      createElement('span', { textContent: `${sectionTools.length} 个工具` })
    ])
  ])
  const grid = createElement('div', { className: 'tool-grid compact' })
  sectionTools.forEach(tool => grid.appendChild(createToolCard(tool)))
  section.appendChild(grid)
  return section
}

function renderGrid() {
  const main = $('#mainContent')
  const filtered = getToolsByCategoryAndSearch(currentCategory, searchQuery)
  cleanupFormAccessibility(main)
  main.innerHTML = ''

  if (!searchQuery && currentCategory === 'all') {
    const intro = createElement('div', { className: 'home-intro' }, [
      createElement('div', { className: 'privacy-banner', role: 'note' }, [
        createElement('span', { className: 'privacy-icon', textContent: '🔒', 'aria-hidden': 'true' }),
        createElement('div', {}, [
          createElement('strong', { textContent: '数据默认仅在当前浏览器处理' }),
          createElement('span', { textContent: '除明确标注的联网查询外，输入内容不会上传到服务器。' })
        ])
      ])
    ])
    main.appendChild(intro)
    const favoriteSection = renderToolSection('我的收藏', favorites, 'favorites-section')
    const recentSection = renderToolSection('最近使用', recentTools.filter(id => !favorites.includes(id)), 'recent-section')
    if (favoriteSection) main.appendChild(favoriteSection)
    if (recentSection) main.appendChild(recentSection)
  }

  const allSection = createElement('section', { className: 'home-tool-section all-tools-section' })
  const header = createElement('div', { className: 'home-section-header' }, [
    createElement('h2', { textContent: searchQuery ? `“${searchQuery}”的搜索结果` : currentCategory === 'all' ? '全部工具' : categories.find(cat => cat.id === currentCategory)?.name }),
    createElement('span', { textContent: `${filtered.length} 个工具`, role: 'status', 'aria-live': 'polite' })
  ])
  allSection.appendChild(header)

  if (!filtered.length) {
    const empty = createElement('div', { className: 'empty-state' }, [
      createElement('div', { className: 'empty-search-icon', textContent: '⌕', 'aria-hidden': 'true' }),
      createElement('p', { textContent: `未找到“${searchQuery}”相关工具` }),
      createElement('span', { textContent: '可以尝试 JSON、时间戳、Base64 或正则等关键词。' }),
      createElement('button', { className: 'btn btn-secondary', type: 'button', textContent: '清除搜索', onClick: clearSearch })
    ])
    allSection.appendChild(empty)
  } else {
    const grid = createElement('div', { className: 'tool-grid' })
    filtered.forEach(tool => grid.appendChild(createToolCard(tool)))
    allSection.appendChild(grid)
  }
  main.appendChild(allSection)
}

function clearSearch() {
  searchQuery = ''
  $('#searchInput').value = ''
  $('#searchInput').focus()
  renderGrid()
}

function recordRecent(toolId) {
  recentTools = [toolId, ...recentTools.filter(id => id !== toolId)].slice(0, MAX_RECENT)
  storeList(STORAGE.recent, recentTools)
}

async function renderToolPage(toolId) {
  $('.search-box').hidden = true
  const tool = getToolById(toolId)
  if (!tool) { navigate('/'); return }
  returnFocusToolId = toolId
  recordRecent(toolId)

  const main = $('#mainContent')
  const page = createElement('div', { className: 'tool-page' })
  const titleId = `tool-title-${tool.id}`
  const categoryName = categories.find(category => category.id === tool.category)?.name || '在线工具'
  const title = createElement('h1', { id: titleId, className: 'tool-title', textContent: tool.name, tabindex: '-1' })
  const header = createElement('header', { className: 'tool-header' }, [
    createElement('button', {
      className: 'back-btn',
      type: 'button',
      title: '返回工具列表',
      'aria-label': '返回工具列表',
      innerHTML: icons.back,
      onClick: () => navigate('/')
    }),
    createElement('div', { className: 'tool-header-icon', innerHTML: icons[tool.icon] || icons.wrench, 'aria-hidden': 'true' }),
    createElement('div', { className: 'tool-heading' }, [
      createElement('span', { className: 'tool-eyebrow', textContent: categoryName }),
      title,
      createElement('span', { className: 'tool-title-desc', textContent: tool.description })
    ])
  ])
  const body = createElement('div', { className: 'tool-body', role: 'region', 'aria-labelledby': titleId, 'aria-busy': 'true' })
  page.append(header, body)
  cleanupFormAccessibility(main)
  main.innerHTML = ''
  main.appendChild(page)
  setPageMetadata(`${tool.name} - 在线工具箱`, tool.description)
  window.scrollTo(0, 0)
  requestAnimationFrame(() => title.focus({ preventScroll: true }))

  const requestId = ++renderRequestId
  body.appendChild(createElement('div', { className: 'tool-loading', role: 'status' }, [
    createElement('span', { className: 'loading-spinner', 'aria-hidden': 'true' }),
    createElement('span', { textContent: '正在加载工具…' })
  ]))
  try {
    const implementation = await loadToolById(toolId)
    if (requestId !== renderRequestId) return
    body.innerHTML = ''
    implementation.render(body)
    enhanceFormAccessibility(body)
    body.setAttribute('aria-busy', 'false')
  } catch (error) {
    if (requestId !== renderRequestId) return
    console.error(`Failed to load tool: ${toolId}`, error)
    body.innerHTML = ''
    body.setAttribute('aria-busy', 'false')
    body.appendChild(createElement('div', { className: 'load-error', role: 'alert' }, [
      createElement('strong', { textContent: '工具加载失败' }),
      createElement('p', { textContent: navigator.onLine === false ? '当前设备似乎处于离线状态，请联网后重试。' : '可能是网络波动或资源暂时不可用。' }),
      createElement('div', { className: 'btn-group' }, [
        createElement('button', { className: 'btn btn-primary', type: 'button', textContent: '重新加载', onClick: () => renderToolPage(toolId) }),
        createElement('button', { className: 'btn btn-secondary', type: 'button', textContent: '返回首页', onClick: () => navigate('/') })
      ])
    ]))
  }
}

function renderHome() {
  renderRequestId += 1
  $('.search-box').hidden = false
  $('#categoryNav').style.display = ''
  $('#searchInput').value = searchQuery
  setPageMetadata('在线工具箱', '在线工具箱 - 86 个在浏览器本地运行的编解码、哈希加密、文本处理、生成器与格式化工具')
  document.querySelectorAll('.category-tab').forEach(button => {
    const isActive = button.dataset.category === currentCategory
    button.classList.toggle('active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })
  renderGrid()
  requestAnimationFrame(() => {
    window.scrollTo(0, homeScrollY)
    if (!returnFocusToolId) return
    document.querySelector(`.tool-card[href="#/${returnFocusToolId}"]`)?.focus({ preventScroll: true })
    returnFocusToolId = null
  })
}

function init() {
  setupTheme()
  setupHeader()
  setupCategoryNav()
  registerRoute('/', () => { $('#categoryNav').style.display = ''; renderHome() })
  tools.forEach(tool => registerRoute(`/${tool.id}`, () => { $('#categoryNav').style.display = 'none'; renderToolPage(tool.id) }))
  initRouter()
}

init()
