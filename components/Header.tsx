'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCurrentUser, clearUserCache } from '@/lib/auth'
import type { User } from '@/lib/auth'
import { logout } from '@/lib/api'
import { triggerStop } from '@/lib/streamControl'

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const [query, setQuery] = useState('')
  const [streaming, setStreaming] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
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

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.closest('div')?.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showMenu])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    const id = crypto.randomUUID()
    sessionStorage.setItem(`pending_q_${id}`, query.trim())
    setQuery('')
    router.push(`/c/${id}`)
  }

  const handleUserBtn = () => {
    if (!showMenu && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setShowMenu((v) => !v)
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
        <Link href="/graph" className="path-toggle-btn">Graph</Link>
        {user?.plan === 'coach' && <Link href="/prep" className="path-toggle-btn">Prep</Link>}

        {user ? (
          <>
            <button ref={btnRef} className="user-btn" onClick={handleUserBtn} aria-label="Account options">
              <span className="user-btn-dot" />
              <span className="user-btn-email">{user.email}</span>
              <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>▾</span>
            </button>
            {showMenu && (
              <div className="user-menu" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}>
                <Link href="/history" className="user-menu-item" onClick={() => setShowMenu(false)}>History</Link>
                <Link href="/profile" className="user-menu-item" onClick={() => setShowMenu(false)}>My game profile</Link>
                <button onClick={handleSignOut} className="user-menu-item danger"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                  Sign out
                </button>
              </div>
            )}
          </>
        ) : (
          <Link href="/signin" className="auth-btn">Sign in</Link>
        )}
      </div>
    </header>
  )
}
