'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getConversations, deleteConversation, getAnalyses, deleteAnalysis } from '@/lib/api'

interface Item { id: string; title: string; created_at: string; updated_at: string }

function relativeDate(iso: string) {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  if (dDay >= today) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (dDay >= yesterday) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function groupByDate(items: Item[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const groups = [
    { label: 'Today', items: [] as Item[] },
    { label: 'Yesterday', items: [] as Item[] },
    { label: 'Earlier', items: [] as Item[] },
  ]
  for (const c of items) {
    const d = new Date(c.updated_at || c.created_at); d.setHours(0, 0, 0, 0)
    if (d >= today) groups[0].items.push(c)
    else if (d >= yesterday) groups[1].items.push(c)
    else groups[2].items.push(c)
  }
  return groups.filter((g) => g.items.length > 0)
}

function HistorySection({ title, items, linkPrefix, onDelete }: {
  title: string; items: Item[]; linkPrefix: string; onDelete: (id: string) => void
}) {
  const groups = groupByDate(items)
  if (!groups.length) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="history-group-label" style={{ marginBottom: 12 }}>{title}</div>
      {groups.map((group) => (
        <div key={group.label} className="history-group">
          <div className="history-group-label">{group.label}</div>
          <div className="history-list">
            {group.items.map((item) => (
              <div key={item.id} className="history-item">
                <Link href={`${linkPrefix}${item.id}`} className="history-item-title">{item.title}</Link>
                <span className="history-item-date">{relativeDate(item.updated_at || item.created_at)}</span>
                <button className="history-item-del" title="Delete" aria-label="Delete"
                  onClick={() => onDelete(item.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Item[]>([])
  const [analyses, setAnalyses] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    Promise.allSettled([
      getConversations().then((d) => setConversations(d.conversations || [])),
      getAnalyses().then((d) => setAnalyses(d.analyses || [])),
    ]).then(() => setLoading(false))
      .catch(() => { setUnauthorized(true); setLoading(false) })

    // Check for 401 on conversations specifically
    getConversations().catch((e) => {
      if (String(e).includes('401')) setUnauthorized(true)
    })
  }, [])

  const handleDeleteConv = async (id: string) => {
    await deleteConversation(id)
    setConversations((p) => p.filter((c) => c.id !== id))
  }

  const handleDeleteAnalysis = async (id: string) => {
    await deleteAnalysis(id)
    setAnalyses((p) => p.filter((a) => a.id !== id))
  }

  return (
    <div className="history-area" style={{ display: 'flex' }} role="main" aria-label="Chat history">
      <div className="history-inner">
        <div className="history-head">
          <h2 className="history-title">History</h2>
          <Link href="/" className="history-new-btn">+ New conversation</Link>
        </div>

        <div id="history-list">
          {loading && <p className="history-empty">Loading…</p>}
          {!loading && unauthorized && <p className="history-empty">Sign in to see your history.</p>}
          {!loading && !unauthorized && conversations.length === 0 && analyses.length === 0 && (
            <p className="history-empty">No history yet.</p>
          )}
          {!loading && !unauthorized && (
            <>
              <HistorySection title="Conversations" items={conversations}
                linkPrefix="/c/" onDelete={handleDeleteConv} />
              <HistorySection title="Video analyses" items={analyses}
                linkPrefix="/a/" onDelete={handleDeleteAnalysis} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
