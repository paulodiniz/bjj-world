'use client'

import { useEffect, useRef, useState } from 'react'
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

function DrillPips({ total, completed, flash }: { total: number; completed: number; flash: boolean }) {
  if (total === 0) return null
  return (
    <div
      className={`study-pips${flash ? ' flash' : ''}`}
      role="img"
      aria-label={`${completed} of ${total} drills completed`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`study-pip${i < completed ? ' filled' : ''}`}
          style={flash ? { animationDelay: `${i * 25}ms` } : undefined}
        />
      ))}
    </div>
  )
}

function GeneratingCard({ goal }: { goal: string }) {
  return (
    <div className="study-generating" aria-live="polite">
      <div className="study-generating-sweep" aria-hidden="true" />
      <div className="study-generating-body">
        <span className="study-generating-label">Building training plan</span>
        <span className="study-generating-goal">{goal}</span>
      </div>
      <div className="study-generating-dots" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  )
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
  const [pendingGoal, setPendingGoal] = useState('')
  const [createError, setCreateError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const prevStudiesRef = useRef<Study[]>([])
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

  // Detect newly-completed studies and trigger the flash
  useEffect(() => {
    const prev = prevStudiesRef.current
    const newlyDone: string[] = []
    studies.forEach((study) => {
      if (study.total_drills === 0) return
      const prevStudy = prev.find(s => s.id === study.id)
      if (prevStudy && prevStudy.completed_drills < prevStudy.total_drills && study.completed_drills === study.total_drills) {
        newlyDone.push(study.id)
      }
    })
    if (newlyDone.length) {
      setFlashIds(s => new Set([...s, ...newlyDone]))
      const t = setTimeout(() => {
        setFlashIds(s => { const n = new Set(s); newlyDone.forEach(id => n.delete(id)); return n })
      }, 1600)
      return () => clearTimeout(t)
    }
    prevStudiesRef.current = studies
  }, [studies])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goal.trim() || creating) return
    const goalText = goal.trim()
    setPendingGoal(goalText)
    setCreating(true)
    setCreateError('')
    setShowForm(false)
    try {
      const study = await createStudy(goalText, youtubeUrl.trim() || null, count)
      setStudies(prev => [study, ...prev])
      setExpandedId(study.id)
      setGoal('')
      setYoutubeUrl('')
      setCount(3)
    } catch {
      setCreateError('Something went wrong. Try again.')
      setShowForm(true)
    } finally {
      setCreating(false)
      setPendingGoal('')
    }
  }

  const handleDelete = async (id: string) => {
    await deleteStudy(id)
    setStudies(prev => prev.filter(s => s.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const handleToggle = async (studyId: string, impId: string, drillId: string, current: boolean) => {
    const next = !current
    setStudies(prev => prev.map(s => {
      if (s.id !== studyId) return s
      const improvements = (s.improvements || []).map(imp => {
        if (imp.id !== impId) return imp
        return { ...imp, drills: imp.drills.map(d => d.id === drillId ? { ...d, completed: next } : d) }
      })
      const completed_drills = improvements.flatMap(i => i.drills).filter(d => d.completed).length
      return { ...s, improvements, completed_drills }
    }))
    try {
      await toggleDrill(studyId, drillId, next)
    } catch {
      setStudies(prev => prev.map(s => {
        if (s.id !== studyId) return s
        const improvements = (s.improvements || []).map(imp => {
          if (imp.id !== impId) return imp
          return { ...imp, drills: imp.drills.map(d => d.id === drillId ? { ...d, completed: current } : d) }
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
          {!showForm && !creating && (
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
              />
            </div>

            <div className="studies-form-row">
              <div className="studies-form-field" style={{ flex: 1 }}>
                <label className="studies-form-label">Improvement areas</label>
                <div className="studies-count-btns">
                  {[3, 4, 5].map((n) => (
                    <button key={n} type="button"
                      className={`studies-count-btn${count === n ? ' active' : ''}`}
                      onClick={() => setCount(n)}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div className="studies-form-actions">
                <button type="button" className="studies-cancel-btn"
                  onClick={() => { setShowForm(false); setCreateError('') }}>
                  Cancel
                </button>
                <button type="submit" className="studies-submit-btn" disabled={!goal.trim()}>
                  Generate
                </button>
              </div>
            </div>

            {createError && <p className="studies-form-error">{createError}</p>}
          </form>
        )}

        {creating && <GeneratingCard goal={pendingGoal} />}

        {loading && <p className="studies-empty">Loading…</p>}
        {!loading && unauthorized && <p className="studies-empty">Sign in to see your studies.</p>}
        {!loading && !unauthorized && studies.length === 0 && !showForm && !creating && (
          <p className="studies-empty">No studies yet. Create one to get started.</p>
        )}

        <div className="studies-list">
          {studies.map((study) => {
            const expanded = expandedId === study.id
            const pct = study.total_drills > 0 ? (study.completed_drills / study.total_drills) * 100 : 0
            const done = study.total_drills > 0 && study.completed_drills === study.total_drills
            const inProgress = pct > 0 && !done
            const flash = flashIds.has(study.id)

            return (
              <div key={study.id} className={[
                'study-card',
                expanded ? 'expanded' : '',
                done ? 'done' : inProgress ? 'in-progress' : '',
                flash ? 'flash' : '',
              ].filter(Boolean).join(' ')}>

                <div className="study-card-head" onClick={() => setExpandedId(expanded ? null : study.id)}>
                  <div className="study-card-goal">{study.goal}</div>
                  <div className="study-card-meta">
                    <DrillPips total={study.total_drills} completed={study.completed_drills} flash={flash} />
                    <span className="study-card-date">{relativeDate(study.created_at)}</span>
                    <span className="study-card-chevron" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
                    <button className="study-card-del" aria-label="Delete study"
                      onClick={(e) => { e.stopPropagation(); handleDelete(study.id) }}>✕</button>
                  </div>
                </div>

                {study.total_drills > 0 && (
                  <div className="study-card-track"
                    role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
                    aria-label={`${Math.round(pct)}% complete`}>
                    <div className="study-card-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {expanded && (
                  <div className="study-card-body">
                    {study.youtube_url && (
                      <a className="study-card-link" href={study.youtube_url} target="_blank" rel="noopener noreferrer">
                        ▶ Reference video
                      </a>
                    )}
                    <ol className="study-improvements">
                      {(study.improvements || []).map((imp) => {
                        const impDone = imp.drills.length > 0 && imp.drills.every(d => d.completed)
                        return (
                          <li key={imp.id} className={`study-improvement${impDone ? ' done' : ''}`}>
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
                        )
                      })}
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
