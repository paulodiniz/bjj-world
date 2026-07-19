'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { NodePicker } from '@/components/NodePicker'

declare const window: Window & { marked?: { parse: (s: string) => string } }

const DURATIONS = [30, 45, 60, 90]
const ALL_TYPES = ['position', 'technique', 'submission', 'guard_pass', 'concept', 'system', 'sweep', 'takedown', 'escape', 'counter']

export default function PrepPage() {
  const [ready, setReady] = useState(false)
  const [techniqueId, setTechniqueId] = useState<string[]>([])
  const [duration, setDuration] = useState(60)
  const [status, setStatus] = useState('')
  const [plan, setPlan] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u || u.plan !== 'coach') { router.push('/'); return }
      setReady(true)
    })
  }, [router])

  const reset = () => { setPlan(''); setError(''); setStatus(''); setDone(false) }

  const handleGenerate = async () => {
    if (!techniqueId.length) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setGenerating(true)
    reset()

    try {
      const res = await fetch('/api/prep/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technique_id: techniqueId[0], duration }),
        credentials: 'include',
        signal: abortRef.current.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        sseBuffer += decoder.decode(value, { stream: true })
        const parts = sseBuffer.split('\n\n')
        sseBuffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'status') setStatus(event.text)
            else if (event.type === 'token') {
              setStatus('')
              buffer += event.text
              setPlan(window.marked ? window.marked.parse(buffer) : buffer)
            } else if (event.type === 'done') setDone(true)
            else if (event.type === 'error') setError(event.text)
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setError('Something went wrong — try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (!ready) return <div className="prep-area" />

  return (
    <div className="prep-area" role="main" aria-label="Class prep">
      <div className="prep-inner" id="prep-content">
        <div className="prep-head">
          <h2 className="prep-title">Class Prep</h2>
          <p className="prep-sub">Pick a technique — get a mat-ready lesson plan from the knowledge graph</p>
        </div>

        <div className="prep-form">
          <div className="prep-field">
            <NodePicker label="Technique or position" types={ALL_TYPES} value={techniqueId} onChange={setTechniqueId} />
          </div>

          <div className="prep-field">
            <span className="prep-field-label" id="prep-label-duration">Session length</span>
            <div className="prep-duration-options" role="group" aria-labelledby="prep-label-duration">
              {DURATIONS.map((d) => (
                <button key={d} type="button" className={`prep-duration-btn${d === duration ? ' active' : ''}`}
                  aria-pressed={d === duration} onClick={() => setDuration(d)}>{d} min</button>
              ))}
            </div>
          </div>

          <button type="button" className="prep-generate-btn"
            disabled={generating || !techniqueId.length} onClick={handleGenerate}>
            {generating ? 'Generating…' : 'Generate plan'}
          </button>
        </div>

        {(status || plan || error || done) && (
          <div className={`prep-plan${plan || error ? ' visible' : ''}`}>
            {status && (
              <div className="prep-status" style={{ display: 'flex' }}>
                <span className="prep-status-dot" aria-hidden="true" />
                <span>{status}</span>
              </div>
            )}
            {plan && <div className="prep-plan-body" dangerouslySetInnerHTML={{ __html: plan }} />}
            {error && <p className="prep-error">{error}</p>}
            {(done || error) && (
              <button type="button" className="prep-again-btn" onClick={() => { reset(); setGenerating(false) }}>
                ← Generate another
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
