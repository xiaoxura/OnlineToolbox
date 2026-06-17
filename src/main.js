import './styles/base.css'
import './styles/layout.css'
import './styles/tool.css'

import { $, createElement } from './utils/dom.js'
import { initRouter, registerRoute, navigate } from './router.js'
import { categories, tools, getToolsByCategoryAndSearch, getToolById } from './tools/registry.js'
import icons from './icons.js'

// State
let currentCategory = 'all'
let searchQuery = ''

// Header setup
function setupHeader() {
  const searchInput = $('#searchInput')
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim()
    renderGrid()
  })
}

// Category nav
function setupCategoryNav() {
  const nav = $('#categoryNav')
  const inner = createElement('div', { className: 'category-nav-inner' })

  categories.forEach(cat => {
    const btn = createElement('button', {
      className: `category-tab${cat.id === currentCategory ? ' active' : ''}`,
      textContent: cat.name,
      'data-category': cat.id,
      onClick: () => {
        currentCategory = cat.id
        inner.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        renderGrid()
      }
    })
    inner.appendChild(btn)
  })

  nav.appendChild(inner)
}

// Tool grid
function renderGrid() {
  const main = $('#mainContent')
  const filtered = getToolsByCategoryAndSearch(currentCategory, searchQuery)

  if (filtered.length === 0) {
    main.innerHTML = `
      <div class="tool-grid">
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <p>没有找到匹配的工具</p>
        </div>
      </div>
    `
    return
  }

  const grid = createElement('div', { className: 'tool-grid' })

  filtered.forEach(tool => {
    const card = createElement('div', {
      className: 'tool-card',
      onClick: () => navigate(`/${tool.id}`),
    }, [
      createElement('div', {
        className: 'tool-icon-wrap',
      }, [
        createElement('div', {
          className: 'tool-icon',
          innerHTML: icons[tool.icon] || icons.wrench
        })
      ]),
      createElement('div', { className: 'tool-name', textContent: tool.name }),
      createElement('div', { className: 'tool-desc', textContent: tool.description }),
    ])
    grid.appendChild(card)
  })

  main.innerHTML = ''
  main.appendChild(grid)
}

// Tool page
function renderToolPage(toolId) {
  const tool = getToolById(toolId)
  if (!tool) {
    navigate('/')
    return
  }

  const main = $('#mainContent')
  const page = createElement('div', { className: 'tool-page' })

  // Header
  const header = createElement('div', { className: 'tool-header' }, [
    createElement('button', {
      className: 'back-btn',
      innerHTML: `${icons.back}<span>返回</span>`,
      onClick: () => navigate('/')
    }),
    createElement('span', { className: 'tool-title', textContent: tool.name }),
    createElement('span', { className: 'tool-title-desc', textContent: tool.description }),
  ])
  page.appendChild(header)

  // Tool content
  const body = createElement('div', { className: 'tool-body' })
  page.appendChild(body)

  main.innerHTML = ''
  main.appendChild(page)

  // Render tool
  tool.render(body)
}

// Home page
function renderHome() {
  $('#categoryNav').style.display = ''
  $('#searchInput').value = ''
  searchQuery = ''
  currentCategory = 'all'

  document.querySelectorAll('.category-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.category === 'all')
  })

  renderGrid()
}

// Init
function init() {
  setupHeader()
  setupCategoryNav()

  registerRoute('/', () => {
    $('#categoryNav').style.display = ''
    renderHome()
  })

  // Register tool routes
  tools.forEach(tool => {
    registerRoute(`/${tool.id}`, () => {
      $('#categoryNav').style.display = 'none'
      renderToolPage(tool.id)
    })
  })

  initRouter()
}

init()
