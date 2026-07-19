'use client'

import { useEffect, useState } from 'react'
import { Chat } from '@/components/Chat'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [messages, setMessages] = useState<Message[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch(`/api/conversations/${id}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setReady(true))
  }, [id])

  if (!ready) return null

  return (
    <div className="results-area" style={{ display: 'flex' }} role="main">
      <Chat conversationId={id} initialMessages={messages} />
    </div>
  )
}
