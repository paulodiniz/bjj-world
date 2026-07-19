'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import type { User } from '@/lib/auth'
import { Chat } from '@/components/Chat'
import { setPendingFile } from '@/lib/pendingFile'
import { getProfile } from '@/lib/api'

const hints = [
  'What can I attack from closed guard?',
  'How does Gordon Ryan approach back control?',
  'What are my options from half guard?',
]

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [showNudge, setShowNudge] = useState(false)
  const [query, setQuery] = useState('')
  const [activeConv, setActiveConv] = useState<{ id: string; question: string } | null>(null)
  const [uploadError, setUploadError] = useState('')
  const router = useRouter()

  const MAX_UPLOAD = 100 * 1024 * 1024

  const handleFile = (file: File) => {
    if (!file.type.startsWith('video/')) { setUploadError('Please upload a video file.'); return }
    if (file.size > MAX_UPLOAD) { setUploadError(`File too large (${(file.size / 1e6).toFixed(0)} MB — max 100 MB)`); return }
    setUploadError('')
    setPendingFile(file)
    router.push('/a/new')
  }

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u)
      if (u) {
        getProfile().then((data) => {
          const hasGame = data?.profile?.favourite_game?.length > 0
          setShowNudge(!hasGame)
        }).catch(() => {})
      }
    })
    const refresh = () => { getCurrentUser().then((u) => { setUser(u) }) }
    window.addEventListener('auth:refresh', refresh)
    return () => window.removeEventListener('auth:refresh', refresh)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    const id = crypto.randomUUID()
    window.history.replaceState(null, '', `/c/${id}`)
    setActiveConv({ id, question: query.trim() })
  }

  if (activeConv) {
    return (
      <div className="results-area" style={{ display: 'flex' }} role="main">
        <Chat
          conversationId={activeConv.id}
          initialMessages={[]}
          autoQuestion={activeConv.question}
        />
      </div>
    )
  }

  return (
    <div className="landing" role="main" aria-label="Tapcodex — knowledge graph">
      <div className="landing-topbar">
        {user ? (
          <button className="landing-user-btn">{user.email}</button>
        ) : (
          <Link href="/signin" className="landing-signin-btn">Sign in</Link>
        )}
      </div>

      <div className="landing-brand">
        <h1 className="landing-title">Tapcodex</h1>
        <p className="landing-sub">knowledge graph</p>
      </div>

      <form className="landing-cmd" onSubmit={handleSubmit}>
        <span className="landing-cmd-glyph" aria-hidden="true">◎</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about any technique, position, or path…"
          aria-label="Your question"
          autoFocus
        />
        <button type="submit" className="landing-ask-btn">Ask</button>
      </form>

      <div className="hint-pills" role="list" aria-label="Example questions">
        {hints.map((hint) => (
          <button key={hint} className="hint-pill" role="listitem" type="button"
            onClick={() => setQuery(hint)}>
            {hint}
          </button>
        ))}
      </div>

      {user && showNudge && (
        <div className="profile-nudge" role="complementary">
          <span className="profile-nudge-text">Personalise your answers —</span>
          <Link href="/profile" className="profile-nudge-btn">Set up your game →</Link>
        </div>
      )}

      <nav className="landing-modes" aria-label="Explore tools">
        <Link href="/path" className="landing-mode">
          <span className="landing-mode-glyph" aria-hidden="true">◆</span>
          <span className="landing-mode-body">
            <span className="landing-mode-name">Path Finder</span>
            <span className="landing-mode-desc">Shortest route between any two positions</span>
          </span>
          <span className="landing-mode-arrow" aria-hidden="true">→</span>
        </Link>

        <Link href="/graph" className="landing-mode">
          <span className="landing-mode-glyph" aria-hidden="true">⬡</span>
          <span className="landing-mode-body">
            <span className="landing-mode-name">Graph</span>
            <span className="landing-mode-desc">Explore 180+ nodes as a live knowledge map</span>
          </span>
          <span className="landing-mode-arrow" aria-hidden="true">→</span>
        </Link>

        <label className="landing-mode" style={{ cursor: 'pointer' }}>
          <span className="landing-mode-glyph" aria-hidden="true">▶</span>
          <span className="landing-mode-body">
            <span className="landing-mode-name">Video Analysis</span>
            <span className="landing-mode-desc">Upload a match — AI reads every position</span>
          </span>
          <span className="landing-mode-arrow" aria-hidden="true">→</span>
          <input type="file" accept="video/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = '' }} />
        </label>

        {user && (
          <Link href="/history" className="landing-mode">
            <span className="landing-mode-glyph" aria-hidden="true">◷</span>
            <span className="landing-mode-body">
              <span className="landing-mode-name">Recent</span>
              <span className="landing-mode-desc">Your saved conversations</span>
            </span>
            <span className="landing-mode-arrow" aria-hidden="true">→</span>
          </Link>
        )}

        {user?.plan === 'coach' && (
          <Link href="/prep" className="landing-mode">
            <span className="landing-mode-glyph" aria-hidden="true">⊡</span>
            <span className="landing-mode-body">
              <span className="landing-mode-name">Class Prep</span>
              <span className="landing-mode-desc">Generate a lesson plan from the knowledge graph</span>
            </span>
            <span className="landing-mode-arrow" aria-hidden="true">→</span>
          </Link>
        )}
      </nav>

      <label className="upload-zone"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.classList.remove('drag-over') }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <span className="upload-zone-glyph" aria-hidden="true">↑</span>
        <span className="upload-zone-text">or drag and drop a video file here</span>
        <span className="upload-zone-meta">mp4 · mov · webm · up to 100 MB</span>
        {uploadError && <span className="upload-zone-error">{uploadError}</span>}
        <input type="file" accept="video/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </label>
    </div>
  )
}
