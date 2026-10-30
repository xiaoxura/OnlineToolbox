let generatedId = 0

export function nextId(prefix) {
  generatedId += 1
  return `${prefix}-${generatedId}`
}

export function $(selector, parent = document) {
  return parent.querySelector(selector)
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)]
}

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue
    if (key === 'attrs' && typeof value === 'object') {
      for (const [attrName, attrValue] of Object.entries(value)) {
        if (attrValue !== undefined && attrValue !== null && attrValue !== false) el.setAttribute(attrName, attrValue)
      }
    } else if (key === 'className') {
      el.className = value
    } else if (key === 'innerHTML') {
      el.innerHTML = value
    } else if (key === 'textContent') {
      el.textContent = value
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value)
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value)
    } else if (key in el && typeof value === 'boolean') {
      el[key] = value
    } else {
      el.setAttribute(key, value)
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child))
    } else if (child) {
      el.appendChild(child)
    }
  }

  if (el.classList.contains('error-text')) {
    el.setAttribute('role', 'alert')
    el.setAttribute('aria-live', 'polite')
  }

  return el
}
