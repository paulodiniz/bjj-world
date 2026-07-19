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
    <div className="path-area" style={{ display: 'block' }} role="main" aria-label="Path Finder">
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
          <div aria-live="polite">
            {result.error ? (
              <p className="path-no-result">{result.error}</p>
            ) : result.found && result.steps?.length > 0 ? (
              <>
                <p className="path-meta"><strong>{result.steps.length - 1}</strong> step{result.steps.length !== 2 ? 's' : ''}</p>
                <div className="step-sequence">
                  {result.steps.map((step: any, idx: number) => (
                    <div key={idx} className="step-item">
                      <div className="step-node">
                        <span className={`step-badge ${step.type}`}>{step.type.replace(/_/g, ' ')}</span>
                        <a href={`/technique/${encodeURIComponent(step.id)}`} className="step-name">{step.name}</a>
                      </div>
                      {result.transitions[idx] && (
                        <div className="step-connector">
                          <div className="step-line" />
                          <span className="step-rel">{result.transitions[idx].toLowerCase().replace(/_/g, ' ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="path-no-result">No path found between these positions.</p>
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
