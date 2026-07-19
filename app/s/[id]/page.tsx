'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { applyChipsToContainer } from '@/lib/useChips'

const BADGE_LABELS: Record<string, string> = {
  position: 'position', transition: 'transition',
  submission_attempt: 'sub attempt', submission: 'submission ✓',
  escape: 'escape', takedown: 'takedown',
}

export default function SharedAnalysisPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { setData(d); document.title = `${d.title} — Tapcodex` })
      .catch(() => setError(true))
  }, [id])

  useEffect(() => {
    if (timelineRef.current) applyChipsToContainer(timelineRef.current)
  }, [data])

  if (error) return (
    <div className="shared-area" role="main">
      <div className="shared-inner">
        <p style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--ink-3)' }}>
          This analysis is no longer shared or doesn't exist.
        </p>
        <Link href="/" style={{ color: 'var(--accent-text)', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>Try Tapcodex →</Link>
      </div>
    </div>
  )

  if (!data) return <div className="shared-area" role="main"><div className="shared-inner" /></div>

  const eventNotes: Record<string, string> = data.event_notes || {}

  return (
    <div className="shared-area" role="main" aria-label={data.title}>
      <div className="shared-inner">
        <h1 className="shared-title">{data.title}</h1>
        {data.fighter_a && data.fighter_a !== 'Fighter A' && (
          <div className="shared-fighters">{data.fighter_a} vs {data.fighter_b}</div>
        )}
        {data.summary && <p className="shared-summary">{data.summary}</p>}

        {data.global_note && (
          <div className="shared-coach-note">
            <div className="shared-coach-note-byline">Coach notes</div>
            <div className="shared-coach-note-body">{data.global_note}</div>
          </div>
        )}

        <div className="fight-timeline" ref={timelineRef}>
          {(data.events || []).map((ev: any, i: number) => {
            const tsKey = String(ev.timestamp ?? 0)
            const note = eventNotes[tsKey]
            return (
              <div key={i} className="timeline-row" data-type={ev.type}>
                <span className="timeline-ts">{ev.label}</span>
                <span className={`timeline-badge ${ev.type}`}>{BADGE_LABELS[ev.type] || ev.type}</span>
                <div className="timeline-info">
                  <span className="timeline-desc">{ev.description}</span>
                  {note && <div className="shared-ev-note">{note}</div>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="shared-bottom-cta">
          <span className="shared-bottom-cta-text">Analyse your own matches</span>
          <Link href="/" className="shared-bottom-cta-link">Try Tapcodex →</Link>
        </div>
      </div>
    </div>
  )
}
