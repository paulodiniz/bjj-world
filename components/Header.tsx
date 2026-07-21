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
  const [menuPos, setMenuPos] = useState({ top: 56, right: 16 })
  const [query, setQuery] = useState('')
  const [streaming, setStreaming] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then(setUser)
    const onRefresh = () => { clearUserCache(); getCurrentUser().then(setUser) }
    const onStart = () => setStreaming(true)
    const onEnd = () => setStreaming(false)
    window.addEventListener('auth:refresh', onRefresh)
    window.addEventListener('streaming:start', onStart)
    window.addEventListener('streaming:end', onEnd)
    return () => {
      window.removeEventListener('auth:refresh', onRefresh)
      window.removeEventListener('streaming:start', onStart)
      window.removeEventListener('streaming:end', onEnd)
    }
  }, [])

  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setShowMenu(v => !v)
  }

  const handleSignOut = async () => {
    setShowMenu(false)
    await logout()
    clearUserCache()
    setUser(null)
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
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask about any technique or position…"
          aria-label="Your question"
        />
      </form>

      <div className="header-actions">
        {streaming
          ? <button type="button" className="header-btn stop-btn" onClick={triggerStop}>Stop</button>
          : <button type="submit" form="header-form" className="header-btn">Ask</button>
        }
        <Link href="/path" className="path-toggle-btn">Path →</Link>
        <Link href="/graph" className="path-toggle-btn">Graph</Link>
        {user?.plan === 'coach' && <Link href="/prep" className="path-toggle-btn">Prep</Link>}

        {user ? (
          <>
            <button
              ref={btnRef}
              className="user-btn"
              onClick={handleUserBtn}
              aria-label="Account menu"
              aria-expanded={showMenu}
            >
              <span className="user-btn-dot" />
              <span aria-hidden="true" style={{ fontSize: '0.55rem', opacity: 0.6, lineHeight: 1 }}>▾</span>
            </button>

            {showMenu && (
              <div
                ref={menuRef}
                className="user-menu"
                style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, display: 'block' }}
                role="menu"
              >
                <div style={{ padding: '6px 12px 4px', fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--ink-3)', borderBottom: '1px solid var(--border-sub)', marginBottom: '4px' }}>
                  {user.email}
                </div>
                <Link href="/history" className="user-menu-item" role="menuitem" onClick={() => setShowMenu(false)}>History</Link>
                <Link href="/profile" className="user-menu-item" role="menuitem" onClick={() => setShowMenu(false)}>My game profile</Link>
                <Link href="/studies" className="user-menu-item" role="menuitem" onClick={() => setShowMenu(false)}>My studies</Link>
                {user.plan === 'coach' && (
                  <Link href="/prep" className="user-menu-item" role="menuitem" onClick={() => setShowMenu(false)}>Class Prep</Link>
                )}
                <button
                  className="user-menu-item danger"
                  role="menuitem"
                  onClick={handleSignOut}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                >
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
