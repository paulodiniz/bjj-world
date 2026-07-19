import { useEffect, useRef } from 'react'
import { getNodes } from './api'

interface BJJNode { id: string; name: string; type: string }

let _cache: { nodes: BJJNode[]; re: RegExp } | null = null
let _loading = false
const _waiters: Array<() => void> = []

function loadNodes(): Promise<{ nodes: BJJNode[]; re: RegExp } | null> {
  if (_cache) return Promise.resolve(_cache)
  return new Promise((resolve) => {
    _waiters.push(() => resolve(_cache))
    if (!_loading) {
      _loading = true
      getNodes().then((data: BJJNode[]) => {
        const nodes = Array.isArray(data) ? data.sort((a, b) => b.name.length - a.name.length) : []
        const escaped = nodes.map((n) => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        _cache = { nodes, re: new RegExp('\\b(?:' + escaped.join('|') + ')\\b', 'gi') }
        _waiters.forEach((fn) => fn())
        _waiters.length = 0
      }).catch(() => { _loading = false; _waiters.forEach((fn) => fn()); _waiters.length = 0 })
    }
  })
}

function chipifyTextNode(textNode: Text, nodes: BJJNode[], re: RegExp) {
  const text = textNode.textContent || ''
  re.lastIndex = 0
  if (!re.test(text)) return
  re.lastIndex = 0

  const frag = document.createDocumentFragment()
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)))
    const node = nodes.find((n) => n.name.toLowerCase() === match![0].toLowerCase())
    if (node) {
      const a = document.createElement('a')
      a.className = `nc nc-${node.type}`
      a.textContent = match[0]
      a.title = node.type.replace(/_/g, ' ')
      a.href = `/technique/${encodeURIComponent(node.id)}`
      frag.appendChild(a)
    } else {
      frag.appendChild(document.createTextNode(match[0]))
    }
    last = match.index + match[0].length
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
  textNode.replaceWith(frag)
}

function walkForChips(el: Element, nodes: BJJNode[], re: RegExp) {
  const skip = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'A'])
  for (const child of [...el.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      chipifyTextNode(child as Text, nodes, re)
    } else if (
      child.nodeType === Node.ELEMENT_NODE &&
      !skip.has((child as Element).tagName) &&
      !(child as Element).classList.contains('nc')
    ) {
      walkForChips(child as Element, nodes, re)
    }
  }
}

export function applyChipsToContainer(container: HTMLElement) {
  if (!_cache) return
  const answers = container.querySelectorAll<HTMLElement>('.answer-text:not([data-chipped])')
  answers.forEach((el) => {
    el.setAttribute('data-chipped', '1')
    walkForChips(el, _cache!.nodes, _cache!.re)
  })
}

export function useChips(containerRef: React.RefObject<HTMLElement>, deps: any[]) {
  const pendingRef = useRef(false)

  // Load nodes once; when they arrive, chip anything already rendered
  useEffect(() => {
    loadNodes().then(() => {
      if (containerRef.current) applyChipsToContainer(containerRef.current)
    })
  }, []) // eslint-disable-line

  // Chip newly rendered elements whenever deps change
  useEffect(() => {
    if (!_cache) { pendingRef.current = true; return }
    if (containerRef.current) applyChipsToContainer(containerRef.current)
  }, deps) // eslint-disable-line
}
