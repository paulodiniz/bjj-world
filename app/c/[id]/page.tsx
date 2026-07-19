'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Chat } from '@/components/Chat'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function ConversationInner({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const initialQuestion = searchParams.get('q') || ''

  const [messages, setMessages] = useState<Message[]>([])
  const [ready, setReady] = useState(!!initialQuestion) // ready immediately if starting fresh

  useEffect(() => {
    if (initialQuestion) return // starting a new conversation, no need to fetch
    fetch(`/api/conversations/${id}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        setMessages(data.messages || [])
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [id, initialQuestion])

  if (!ready) return null

  return (
    <div className="results-area" style={{ display: 'flex' }} role="main" aria-label="Answers">
      <Chat
        conversationId={id}
        initialMessages={messages}
        autoQuestion={id === 'new' ? initialQuestion : ''}
      />
    </div>
  )
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <ConversationInner id={params.id} />
    </Suspense>
  )
}
