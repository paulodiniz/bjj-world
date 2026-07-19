'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import type { User } from '@/lib/auth'
import { Chat } from '@/components/Chat'

const hints = [
  'What can I attack from closed guard?',
  'How does Gordon Ryan approach back control?',
  'What are my options from half guard?',
]

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [activeConv, setActiveConv] = useState<{ id: string; question: string } | null>(null)

  useEffect(() => {
    getCurrentUser().then(setUser)
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

      {user && (
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
      </nav>
    </div>
  )
}
