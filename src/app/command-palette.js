// Global command palette: Ctrl/⌘+K opens a searchable tool switcher from any
// page (the old shortcut only focused the home-page search box and bounced the
// user back to the index first).
import { navigate } from '../router.js'
import { openToolPicker, isToolPickerOpen } from './tool-picker.js'

export function setupCommandPalette() {
  document.addEventListener('keydown', event => {
    const key = typeof event.key === 'string' ? event.key.toLowerCase() : ''
    const isPalette = key === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey
    if (!isPalette) return
    event.preventDefault()
    if (isToolPickerOpen()) return
    openToolPicker({
      title: '命令面板',
      placeholder: '搜索工具、功能或拼音…',
      onSelect: tool => navigate(`/${tool.id}`)
    })
  })
}
