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

  const close = () => setShowMenu(false)

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
              <span className="user-btn-chevron" aria-hidden="true">▾</span>
            </button>

            {showMenu && (
              <div
                ref={menuRef}
                className="user-menu"
                style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, display: 'block' }}
                role="menu"
              >
                <div className="user-menu-email">{user.email}</div>

                <div className="user-menu-section-label">Explore</div>
                <Link href="/path"  className="user-menu-item" role="menuitem" onClick={close}>Path finder</Link>
                <Link href="/graph" className="user-menu-item" role="menuitem" onClick={close}>Graph</Link>
                {user.plan === 'coach' && (
                  <Link href="/prep" className="user-menu-item" role="menuitem" onClick={close}>Class prep</Link>
                )}

                <div className="user-menu-divider" />

                <div className="user-menu-section-label">Account</div>
                <Link href="/history" className="user-menu-item" role="menuitem" onClick={close}>History</Link>
                <Link href="/studies" className="user-menu-item" role="menuitem" onClick={close}>My studies</Link>
                <Link href="/profile" className="user-menu-item" role="menuitem" onClick={close}>My game profile</Link>

                <div className="user-menu-divider" />

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
