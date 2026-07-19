let _file: File | null = null
export const setPendingFile = (f: File) => { _file = f }
export const takePendingFile = (): File | null => { const f = _file; _file = null; return f }
