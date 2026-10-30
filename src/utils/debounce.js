// Small debounce helper for live previews over large inputs. The returned
// function also exposes cancel() so a tool can stop a pending run on dispose.
export function debounce(fn, wait = 120) {
  let timer = null
  const wrapped = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, wait)
  }
  wrapped.cancel = () => {
    clearTimeout(timer)
    timer = null
  }
  return wrapped
}
