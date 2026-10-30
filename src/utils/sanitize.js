import DOMPurify from 'dompurify'

// Sanitise rendered HTML and harden the links/images that survive. Remote
// images still require a network request, but they no longer leak the page URL
// as a referrer; external links open in a new tab without window.opener.
export function sanitizeHtml(html, options) {
  const clean = DOMPurify.sanitize(html, options)
  const template = document.createElement('template')
  template.innerHTML = clean
  for (const image of template.content.querySelectorAll('img')) {
    image.setAttribute('loading', 'lazy')
    image.setAttribute('decoding', 'async')
    image.setAttribute('referrerpolicy', 'no-referrer')
  }
  for (const link of template.content.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') || ''
    if (/^https?:/i.test(href)) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  }
  return template.innerHTML
}
