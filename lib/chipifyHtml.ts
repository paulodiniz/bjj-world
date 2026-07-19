interface BJJNode { id: string; name: string; type: string }

let _re: RegExp | null = null
let _nodes: BJJNode[] = []

export function setChipNodes(nodes: BJJNode[]) {
  _nodes = nodes.slice().sort((a, b) => b.name.length - a.name.length)
  const escaped = _nodes.map((n) => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  _re = escaped.length ? new RegExp('\\b(?:' + escaped.join('|') + ')\\b', 'gi') : null
}

export function chipifyHtml(html: string): string {
  if (!_re || !_nodes.length) return html
  const re = _re

  // Process text segments between HTML tags, leave tags untouched
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag
    if (!text) return match
    re.lastIndex = 0
    return text.replace(re, (m: string) => {
      const node = _nodes.find((n) => n.name.toLowerCase() === m.toLowerCase())
      if (!node) return m
      return `<a href="/technique/${encodeURIComponent(node.id)}" class="nc nc-${node.type}" title="${node.type.replace(/_/g, ' ')}">${m}</a>`
    })
  })
}
