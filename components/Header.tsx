'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCurrentUser, clearUserCache } from '@/lib/auth'
import type { User } from '@/lib/auth'
import { logout } from '@/lib/api'
import { triggerStop } from '@/lib/streamControl'

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [streaming, setStreaming] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then(setUser)
    const refresh = () => { clearUserCache(); getCurrentUser().then(setUser) }
    const onStart = () => setStreaming(true)
    const onEnd = () => setStreaming(false)
    window.addEventListener('auth:refresh', refresh)
    window.addEventListener('streaming:start', onStart)
    window.addEventListener('streaming:end', onEnd)
    return () => {
      window.removeEventListener('auth:refresh', refresh)
      window.removeEventListener('streaming:start', onStart)
      window.removeEventListener('streaming:end', onEnd)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    const id = crypto.randomUUID()
    sessionStorage.setItem(`pending_q_${id}`, query.trim())
    setQuery('')
    router.push(`/c/${id}`)
  }

  const handleSignOut = async () => {
    await logout()
    clearUserCache()
    setUser(null)
    setShowMenu(false)
    router.push('/')
  }

  return (
    <header className="app-header" aria-label="Tapcodex">
      <Link href="/" className="header-brand">
        <span className="header-brand-name">Tapcodex</span>
        <span className="header-brand-sub">knowledge graph</span>
      </Link>

      <form className="header-cmd" id="header-form" onSubmit={handleSearch}>
        <span className="header-cmd-glyph" aria-hidden="true">◎</span>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about any technique or position…" aria-label="Your question" />
      </form>

      <div className="header-actions">
        {streaming ? (
          <button type="button" className="header-btn stop-btn" onClick={triggerStop}>Stop</button>
        ) : (
          <button type="submit" form="header-form" className="header-btn">Ask</button>
        )}
        <Link href="/path" className="path-toggle-btn">Path →</Link>
        <Link href="/graph" className="graph-toggle-btn">Graph</Link>
        {user && <Link href="/history" className="history-toggle-btn">History</Link>}

        {user ? (
          <div style={{ position: 'relative' }}>
            <button className="user-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Account options">
              <span className="user-btn-dot" />
              <span className="user-btn-email">{user.email}</span>
            </button>
            {showMenu && (
              <div className="user-menu" style={{ display: 'block' }}>
                <Link href="/profile" className="user-menu-item" onClick={() => setShowMenu(false)}>My game profile</Link>
                <button onClick={handleSignOut} className="user-menu-item danger"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/signin" className="auth-btn">Sign in</Link>
        )}
      </div>
    </header>
  )
}
