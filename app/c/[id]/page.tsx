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
  const [autoQuestion, setAutoQuestion] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const pending = sessionStorage.getItem(`pending_q_${id}`)
    if (pending) {
      sessionStorage.removeItem(`pending_q_${id}`)
      setAutoQuestion(pending)
      setReady(true)
      return
    }

    fetch(`/api/conversations/${id}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setReady(true))
  }, [id])

  if (!ready) return null

  return (
    <div className="results-area" style={{ display: 'flex' }} role="main" aria-label="Answers">
      <Chat
        conversationId={id}
        initialMessages={messages}
        autoQuestion={autoQuestion}
      />
    </div>
  )
}
