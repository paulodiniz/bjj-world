'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Chat } from '@/components/Chat'

interface Message { role: 'user' | 'assistant'; content: string }

export default function ConversationPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'notfound'>('loading')

  useEffect(() => {
    // Check if there's a pending question stored by the home page
    const pending = sessionStorage.getItem(`pending_q_${id}`)
    if (pending) {
      sessionStorage.removeItem(`pending_q_${id}`)
      // This path is hit when Header search navigates here
      setStatus('ready')
      return
    }

    fetch(`/api/conversations/${id}`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) { setStatus('unauth'); return null }
        if (r.status === 404) { setStatus('notfound'); return null }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setMessages(data.messages || [])
        setStatus('ready')
      })
      .catch(() => setStatus('notfound'))
  }, [id])

  if (status === 'loading') return null

  if (status === 'unauth') return (
    <div className="results-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--ink-3)' }}>Sign in to view saved conversations.</p>
      <Link href="/signin" style={{ color: 'var(--accent-text)', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>Sign in →</Link>
    </div>
  )

  if (status === 'notfound') return (
    <div className="results-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--ink-3)' }}>Conversation not found.</p>
      <Link href="/" style={{ color: 'var(--accent-text)', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>← Start a new one</Link>
    </div>
  )

  const pendingQ = typeof window !== 'undefined' ? sessionStorage.getItem(`pending_q_${id}`) || '' : ''

  return (
    <div className="results-area" style={{ display: 'flex' }} role="main">
      <Chat conversationId={id} initialMessages={messages} autoQuestion={pendingQ} />
    </div>
  )
}
