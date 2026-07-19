'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getNodes, getPath } from '@/lib/api'

interface Node { id: string; name: string; type: string }

function PathFinder() {
  const searchParams = useSearchParams()
  const [nodes, setNodes] = useState<Node[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(searchParams.get('to') || '')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingNodes, setLoadingNodes] = useState(true)

  useEffect(() => {
    getNodes().then((data) => {
      setNodes(Array.isArray(data) ? data : [])
    }).finally(() => setLoadingNodes(false))
  }, [])

  const handleFind = async () => {
    const fromNode = nodes.find((n) => n.name.toLowerCase() === from.toLowerCase())
    const toNode = nodes.find((n) => n.name.toLowerCase() === to.toLowerCase())
    if (!fromNode || !toNode) return
    setLoading(true)
    setResult(null)
    try {
      const data = await getPath(fromNode.id, toNode.id)
      setResult(data)
    } catch {
      setResult({ found: false, error: 'Failed to find path' })
    } finally {
      setLoading(false)
    }
  }

  const fromMatches = nodes.filter((n) => n.name.toLowerCase().includes(from.toLowerCase())).slice(0, 10)
  const toMatches = nodes.filter((n) => n.name.toLowerCase().includes(to.toLowerCase())).slice(0, 10)

  return (
    <div className="path-area" role="main" aria-label="Path Finder">
      <div className="path-inner">
        <div className="path-head">
          <h2 className="path-title">Path Finder</h2>
          <p className="path-sub">Shortest route between any two positions</p>
        </div>

        {loadingNodes ? <p style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--ink-3)' }}>Loading…</p> : (
          <div className="path-controls">
            <div className="path-field">
              <label className="path-field-label" htmlFor="path-from">FROM</label>
              <input id="path-from" className="path-combobox" type="text" value={from}
                onChange={(e) => setFrom(e.target.value)} placeholder="Search techniques…" list="path-from-list" />
              <datalist id="path-from-list">
                {fromMatches.map((n) => <option key={n.id} value={n.name} />)}
              </datalist>
            </div>

            <div className="path-field">
              <label className="path-field-label" htmlFor="path-to">TO</label>
              <input id="path-to" className="path-combobox" type="text" value={to}
                onChange={(e) => setTo(e.target.value)} placeholder="Search techniques…" list="path-to-list" />
              <datalist id="path-to-list">
                {toMatches.map((n) => <option key={n.id} value={n.name} />)}
              </datalist>
            </div>

            <button className="path-find-btn" type="button" onClick={handleFind}
              disabled={loading || !from || !to}>
              {loading ? 'Finding…' : 'Find path'}
            </button>
          </div>
        )}

        {result && (
          <div id="path-result" aria-live="polite" style={{ marginTop: '32px' }}>
            {result.error ? (
              <p style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{result.error}</p>
            ) : result.found && result.steps?.length > 0 ? (
              <div className="path-result">
                <p className="path-result-meta">{result.steps.length - 1} step{result.steps.length !== 2 ? 's' : ''}</p>
                <ol className="path-steps">
                  {result.steps.map((step: any, idx: number) => (
                    <li key={idx} className="path-step">
                      <a href={`/technique/${encodeURIComponent(step.id)}`} className={`nc nc-${step.type}`}>{step.name}</a>
                      {result.transitions[idx] && (
                        <span style={{ color: 'var(--ink-3)', fontSize: '0.75rem', marginLeft: 8 }}>
                          {result.transitions[idx].toLowerCase().replace(/_/g, ' ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>No path found between these positions.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PathPage() {
  return <Suspense><PathFinder /></Suspense>
}
