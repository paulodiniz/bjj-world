'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStudies, createStudy, deleteStudy } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'

interface Improvement { id: string; title: string; description: string }
interface Study { id: string; goal: string; youtube_url: string | null; created_at: string; improvements: Improvement[] }

function relativeDate(iso: string) {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  if (dDay >= today) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (dDay >= yesterday) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function StudiesPage() {
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [goal, setGoal] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [count, setCount] = useState(3)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u) { router.push('/signin'); return }
      getStudies()
        .then((d) => { setStudies(d.studies || []); setLoading(false) })
        .catch((e) => {
          if (String(e).includes('401')) setUnauthorized(true)
          setLoading(false)
        })
    })
  }, []) // eslint-disable-line

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goal.trim() || creating) return
    setCreating(true)
    setCreateError('')
    try {
      const study = await createStudy(goal.trim(), youtubeUrl.trim() || null, count)
      setStudies((prev) => [study, ...prev])
      setExpandedId(study.id)
      setGoal('')
      setYoutubeUrl('')
      setCount(3)
      setShowForm(false)
    } catch {
      setCreateError('Something went wrong. Try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteStudy(id)
    setStudies((prev) => prev.filter((s) => s.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  return (
    <div className="studies-area" style={{ display: 'block' }} role="main" aria-label="My studies">
      <div className="studies-inner">
        <div className="studies-head">
          <h2 className="studies-title">My Studies</h2>
          {!showForm && (
            <button className="studies-new-btn" onClick={() => setShowForm(true)}>+ New study</button>
          )}
        </div>

        {showForm && (
          <form className="studies-form" onSubmit={handleCreate}>
            <div className="studies-form-field">
              <label className="studies-form-label">What do you want to improve?</label>
              <textarea
                className="studies-form-textarea"
                placeholder="e.g. I want to improve my closed guard…"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={2}
                autoFocus
                disabled={creating}
              />
            </div>

            <div className="studies-form-field">
              <label className="studies-form-label">YouTube resource <span className="studies-form-optional">(optional — helps tailor suggestions)</span></label>
              <input
                type="url"
                className="studies-form-input"
                placeholder="https://www.youtube.com/watch?v=…"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={creating}
              />
            </div>

            <div className="studies-form-row">
              <div className="studies-form-field" style={{ flex: 1 }}>
                <label className="studies-form-label">Improvements to generate</label>
                <div className="studies-count-btns">
                  {[3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`studies-count-btn${count === n ? ' active' : ''}`}
                      onClick={() => setCount(n)}
                      disabled={creating}
                    >{n}</button>
                  ))}
                </div>
              </div>

              <div className="studies-form-actions">
                <button type="button" className="studies-cancel-btn" onClick={() => { setShowForm(false); setCreateError('') }} disabled={creating}>
                  Cancel
                </button>
                <button type="submit" className="studies-submit-btn" disabled={!goal.trim() || creating}>
                  {creating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>

            {createError && <p className="studies-form-error">{createError}</p>}
          </form>
        )}

        {loading && <p className="studies-empty">Loading…</p>}
        {!loading && unauthorized && <p className="studies-empty">Sign in to see your studies.</p>}
        {!loading && !unauthorized && studies.length === 0 && !showForm && (
          <p className="studies-empty">No studies yet. Create one to get started.</p>
        )}

        <div className="studies-list">
          {studies.map((study) => {
            const expanded = expandedId === study.id
            return (
              <div key={study.id} className={`study-card${expanded ? ' expanded' : ''}`}>
                <div className="study-card-head" onClick={() => setExpandedId(expanded ? null : study.id)}>
                  <div className="study-card-goal">{study.goal}</div>
                  <div className="study-card-meta">
                    <span className="study-card-date">{relativeDate(study.created_at)}</span>
                    <span className="study-card-count">{study.improvements.length} improvements</span>
                    <span className="study-card-chevron" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
                    <button
                      className="study-card-del"
                      aria-label="Delete study"
                      onClick={(e) => { e.stopPropagation(); handleDelete(study.id) }}
                    >✕</button>
                  </div>
                </div>

                {expanded && (
                  <div className="study-card-body">
                    {study.youtube_url && (
                      <a className="study-card-link" href={study.youtube_url} target="_blank" rel="noopener noreferrer">
                        ▶ YouTube resource
                      </a>
                    )}
                    <ol className="study-improvements">
                      {study.improvements.map((imp) => (
                        <li key={imp.id} className="study-improvement">
                          <div className="study-improvement-title">{imp.title}</div>
                          <div className="study-improvement-desc">{imp.description}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
