import { nextId } from './core.js'
import { createTableScroll } from './components.js'
import { cleanupChoiceScrolling, enhanceChoiceScrolling } from './choices.js'

export function cleanupFormAccessibility(root = document) {
  cleanupChoiceScrolling(root)
}

export function enhanceFormAccessibility(root = document) {
  root.querySelectorAll('input, textarea, select').forEach(control => {
    if (!control.id) control.id = nextId('tool-field')
  })

  root.querySelectorAll('.tool-section').forEach(section => {
    const body = section.querySelector(':scope > .tool-section-body')
    const header = section.querySelector(':scope > .tool-section-header')
    if (!body || !header) return
    const strayChildren = [...section.children].filter(child => child !== header && child !== body)
    if (strayChildren.length) body.append(...strayChildren)
  })

  root.querySelectorAll('table.result-box').forEach(table => {
    table.classList.remove('result-box')
    table.classList.add('result-table')
  })

  root.querySelectorAll('table.result-table').forEach(table => {
    if (table.parentElement?.classList.contains('table-scroll')) return
    createTableScroll(table)
  })

  const tabGroups = [...root.querySelectorAll('.tab-group[role="tablist"]')]
  const externalPanels = [...root.querySelectorAll('.tab-panel')]
  if (tabGroups.length === 1) {
    const buttons = [...tabGroups[0].querySelectorAll('[role="tab"]')]
    if (buttons.length === externalPanels.length && buttons.every(button => !button.hasAttribute('aria-controls'))) {
      buttons.forEach((button, index) => {
        const panel = externalPanels[index]
        if (!panel.id) panel.id = nextId('tool-tab-panel')
        button.setAttribute('aria-controls', panel.id)
        panel.setAttribute('role', 'tabpanel')
        panel.setAttribute('aria-labelledby', button.id)
        panel.setAttribute('tabindex', '0')
      })
    }
  }

  root.querySelectorAll('.tab-group, .segmented-group, .filter-group').forEach(enhanceChoiceScrolling)

  root.querySelectorAll('.form-group').forEach(group => {
    const labels = [...group.querySelectorAll('label')].filter(label => !label.control)
    const controls = [...group.querySelectorAll('input, textarea, select')].filter(control => {
      return !control.closest('label')
    })

    labels.forEach((label, index) => {
      const control = controls[index]
      if (!control) return
      label.htmlFor = control.id
    })
  })

  root.querySelectorAll('input, textarea, select').forEach(control => {
    if (control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return
    const fallback = control.getAttribute('placeholder') || control.closest('.tool-section')?.querySelector('.tool-section-header h2')?.textContent
    if (fallback) control.setAttribute('aria-label', fallback)
  })

  root.querySelectorAll('img:not([alt])').forEach(image => image.setAttribute('alt', ''))
  root.querySelectorAll('button:not([aria-label])').forEach(button => {
    if (!button.textContent.trim() && button.title) button.setAttribute('aria-label', button.title)
  })

  root.querySelectorAll('button:not([type])').forEach(button => button.setAttribute('type', 'button'))
}
