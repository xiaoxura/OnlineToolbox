import './styles/base.css'
import './styles/tool.css'
import './styles/refresh.css'

import { $, cleanupFormAccessibility, createElement, enhanceFormAccessibility, applyTwoColumnLayout, enhanceResultSections } from './utils/dom.js'
import { initRouter, registerRoute, navigate } from './router.js'
import { categories, tools, getToolsByCategory, getToolsByCategoryAndSearch, getToolById, loadToolById } from './tools/registry.js'
import icons from './icons.js'

const STORAGE = {
  favorites: 'toolbox:favorites',
  recent: 'toolbox:recent'
}
const MAX_RECENT = 8
const FEATURED_TOOLS = ['json', 'timestamp', 'base64', 'uuid', 'regex', 'color-contrast']

let currentCategory = 'all'
let currentView = 'all'
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

function announce(message) {
  const region = $('#liveRegion')
  if (region) region.textContent = message
}

function syncCategoryTabs() {
  document.querySelectorAll('.category-tab').forEach(button => {
    const active = button.dataset.category === currentCategory
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  })
}

function setupTheme() {
  const button = $('#themeToggle')
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const updateButton = () => {
    const isDark = document.documentElement.dataset.theme === 'dark'
    button.setAttribute('aria-label', isDark ? '切换到浅色主题' : '切换到深色主题')
    button.setAttribute('title', isDark ? '切换到浅色主题' : '切换到深色主题')
    button.setAttribute('aria-pressed', String(isDark))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#111216' : '#f4f5f8')
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

function syncSearchControls() {
  const input = $('#searchInput')
  const clearButton = $('#searchClear')
  const searchBox = input?.closest('.search-box')
  const hasValue = Boolean(input?.value)
  if (clearButton) clearButton.hidden = !hasValue
  searchBox?.classList.toggle('has-value', hasValue)
}

function setupHeader() {
  const searchInput = $('#searchInput')
  searchInput.placeholder = `搜索 ${tools.length} 个工具...`
  searchInput.addEventListener('input', event => {
    searchQuery = event.target.value.trim()
    const isHome = window.location.hash === '#/' || window.location.hash === ''
    if (!isHome) {
      currentView = 'all'
      currentCategory = 'all'
      syncCategoryTabs()
    }
    syncSearchControls()
    if (isHome) renderGrid()
    else navigate('/')
  })
  $('#searchClear')?.addEventListener('click', clearSearch)
  searchInput.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !searchInput.value) return
    event.preventDefault()
    clearSearch()
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
  syncSearchControls()
}

function setupCategoryNav() {
  const nav = $('#categoryNav')
  nav.innerHTML = ''
  nav.appendChild(createElement('div', { className: 'category-nav-heading' }, [
    createElement('span', { textContent: '浏览' }),
    createElement('strong', { textContent: '工具分类' }),
    createElement('small', { textContent: `${categories.length - 1} 个分类 · ${tools.length} 个工具` })
  ]))
  const inner = createElement('div', { className: 'category-nav-inner' })
  categories.forEach(category => {
    const count = category.id === 'all' ? tools.length : tools.filter(tool => tool.category === category.id).length
    const button = createElement('button', {
      className: `category-tab${category.id === currentCategory ? ' active' : ''}`,
      type: 'button',
      'data-category': category.id,
      'aria-pressed': String(category.id === currentCategory),
      title: category.description,
      onClick: () => {
        currentCategory = category.id
        inner.querySelectorAll('.category-tab').forEach(item => {
          item.classList.toggle('active', item === button)
          item.setAttribute('aria-pressed', String(item === button))
        })
        button.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        renderGrid()
      }
    }, [
      createElement('span', { className: 'category-dot', 'aria-hidden': 'true' }),
      createElement('span', { className: 'category-tab-copy' }, [
        createElement('strong', { textContent: category.name }),
        createElement('small', { textContent: category.description })
      ]),
      createElement('span', { className: 'category-count', textContent: String(count), 'aria-hidden': 'true' })
    ])
    inner.appendChild(button)
  })
  nav.appendChild(inner)
}

function favoriteIcon(isFavorite) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
}

function setFavorite(toolId) {
  favorites = favorites.includes(toolId) ? favorites.filter(id => id !== toolId) : [toolId, ...favorites]
  storeList(STORAGE.favorites, favorites)
  return favorites.includes(toolId)
}

function createFavoriteButton(tool, onToggle) {
  const sync = (button, isFavorite) => {
    button.classList.toggle('active', isFavorite)
    button.title = isFavorite ? '取消收藏' : '收藏工具'
    button.setAttribute('aria-label', `${isFavorite ? '取消收藏' : '收藏'}${tool.name}`)
    button.setAttribute('aria-pressed', String(isFavorite))
    button.innerHTML = favoriteIcon(isFavorite)
  }
  const button = createElement('button', {
    className: 'favorite-btn',
    type: 'button',
    'data-tool-id': tool.id,
    onClick: () => {
      const isFavorite = setFavorite(tool.id)
      sync(button, isFavorite)
      announce(`${tool.name}${isFavorite ? '已收藏' : '已取消收藏'}`)
      onToggle(isFavorite)
    }
  })
  sync(button, favorites.includes(tool.id))
  return button
}

function createToolCard(tool, { recordHomeScroll = false, refreshHome = false } = {}) {
  const category = categories.find(item => item.id === tool.category)
  const link = createElement('a', {
    className: 'tool-card',
    href: `#/${tool.id}`,
    'data-category': tool.category
  }, [
    createElement('div', { className: 'tool-icon-wrap', 'aria-hidden': 'true' }, [
      createElement('div', { className: 'tool-icon', innerHTML: icons[tool.icon] || icons.wrench })
    ]),
    createElement('div', { className: 'tool-card-copy' }, [
      createElement('div', { className: 'tool-card-title-row' }, [
        createElement('div', { className: 'tool-name', textContent: tool.name }),
        createElement('span', { className: 'tool-category-label', textContent: category?.name || '工具' })
      ]),
      createElement('div', { className: 'tool-desc', textContent: tool.description })
    ]),
    createElement('span', { className: 'tool-card-arrow', innerHTML: icons.back, 'aria-hidden': 'true' })
  ])
  if (recordHomeScroll) link.addEventListener('click', () => { homeScrollY = window.scrollY })
  const favoriteButton = createFavoriteButton(tool, () => {
    if (refreshHome) renderGrid({ favoriteToolId: tool.id })
  })
  return createElement('div', { className: 'tool-card-wrap', 'data-category': tool.category }, [link, favoriteButton])
}

function renderToolSection(title, toolIds, {
  className = '',
  onClear,
  emptyText = '',
  countText = `${toolIds.length} 个工具`
} = {}) {
  const sectionTools = toolIds.map(getToolById).filter(Boolean)
  if (!sectionTools.length && !emptyText) return null
  const headerItems = [
    createElement('div', {}, [
      createElement('h2', { textContent: title }),
      createElement('span', { textContent: countText })
    ])
  ]
  if (onClear) headerItems.push(createElement('button', { className: 'section-action', type: 'button', textContent: '清空', onClick: onClear }))
  const section = createElement('section', { className: `home-tool-section ${className}`.trim() }, [
    createElement('div', { className: 'home-section-header' }, headerItems)
  ])
  if (sectionTools.length) {
    const grid = createElement('div', { className: 'tool-grid compact' })
    sectionTools.forEach(tool => grid.appendChild(createToolCard(tool, { recordHomeScroll: true, refreshHome: true })))
    section.appendChild(grid)
  } else {
    section.appendChild(createElement('p', { className: 'home-section-empty', textContent: emptyText }))
  }
  return section
}

function createRelatedTools(tool, max = 6) {
  const related = getToolsByCategory(tool.category).filter(item => item.id !== tool.id).slice(0, max)
  if (!related.length) return null
  const grid = createElement('div', { className: 'tool-grid compact related-tools-grid' })
  related.forEach(item => grid.appendChild(createToolCard(item)))
  return createElement('section', { className: 'related-tools', 'aria-label': '相关工具' }, [
    createElement('div', { className: 'related-tools-heading' }, [
      createElement('h2', { className: 'related-tools-title', textContent: '相关工具' }),
      createElement('span', { textContent: categories.find(item => item.id === tool.category)?.name })
    ]),
    grid
  ])
}

function createViewButton(id, label, count) {
  return createElement('button', {
    className: `view-tab${currentView === id ? ' active' : ''}`,
    type: 'button',
    'data-view': id,
    'aria-pressed': String(currentView === id),
    onClick: () => {
      currentView = id
      renderGrid({ viewId: id })
    }
  }, [createElement('span', { textContent: label }), createElement('strong', { textContent: String(count) })])
}

function createHomeOverview() {
  return createElement('section', { className: 'home-overview', 'aria-labelledby': 'workspaceTitle' }, [
    createElement('div', { className: 'overview-copy' }, [
      createElement('span', { className: 'overview-kicker', textContent: '当前工作区' }),
      createElement('h1', { id: 'workspaceTitle', textContent: '工具工作台' }),
      createElement('div', { className: 'overview-stats' }, [
        createElement('span', {}, [createElement('strong', { textContent: String(tools.length) }), ' 个工具']),
        createElement('span', {}, [createElement('strong', { textContent: String(categories.length - 1) }), ' 个分类']),
        createElement('span', { className: 'local-status' }, [createElement('i', { 'aria-hidden': 'true' }), ' 本地优先'])
      ])
    ]),
    createElement('div', { className: 'overview-controls' }, [
      createElement('div', { className: 'privacy-banner', role: 'note' }, [
        createElement('span', { className: 'privacy-icon', innerHTML: icons.sha, 'aria-hidden': 'true' }),
        createElement('div', {}, [
          createElement('strong', { textContent: '数据留在当前设备' }),
          createElement('span', { textContent: '联网工具会单独标注' })
        ])
      ]),
      createElement('div', { className: 'view-tabs', role: 'group', 'aria-label': '工具视图' }, [
        createViewButton('all', '全部', tools.length),
        createViewButton('favorites', '收藏', favorites.length),
        createViewButton('recent', '最近', recentTools.length)
      ])
    ])
  ])
}

function visibleTools() {
  const filtered = getToolsByCategoryAndSearch(currentCategory, searchQuery)
  if (currentView === 'favorites') {
    const visible = new Set(filtered.map(tool => tool.id))
    return favorites.map(getToolById).filter(tool => tool && visible.has(tool.id))
  }
  if (currentView === 'recent') {
    const visible = new Set(filtered.map(tool => tool.id))
    return recentTools.map(getToolById).filter(tool => tool && visible.has(tool.id))
  }
  return filtered
}

function currentHeading() {
  if (searchQuery) return `“${searchQuery}”的搜索结果`
  if (currentView === 'favorites') return '我的收藏'
  if (currentView === 'recent') return '最近使用'
  if (currentCategory === 'all') return '全部工具'
  return categories.find(category => category.id === currentCategory)?.name || '全部工具'
}

function currentDescription() {
  const category = categories.find(item => item.id === currentCategory)
  if (searchQuery) {
    const scope = currentCategory === 'all' ? '全部分类' : category?.name
    return `正在${scope ? `${scope}中` : ''}匹配名称、描述与关键词`
  }
  if (currentView === 'favorites') return '保存在当前浏览器中的常用工具'
  if (currentView === 'recent') return '最近打开过的工具，按使用顺序排列'
  return category?.description || '浏览全部可用工具'
}

function hasActiveFilters() {
  return Boolean(searchQuery || currentCategory !== 'all' || currentView !== 'all')
}

function resetFilters() {
  searchQuery = ''
  currentCategory = 'all'
  currentView = 'all'
  $('#searchInput').value = ''
  syncSearchControls()
  syncCategoryTabs()
  renderGrid({ viewId: 'all' })
}

function renderGrid(focusTarget = {}) {
  const main = $('#mainContent')
  const filtered = visibleTools()
  document.body.dataset.page = 'home'
  main.className = 'home-main'
  cleanupFormAccessibility(main)
  main.innerHTML = ''
  main.appendChild(createHomeOverview())

  if (!searchQuery && currentCategory === 'all' && currentView === 'all') {
    const favoriteSection = renderToolSection('我的收藏', favorites, { className: 'favorites-section' })
    const recentIds = recentTools.filter(id => !favorites.includes(id))
    const recentSection = recentTools.length ? renderToolSection('最近使用', recentIds, {
      className: 'recent-section',
      countText: `${recentIds.length} 个工具`,
      emptyText: '最近使用的工具均已收藏',
      onClear: () => {
        recentTools = []
        storeList(STORAGE.recent, recentTools)
        renderGrid({ viewId: currentView })
        announce('最近使用记录已清空')
      }
    }) : null
    const personalSections = [favoriteSection, recentSection].filter(Boolean)
    if (personalSections.length) {
      main.appendChild(createElement('div', { className: 'personal-sections' }, personalSections))
    }
    const personalizedIds = new Set([...favorites, ...recentTools])
    const featuredIds = FEATURED_TOOLS.filter(id => !personalizedIds.has(id))
    const featuredSection = renderToolSection('快速访问', featuredIds, { className: 'featured-section' })
    if (featuredSection) main.appendChild(featuredSection)
  }

  const allSection = createElement('section', { className: 'home-tool-section all-tools-section' })
  const sectionHeader = createElement('div', { className: 'home-section-header' }, [
    createElement('div', { className: 'section-heading-copy' }, [
      createElement('div', { className: 'section-heading-line' }, [
        createElement('h2', { textContent: currentHeading() }),
        createElement('span', { textContent: `${filtered.length} 个工具` })
      ]),
      createElement('p', { textContent: currentDescription() })
    ])
  ])
  if (hasActiveFilters()) {
    sectionHeader.appendChild(createElement('button', {
      className: 'section-reset',
      type: 'button',
      textContent: '重置筛选',
      onClick: resetFilters
    }))
  }
  allSection.appendChild(sectionHeader)

  if (!filtered.length) {
    const favoritesEmpty = currentView === 'favorites' && favorites.length === 0
    const recentEmpty = currentView === 'recent' && recentTools.length === 0
    const collectionEmpty = favoritesEmpty || recentEmpty
    const onlySearchActive = Boolean(searchQuery && currentCategory === 'all' && currentView === 'all')
    const message = favoritesEmpty
      ? '还没有收藏工具'
      : recentEmpty
        ? '还没有最近使用记录'
        : searchQuery
          ? `当前筛选下未找到“${searchQuery}”`
          : '当前筛选下没有匹配工具'
    const hint = collectionEmpty
      ? '保存的工具会显示在这里。'
      : '当前分类、视图或关键词没有交集。'
    allSection.appendChild(createElement('div', { className: 'empty-state' }, [
      createElement('div', { className: 'empty-search-icon', innerHTML: icons.search, 'aria-hidden': 'true' }),
      createElement('p', { textContent: message }),
      createElement('span', { textContent: hint }),
      createElement('button', {
        className: 'btn btn-secondary',
        type: 'button',
        textContent: onlySearchActive ? '清除搜索' : collectionEmpty ? '浏览全部工具' : '重置筛选',
        onClick: onlySearchActive ? clearSearch : resetFilters
      })
    ]))
  } else {
    const grid = createElement('div', { className: 'tool-grid' })
    filtered.forEach(tool => grid.appendChild(createToolCard(tool, { recordHomeScroll: true, refreshHome: true })))
    allSection.appendChild(grid)
  }
  main.appendChild(allSection)
  announce(`${currentHeading()}，共 ${filtered.length} 个工具`)
  const focusSelector = focusTarget.favoriteToolId
    ? `.favorite-btn[data-tool-id="${focusTarget.favoriteToolId}"]`
    : focusTarget.viewId
      ? `.view-tab[data-view="${focusTarget.viewId}"]`
      : ''
  const focusElement = (focusSelector ? main.querySelector(focusSelector) : null)
    || (focusTarget.favoriteToolId ? main.querySelector(`.view-tab[data-view="${currentView}"]`) : null)
  focusElement?.focus({ preventScroll: true })
}

function clearSearch() {
  searchQuery = ''
  $('#searchInput').value = ''
  syncSearchControls()
  $('#searchInput').focus()
  renderGrid()
}

function recordRecent(toolId) {
  recentTools = [toolId, ...recentTools.filter(id => id !== toolId)].slice(0, MAX_RECENT)
  storeList(STORAGE.recent, recentTools)
}

async function renderToolPage(toolId) {
  const tool = getToolById(toolId)
  if (!tool) { navigate('/'); return }
  returnFocusToolId = toolId
  recordRecent(toolId)

  const main = $('#mainContent')
  document.body.dataset.page = 'tool'
  main.className = 'tool-main'
  const page = createElement('div', { className: 'tool-page', 'data-category': tool.category })
  const titleId = `tool-title-${tool.id}`
  const categoryName = categories.find(category => category.id === tool.category)?.name || '在线工具'
  const title = createElement('h1', { id: titleId, className: 'tool-title', textContent: tool.name, tabindex: '-1' })
  const breadcrumb = createElement('nav', { className: 'breadcrumb', 'aria-label': '面包屑' }, [
    createElement('a', { className: 'breadcrumb-link', href: '#/', textContent: '首页' }),
    createElement('span', { className: 'breadcrumb-sep', textContent: '/', 'aria-hidden': 'true' }),
    createElement('button', {
      className: 'breadcrumb-link breadcrumb-category',
      type: 'button',
      textContent: categoryName,
      title: `查看${categoryName}分类`,
      onClick: () => {
        searchQuery = ''
        currentCategory = tool.category
        currentView = 'all'
        $('#searchInput').value = ''
        syncSearchControls()
        syncCategoryTabs()
        navigate('/')
      }
    }),
    createElement('span', { className: 'breadcrumb-sep breadcrumb-sep-current', textContent: '/', 'aria-hidden': 'true' }),
    createElement('span', { className: 'breadcrumb-current', textContent: tool.name, 'aria-current': 'page' })
  ])
  const headerFavorite = createFavoriteButton(tool, () => {})
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
      breadcrumb,
      title,
      createElement('span', { className: 'tool-title-desc', textContent: tool.description })
    ]),
    headerFavorite
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
    applyTwoColumnLayout(body)
    enhanceFormAccessibility(body)
    enhanceResultSections(body, { toolName: tool.id })
    body.setAttribute('aria-busy', 'false')

    const related = createRelatedTools(tool)
    if (related) {
      page.querySelector('.related-tools')?.remove()
      page.appendChild(related)
    }
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
  const focusedCard = document.activeElement?.closest?.('.tool-card')
  const focusToolId = returnFocusToolId || focusedCard?.getAttribute('href')?.replace(/^#\//, '')
  renderRequestId += 1
  document.body.dataset.page = 'home'
  $('.search-box').hidden = false
  $('#categoryNav').style.display = ''
  $('#searchInput').value = searchQuery
  syncSearchControls()
  setPageMetadata('在线工具箱', `在线工具箱 - ${tools.length} 个在浏览器本地运行的开发者工具`)
  document.querySelectorAll('.category-tab').forEach(button => {
    const isActive = button.dataset.category === currentCategory
    button.classList.toggle('active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })
  renderGrid()
  requestAnimationFrame(() => {
    window.scrollTo(0, homeScrollY)
    if (!focusToolId) return
    document.querySelector(`.tool-card[href="#/${focusToolId}"]`)?.focus({ preventScroll: true })
    if (returnFocusToolId === focusToolId) returnFocusToolId = null
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
