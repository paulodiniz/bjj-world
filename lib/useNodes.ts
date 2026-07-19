import { useEffect, useState } from 'react'
import { getNodes } from './api'

export interface BJJNode {
  id: string
  name: string
  type: string
}

let _cache: BJJNode[] | null = null
const _listeners: Array<(nodes: BJJNode[]) => void> = []

export function useNodes(): BJJNode[] {
  const [nodes, setNodes] = useState<BJJNode[]>(_cache || [])

  useEffect(() => {
    if (_cache) { setNodes(_cache); return }
    _listeners.push(setNodes)
    if (_listeners.length === 1) {
      getNodes().then((data: BJJNode[]) => {
        _cache = Array.isArray(data) ? data : []
        _listeners.forEach((fn) => fn(_cache!))
        _listeners.length = 0
      }).catch(() => { _listeners.length = 0 })
    }
    return () => {
      const i = _listeners.indexOf(setNodes)
      if (i >= 0) _listeners.splice(i, 1)
    }
  }, [])

  return nodes
}
