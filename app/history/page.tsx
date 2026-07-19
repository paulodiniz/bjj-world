'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getConversations, deleteConversation } from '@/lib/api'

interface Conversation { id: string; title: string; created_at: string; updated_at: string }

function relativeDate(iso: string) {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  if (dDay >= today) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (dDay >= yesterday) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function groupByDate(convs: Conversation[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ]
  for (const c of convs) {
    const d = new Date(c.updated_at); d.setHours(0, 0, 0, 0)
    if (d >= today) groups[0].items.push(c)
    else if (d >= yesterday) groups[1].items.push(c)
    else groups[2].items.push(c)
  }
  return groups.filter((g) => g.items.length > 0)
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    getConversations()
      .then((data) => setConversations(data.conversations || []))
      .catch((e) => { if (String(e).includes('401')) setUnauthorized(true) })
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    await deleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }

  const groups = groupByDate(conversations)

  return (
    <div className="history-area" role="main" aria-label="Chat history">
      <div className="history-inner">
        <div className="history-head">
          <h2 className="history-title">History</h2>
          <Link href="/" className="history-new-btn">+ New conversation</Link>
        </div>

        <div id="history-list">
          {loading && <p className="history-empty">Loading…</p>}
          {unauthorized && <p className="history-empty">Sign in to see your history.</p>}
          {!loading && !unauthorized && conversations.length === 0 && (
            <p className="history-empty">No history yet.</p>
          )}
          {groups.map((group) => (
            <div key={group.label} className="history-group">
              <div className="history-group-label">{group.label}</div>
              <div className="history-list">
                {group.items.map((conv) => (
                  <div key={conv.id} className="history-item">
                    <Link href={`/c/${conv.id}`} className="history-item-title">{conv.title}</Link>
                    <span className="history-item-date">{relativeDate(conv.updated_at)}</span>
                    <button className="history-item-del" title="Delete" aria-label="Delete"
                      onClick={() => handleDelete(conv.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
