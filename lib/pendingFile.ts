declare global { interface Window { __pendingFile?: File | null } }

export const setPendingFile = (f: File) => { window.__pendingFile = f }
export const takePendingFile = (): File | null => {
  const f = window.__pendingFile ?? null
  window.__pendingFile = null
  return f
}
