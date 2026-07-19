import { useEffect, useRef } from 'react'
import { getNodes } from './api'

interface BJJNode {
  id: string
  name: string
  type: string
}

let cachedNodes: BJJNode[] | null = null
let chipRe: RegExp | null = null

async function loadNodes(): Promise<{ nodes: BJJNode[]; re: RegExp } | null> {
  if (cachedNodes && chipRe) return { nodes: cachedNodes, re: chipRe }
  try {
    const data: BJJNode[] = await getNodes()
    cachedNodes = data.sort((a, b) => b.name.length - a.name.length)
    const escaped = cachedNodes.map((n) => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    chipRe = new RegExp('\\b(?:' + escaped.join('|') + ')\\b', 'gi')
    return { nodes: cachedNodes, re: chipRe }
  } catch {
    return null
  }
}

function chipifyTextNode(
  textNode: Text,
  nodes: BJJNode[],
  re: RegExp,
  navigate: (id: string) => void
) {
  const text = textNode.textContent || ''
  re.lastIndex = 0
  if (!re.test(text)) return
  re.lastIndex = 0

  const frag = document.createDocumentFragment()
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      frag.appendChild(document.createTextNode(text.slice(last, match.index)))
    }
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

function walkForChips(el: Element, nodes: BJJNode[], re: RegExp, navigate: (id: string) => void) {
  const skip = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'A'])
  for (const child of [...el.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      chipifyTextNode(child as Text, nodes, re, navigate)
    } else if (
      child.nodeType === Node.ELEMENT_NODE &&
      !skip.has((child as Element).tagName) &&
      !(child as Element).classList.contains('nc')
    ) {
      walkForChips(child as Element, nodes, re, navigate)
    }
  }
}

export function useChips(containerRef: React.RefObject<HTMLElement>, deps: any[]) {
  const nodesRef = useRef<{ nodes: BJJNode[]; re: RegExp } | null>(null)

  useEffect(() => {
    loadNodes().then((result) => {
      if (result) nodesRef.current = result
    })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !nodesRef.current) return
    // Only process answer elements that haven't been chipped yet
    const answers = container.querySelectorAll<HTMLElement>('.answer-text:not([data-chipped])')
    answers.forEach((el) => {
      el.setAttribute('data-chipped', '1')
      walkForChips(el, nodesRef.current!.nodes, nodesRef.current!.re, () => {})
    })
  }, deps)
}
