'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStudies, createStudy, deleteStudy, toggleDrill } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'

interface Drill { id: string; text: string; completed: boolean }
interface Improvement { id: string; title: string; description: string; drills: Drill[] }
interface Study {
  id: string
  goal: string
  youtube_url: string | null
  created_at: string
  total_drills: number
  completed_drills: number
  improvements: Improvement[]
}

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

  const handleToggle = async (studyId: string, impId: string, drillId: string, current: boolean) => {
    const next = !current
    // Optimistic update
    setStudies((prev) => prev.map((s) => {
      if (s.id !== studyId) return s
      const improvements = s.improvements.map((imp) => {
        if (imp.id !== impId) return imp
        return { ...imp, drills: imp.drills.map((d) => d.id === drillId ? { ...d, completed: next } : d) }
      })
      const completed_drills = improvements.flatMap(i => i.drills).filter(d => d.completed).length
      return { ...s, improvements, completed_drills }
    }))
    try {
      await toggleDrill(studyId, drillId, next)
    } catch {
      // Revert on failure
      setStudies((prev) => prev.map((s) => {
        if (s.id !== studyId) return s
        const improvements = s.improvements.map((imp) => {
          if (imp.id !== impId) return imp
          return { ...imp, drills: imp.drills.map((d) => d.id === drillId ? { ...d, completed: current } : d) }
        })
        const completed_drills = improvements.flatMap(i => i.drills).filter(d => d.completed).length
        return { ...s, improvements, completed_drills }
      }))
    }
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
              <label className="studies-form-label">
                YouTube resource <span className="studies-form-optional">(optional — helps tailor drills)</span>
              </label>
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
                <label className="studies-form-label">Improvement areas</label>
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
            const pct = study.total_drills > 0 ? (study.completed_drills / study.total_drills) * 100 : 0
            const done = study.total_drills > 0 && study.completed_drills === study.total_drills

            return (
              <div key={study.id} className={`study-card${expanded ? ' expanded' : ''}${done ? ' done' : ''}`}>
                <div className="study-card-head" onClick={() => setExpandedId(expanded ? null : study.id)}>
                  <div className="study-card-goal">{study.goal}</div>
                  <div className="study-card-meta">
                    <span className="study-card-date">{relativeDate(study.created_at)}</span>
                    {study.total_drills > 0 && (
                      <span className={`study-card-progress-label${done ? ' done' : ''}`}>
                        {done ? '✓ done' : `${study.completed_drills}/${study.total_drills}`}
                      </span>
                    )}
                    <span className="study-card-chevron" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
                    <button
                      className="study-card-del"
                      aria-label="Delete study"
                      onClick={(e) => { e.stopPropagation(); handleDelete(study.id) }}
                    >✕</button>
                  </div>
                </div>

                {study.total_drills > 0 && (
                  <div className="study-card-progress-bar-track">
                    <div className="study-card-progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {expanded && (
                  <div className="study-card-body">
                    {study.youtube_url && (
                      <a className="study-card-link" href={study.youtube_url} target="_blank" rel="noopener noreferrer">
                        ▶ YouTube resource
                      </a>
                    )}
                    <ol className="study-improvements">
                      {(study.improvements || []).map((imp) => (
                        <li key={imp.id} className="study-improvement">
                          <div className="study-improvement-title">{imp.title}</div>
                          <div className="study-improvement-desc">{imp.description}</div>
                          {imp.drills.length > 0 && (
                            <ul className="study-drill-list">
                              {imp.drills.map((drill) => (
                                <li key={drill.id} className="study-drill">
                                  <label className="study-drill-label">
                                    <input
                                      type="checkbox"
                                      className="study-drill-checkbox"
                                      checked={drill.completed}
                                      onChange={() => handleToggle(study.id, imp.id, drill.id, drill.completed)}
                                    />
                                    <span className={`study-drill-text${drill.completed ? ' completed' : ''}`}>
                                      {drill.text}
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
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
