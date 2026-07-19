type Cb = () => void

let _stop: Cb | null = null

export function registerStop(fn: Cb) {
  _stop = fn
  window.dispatchEvent(new CustomEvent('streaming:start'))
}

export function clearStop() {
  _stop = null
  window.dispatchEvent(new CustomEvent('streaming:end'))
}

export function triggerStop() {
  _stop?.()
}
