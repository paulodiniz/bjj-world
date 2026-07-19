'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { applyChipsToContainer } from '@/lib/useChips'
import { takePendingFile } from '@/lib/pendingFile'

const BADGE_LABELS: Record<string, string> = {
  position: 'position', transition: 'transition',
  submission_attempt: 'sub attempt', submission: 'submission ✓',
  escape: 'escape', takedown: 'takedown',
}

interface AnalysisEvent {
  timestamp: number; label: string; type: string; description: string
}
interface Analysis {
  id: string; title: string; summary?: string
  fighter_a?: string; fighter_b?: string
  events: AnalysisEvent[]; global_note?: string
  event_notes?: Record<string, string>; is_shared?: boolean
}

function TimelineRow({ ev, videoId, note, onNoteChange }: {
  ev: AnalysisEvent; videoId?: string; note?: string; onNoteChange?: (ts: string, v: string) => void
}) {
  const tsHref = videoId
    ? `https://www.youtube.com/watch?v=${videoId}&t=${ev.timestamp}s`
    : undefined
  return (
    <div className="timeline-row" data-type={ev.type}>
      {tsHref
        ? <a className="timeline-ts" href={tsHref} target="_blank" rel="noopener">{ev.label}</a>
        : <span className="timeline-ts">{ev.label}</span>}
      <span className={`timeline-badge ${ev.type}`}>{BADGE_LABELS[ev.type] || ev.type}</span>
      <div className="timeline-info">
        <span className="timeline-desc">{ev.description}</span>
        {onNoteChange && (
          <div className={`ev-note-body${note ? ' has-note' : ''}`}>
            <div
              className="ev-note-text"
              contentEditable
              suppressContentEditableWarning
              data-ts={String(ev.timestamp ?? 0)}
              onBlur={(e) => onNoteChange(String(ev.timestamp ?? 0), e.currentTarget.textContent || '')}
            >{note || ''}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalysisPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState('')
  const [streamEvents, setStreamEvents] = useState<AnalysisEvent[]>([])
  const [streamSummary, setStreamSummary] = useState('')
  const [streamTitle, setStreamTitle] = useState('')
  const [streamVideoId, setStreamVideoId] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [globalNote, setGlobalNote] = useState('')
  const [eventNotes, setEventNotes] = useState<Record<string, string>>({})
  const [shareUrl, setShareUrl] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check for pending file upload (navigated from home page)
    const file = takePendingFile()
    if (file) { startFileAnalysis(file); return }

    if (id === 'new') return

    fetch(`/api/analyses/${id}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Analysis) => {
        setAnalysis(data)
        setGlobalNote(data.global_note || '')
        setEventNotes(data.event_notes || {})
        setIsShared(data.is_shared || false)
        if (data.is_shared) fetchShareUrl()
        document.title = `${data.title} — Tapcodex`
      })
      .catch(() => setNotFound(true))
  }, [id]) // eslint-disable-line

  useEffect(() => {
    if (timelineRef.current) applyChipsToContainer(timelineRef.current)
  }, [streamEvents, analysis])

  async function startFileAnalysis(file: File) {
    setStreaming(true)
    setStreamStatus(`Uploading ${(file.size / 1e6).toFixed(1)} MB…`)
    const formData = new FormData()
    formData.append('video', file)
    try {
      const res = await fetch('/api/analyze-upload', { method: 'POST', body: formData, credentials: 'include' })
      await streamAnalysis(res)
    } catch (e: any) {
      if (e.name !== 'AbortError') setStreamStatus('Upload failed — try again.')
    } finally { setStreaming(false) }
  }

  async function streamAnalysis(res: Response) {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n'); buf = parts.pop() || ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data: ')) continue
        try {
          const ev = JSON.parse(line.slice(6))
          if (ev.type === 'status') setStreamStatus(ev.text)
          else if (ev.type === 'video-info') { setStreamTitle(ev.title); setStreamVideoId(ev.videoId || ''); setStreamStatus('') }
          else if (ev.type === 'analysis-summary') setStreamSummary(ev.summary)
          else if (ev.type === 'analysis-event') setStreamEvents((p) => [...p, ev])
          else if (ev.type === 'analysis_id') window.history.replaceState(null, '', `/a/${ev.id}`)
          else if (ev.type === 'done') { setStreaming(false); setStreamStatus('') }
          else if (ev.type === 'error') { setStreamStatus(`Error: ${ev.text}`); setStreaming(false) }
        } catch {}
      }
    }
  }

  const fetchShareUrl = async () => {
    const r = await fetch(`/api/analyses/${id}/share`, { method: 'POST', credentials: 'include' })
    const d = await r.json()
    setShareUrl(d.share_url)
  }

  const handleShare = async () => {
    await fetchShareUrl()
    setIsShared(true)
  }

  const handleRevoke = async () => {
    await fetch(`/api/analyses/${id}/share`, { method: 'DELETE', credentials: 'include' })
    setIsShared(false); setShareUrl('')
  }

  const saveNotes = async () => {
    await fetch(`/api/analyses/${id}/notes`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_note: globalNote, event_notes: eventNotes }),
    })
    setNoteSaved(true); setTimeout(() => setNoteSaved(false), 1800)
  }

  const updateEventNote = (ts: string, val: string) => {
    setEventNotes((p) => ({ ...p, [ts]: val }))
    saveNotes()
  }

  if (notFound) return (
    <div className="results-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--ink-3)' }}>Analysis not found.</p>
      <Link href="/" style={{ color: 'var(--accent-text)', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>← Home</Link>
    </div>
  )

  const title = analysis?.title || streamTitle
  const summary = analysis?.summary || streamSummary
  const events = analysis?.events || streamEvents
  const videoId = streamVideoId

  return (
    <div className="results-area" style={{ display: 'flex' }} role="main">
      <div className="entries">
        <div className="entry">
          <div className="entry-q">
            <span className="entry-q-glyph" aria-hidden="true">▶</span>
            <span className="entry-q-text">{title || 'Video Analysis'}</span>
          </div>
          <div className={`entry-a${streaming ? '' : ''}`}>
            {streamStatus && (
              <div className="entry-status">
                <span className="status-dot" aria-hidden="true" />
                <span className="status-label">{streamStatus}</span>
              </div>
            )}

            {title && (
              <div className="fight-header">
                {videoId && (
                  <div className="fight-embed">
                    <iframe src={`https://www.youtube.com/embed/${videoId}`}
                      title={`${title} — BJJ match`} allowFullScreen loading="lazy" />
                  </div>
                )}
                <div className="fight-meta">
                  <div className="fight-title">{title}</div>
                  {summary && <div className="fight-summary">{summary}</div>}
                  {analysis?.fighter_a && analysis.fighter_a !== 'Fighter A' && (
                    <div className="fight-fighters">{analysis.fighter_a} vs {analysis.fighter_b}</div>
                  )}
                </div>
              </div>
            )}

            {analysis && (
              <>
                <div className="an-share-panel">
                  <div className="an-share-head">
                    <span className="an-share-label">{isShared ? 'Shared' : 'Share this analysis'}</span>
                    {!isShared && <button className="an-share-toggle" onClick={handleShare}>Share</button>}
                  </div>
                  {isShared && shareUrl && (
                    <div className="an-share-body" style={{ display: 'flex' }}>
                      <span className="an-share-link">{shareUrl}</span>
                      <button className="an-copy-btn" onClick={() => { navigator.clipboard.writeText(shareUrl) }}>Copy</button>
                      <button className="an-revoke-btn" onClick={handleRevoke}>Revoke</button>
                    </div>
                  )}
                </div>

                <div className="an-notes-section">
                  <div className="an-notes-label">
                    <span>Your notes</span>
                    {noteSaved && <span className="an-notes-saved">✓ Saved</span>}
                  </div>
                  <textarea className="an-notes-textarea"
                    placeholder="Add coaching notes…"
                    value={globalNote} onChange={(e) => setGlobalNote(e.target.value)}
                    onBlur={saveNotes} />
                </div>
              </>
            )}

            <div className="fight-timeline" ref={timelineRef}>
              {events.map((ev, i) => (
                <TimelineRow key={i} ev={ev} videoId={videoId || undefined}
                  note={eventNotes[String(ev.timestamp ?? 0)]}
                  onNoteChange={analysis ? updateEventNote : undefined} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
