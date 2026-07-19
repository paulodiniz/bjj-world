'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Chat } from '@/components/Chat'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const { id } = params
  const searchParams = useSearchParams()
  const initialQuestion = searchParams.get('q') || ''

  const [messages, setMessages] = useState<Message[]>([])
  const [ready, setReady] = useState(id === 'new')

  useEffect(() => {
    if (id === 'new') return
    fetch(`/api/conversations/${id}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        setMessages(data.messages || [])
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [id])

  if (!ready) return null

  return (
    <div className="results-area" role="main" aria-label="Answers">
      <Chat
        conversationId={id}
        initialMessages={messages}
        autoQuestion={id === 'new' ? initialQuestion : ''}
      />
    </div>
  )
}
