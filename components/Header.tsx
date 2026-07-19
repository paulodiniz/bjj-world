'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCurrentUser, clearUserCache } from '@/lib/auth'
import type { User } from '@/lib/auth'
import { logout } from '@/lib/api'

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then(setUser)
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
    try {
      await logout()
      clearUserCache()
      setUser(null)
      setShowMenu(false)
      router.push('/')
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <header className="app-header" aria-label="Tapcodex">
      <Link href="/" className="header-brand">
        <span className="header-brand-name">Tapcodex</span>
        <span className="header-brand-sub">knowledge graph</span>
      </Link>

      <form className="header-cmd" onSubmit={handleSearch}>
        <span className="header-cmd-glyph" aria-hidden="true">◎</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about any technique or position…"
          aria-label="Your question"
        />
      </form>

      <div className="header-actions">
        <button type="submit" form="header-form" className="header-btn">Ask</button>
        <Link href="/path" className="path-toggle-btn">Path →</Link>
        <Link href="/graph" className="graph-toggle-btn">Graph</Link>
        <Link href="/history" className="history-toggle-btn">History</Link>

        {user ? (
          <div style={{ position: 'relative' }}>
            <button
              className="user-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Account options"
            >
              <span className="user-btn-dot"></span>
              <span className="user-btn-email">{user.email}</span>
            </button>

            {showMenu && (
              <div className="user-menu" style={{ display: 'block' }}>
                <Link href="/profile" className="user-menu-item">My game profile</Link>
                <button
                  onClick={handleSignOut}
                  className="user-menu-item danger"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: 'inherit' }}
                >
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
