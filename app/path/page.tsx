'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { marked } from 'marked'
import { getNodes, getPath, chatStream } from '@/lib/api'

const PATH_TYPES = ['position', 'submission', 'sweep', 'guard_pass', 'takedown', 'escape']

interface Node { id: string; name: string; type: string }

function PathFinder() {
  const searchParams = useSearchParams()
  const [nodes, setNodes] = useState<Node[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(searchParams.get('to') || '')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingNodes, setLoadingNodes] = useState(true)
  const [explanation, setExplanation] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    getNodes().then((data) => {
      const relevant = (Array.isArray(data) ? data : []).filter((n: Node) => PATH_TYPES.includes(n.type))
      setNodes(relevant)
    }).finally(() => setLoadingNodes(false))
  }, [])

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.name.toLowerCase(), n]))

  const handleFind = async () => {
    const fromNode = nodeMap[from.trim().toLowerCase()]
    const toNode = nodeMap[to.trim().toLowerCase()]
    if (!fromNode || !toNode) {
      setResult({ error: 'Type an exact technique name from the suggestions.' })
      return
    }
    if (fromNode.id === toNode.id) {
      setResult({ error: 'Pick two different techniques.' })
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setResult(null)
    setExplanation('')

    try {
      const data = await getPath(fromNode.id, toNode.id)
      setResult(data)

      if (data.found && data.steps?.length > 1) {
        const transitionLines = data.steps.slice(0, -1).map((s: any, i: number) =>
          `${i + 1}. ${s.name} → ${data.steps[i + 1].name}`
        ).join('\n')

        const prompt = `You are an experienced BJJ coach narrating a technique path for a student.\n\nTechnique chain:\n${transitionLines}\n\nFor each numbered transition, write a short coaching breakdown:\n- **What to do**: the 1–2 mechanical actions that execute this transition\n- **Key detail**: the single thing that makes or breaks it\n- **Beginner trap**: the most common mistake at this exact moment\n\nKeep each transition to 3–4 sentences. Be specific and practical.`

        const signal = abortRef.current.signal
        for await (const ev of chatStream(prompt, [], undefined, signal)) {
          if (ev.type === 'token') setExplanation((t) => t + ev.text)
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') setResult({ error: 'Something went wrong — try again.' })
    } finally {
      setLoading(false)
    }
  }

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
                onChange={(e) => setFrom(e.target.value)} placeholder="Search techniques…" list="path-nodes-list" />
            </div>

            <div className="path-field">
              <label className="path-field-label" htmlFor="path-to">TO</label>
              <input id="path-to" className="path-combobox" type="text" value={to}
                onChange={(e) => setTo(e.target.value)} placeholder="Search techniques…" list="path-nodes-list" />
            </div>

            <datalist id="path-nodes-list">
              {nodes.map((n) => <option key={n.id} value={n.name} />)}
            </datalist>

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
                <p className="path-meta">
                  <strong>{result.steps.length}</strong> steps — <strong>{result.steps[0].name}</strong> to <strong>{result.steps[result.steps.length - 1].name}</strong>
                </p>
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
                {explanation && (
                  <>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--ink-3)', marginTop: 28, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Coach&apos;s walkthrough
                    </p>
                    <div id="path-explanation"
                      dangerouslySetInnerHTML={{ __html: marked.parse(explanation) as string }} />
                  </>
                )}
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
