/* global __BUILD_INFO__ */

// Build metadata is injected by Vite (see vite.config.js). Keeping the access
// behind a guard makes the module importable from Node scripts and unit tests,
// where the define does not exist.
const EMPTY_BUILD_INFO = Object.freeze({
  builtAt: '',
  commit: '',
  commitShort: '',
  commitDate: '',
  branch: ''
})

export function getBuildInfo() {
  try {
    if (typeof __BUILD_INFO__ === 'object' && __BUILD_INFO__) return __BUILD_INFO__
  } catch {
    // Not running through Vite; fall through to the empty descriptor.
  }
  return EMPTY_BUILD_INFO
}

export const buildInfo = getBuildInfo()

// The site targets Chinese users, so the footer date is always shown in
// Beijing time. Stamping it at build time (rather than rendering Date.now() in
// the browser) makes it the deployment date, which is what the footer is for.
export function formatBuildTime(iso, timeZone = 'Asia/Shanghai') {
  const date = new Date(iso)
  if (!iso || Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const valueOf = type => parts.find(part => part.type === type)?.value || ''
  return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')} ${valueOf('hour')}:${valueOf('minute')}`
}

export function formatBuildTitle(info = buildInfo, timeZone = 'Asia/Shanghai') {
  const time = formatBuildTime(info.builtAt, timeZone)
  if (!time) return ''
  const commit = info.commitShort ? ` · 提交 ${info.commitShort}` : ''
  return `构建于 ${time}（${timeZone === 'Asia/Shanghai' ? '北京时间' : timeZone}）${commit}`
}
