'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

declare const d3: any

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [types, setTypes] = useState<string[]>([])
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    // D3 is loaded via CDN — wait until it's available
    const tryInit = () => {
      if (typeof d3 !== 'undefined') { initGraph(); return }
      setTimeout(tryInit, 100)
    }
    tryInit()
    return () => { /* cleanup handled by d3 overwriting svg */ }
  }, []) // eslint-disable-line

  const initGraph = () => {
    const svgEl = svgRef.current!
    const W = svgEl.clientWidth || window.innerWidth
    const H = svgEl.clientHeight || (window.innerHeight - 52)

    fetch('/api/graph')
      .then((r) => r.json())
      .then((data) => {
        setLoading(false)
        const nodes = data.nodes as any[]
        const edges = data.edges as any[]

        const seenTypes = [...new Set<string>(nodes.map((n) => n.type))].sort()
        setTypes(seenTypes)
        setActiveTypes(new Set(seenTypes))

        const adjacency = new Set<string>()
        edges.forEach((e) => {
          adjacency.add(`${e.source}§${e.target}`)
          adjacency.add(`${e.target}§${e.source}`)
        })
        const areLinked = (a: any, b: any) => adjacency.has(`${a.id}§${b.id}`)

        const getColor = (type: string) =>
          getComputedStyle(document.documentElement).getPropertyValue(`--c-${type}`).trim() || 'oklch(0.55 0 0)'

        const svg = d3.select(svgEl)
        svg.selectAll('*').remove()
        const g = svg.append('g')

        const zoom = d3.zoom().scaleExtent([0.05, 8])
          .on('zoom', (e: any) => g.attr('transform', e.transform))
        svg.call(zoom).on('dblclick.zoom', null)

        const sim = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(70).strength(0.35))
          .force('charge', d3.forceManyBody().strength(-260))
          .force('center', d3.forceCenter(W / 2, H / 2))
          .force('collide', d3.forceCollide(18))

        const link = g.append('g').selectAll('line').data(edges).join('line').attr('class', 'graph-edge')

        const node = g.append('g')
          .selectAll('g').data(nodes).join('g')
          .attr('cursor', 'pointer')
          .call(d3.drag()
            .on('start', (e: any, d: any) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
            .on('drag', (e: any, d: any) => { d.fx = e.x; d.fy = e.y })
            .on('end', (e: any, d: any) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
          )
          .on('click', (e: any, d: any) => { e.stopPropagation(); router.push(`/technique/${encodeURIComponent(d.id)}`) })
          .on('mouseenter', (_: any, d: any) => {
            node.select('circle').attr('r', (n: any) => n === d ? 11 : 8).attr('fill-opacity', (n: any) => n === d || areLinked(n, d) ? 0.95 : 0.15)
            node.select('text').attr('opacity', (n: any) => n === d || areLinked(n, d) ? 1 : 0.1)
            link.attr('stroke-opacity', (l: any) => l.source === d || l.target === d ? 0.9 : 0.04)
              .attr('stroke', (l: any) => l.source === d || l.target === d
                ? getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim()
                : 'oklch(0.28 0 0)')
          })
          .on('mouseleave', () => {
            node.select('circle').attr('r', 8).attr('fill-opacity', 0.85)
            node.select('text').attr('opacity', 1)
            link.attr('stroke-opacity', 0.5).attr('stroke', 'oklch(0.28 0 0)')
          })

        node.append('circle').attr('r', 8)
          .attr('fill', (d: any) => getColor(d.type)).attr('fill-opacity', 0.85)
          .attr('stroke', (d: any) => getColor(d.type)).attr('stroke-width', 1.5).attr('stroke-opacity', 0.4)

        node.append('text').text((d: any) => d.name).attr('dy', -12).attr('class', 'graph-label')

        sim.on('tick', () => {
          link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y)
          node.attr('transform', (d: any) => `translate(${d.x ?? 0},${d.y ?? 0})`)
        })

        sim.on('end', () => {
          try {
            const b = (g.node() as SVGGElement).getBBox()
            const scale = 0.88 * Math.min(W / b.width, H / b.height)
            const tx = W / 2 - scale * (b.x + b.width / 2)
            const ty = H / 2 - scale * (b.y + b.height / 2)
            svg.transition().duration(800).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
          } catch {}
        })

        // Expose filter function via a custom event so the filter buttons (rendered via React state) can call it
        ;(svgEl as any).__applyFilter = (active: Set<string>) => {
          node.style('opacity', (d: any) => active.has(d.type) ? 1 : 0)
            .style('pointer-events', (d: any) => active.has(d.type) ? 'all' : 'none')
          link.style('opacity', (l: any) => active.has(l.source.type) && active.has(l.target.type) ? 0.5 : 0)
        }
      })
      .catch(() => setError(true))
  } // end initGraph

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      const svgEl = svgRef.current as any
      svgEl?.__applyFilter?.(next)
      return next
    })
  }

  const getColor = (type: string) =>
    typeof getComputedStyle !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue(`--c-${type}`).trim() || ''
      : ''

  return (
    <div className="graph-area" aria-label="BJJ knowledge graph">
      {loading && !error && <div className="graph-loading" id="graph-loading">Loading graph…</div>}
      {error && <div className="graph-loading">Failed to load graph.</div>}

      <div className="graph-filters" id="graph-filters">
        {types.map((t) => (
          <button
            key={t}
            className={`graph-filter-btn${activeTypes.has(t) ? ' active' : ''}`}
            style={{ '--fc': getColor(t) } as any}
            onClick={() => toggleType(t)}
          >
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <svg ref={svgRef} id="graph-svg" aria-hidden="true" style={{ width: '100%', height: 'calc(100vh - 52px)' }} />

      <div className="graph-legend" id="graph-legend">
        {types.map((t) => (
          <div key={t} className="graph-legend-row">
            <div className="graph-legend-dot" style={{ background: getColor(t) }} />
            <span>{t.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
