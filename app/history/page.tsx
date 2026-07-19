'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getConversations, deleteConversation } from '@/lib/api'

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const data = await getConversations()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this conversation?')) return

    try {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      alert('Failed to delete conversation')
    }
  }

  return (
    <div className="history-area" role="main" aria-label="Chat history">
      <div className="history-inner">
        <div className="history-head">
          <h2 className="history-title">History</h2>
          <Link href="/" className="history-new-btn">+ New conversation</Link>
        </div>

        {isLoading ? (
          <p>Loading conversations...</p>
        ) : conversations.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center' }}>No conversations yet</p>
        ) : (
          <div id="history-list">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Link
                  href={`/c/${conv.id}`}
                  style={{
                    flex: 1,
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: '500' }}>{conv.title}</div>
                  <div style={{ fontSize: '0.85em', color: '#666' }}>
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(conv.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#999',
                    cursor: 'pointer',
                    fontSize: '1.2em',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
