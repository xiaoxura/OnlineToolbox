// Public DOM/component helpers. The implementation is split by concern so a
// change to (say) accessibility does not require scrolling through 600 lines of
// layout code; tools continue to import everything from this barrel.
export { $, $$, createElement } from './dom/core.js'
export { flashCopied, createCopyButton, createSection, createTableScroll } from './dom/components.js'
export { createSegmentedGroup, createFilterGroup, createTabGroup } from './dom/choices.js'
export { cleanupFormAccessibility, enhanceFormAccessibility } from './dom/a11y.js'
export { applyTwoColumnLayout } from './dom/layout.js'
export { enhanceResultSections } from './dom/result-toolbar.js'
export { showToast } from './toast.js'
