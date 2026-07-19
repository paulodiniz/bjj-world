'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { chatStream } from '@/lib/api'
import { marked } from 'marked'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatProps {
  conversationId: string
  initialMessages: Message[]
}

export function Chat({ conversationId, initialMessages }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const entriesRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const scrollToBottom = () => {
    if (entriesRef.current) {
      entriesRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentResponse])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    const userMessage = query
    setQuery('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    setCurrentResponse('')

    try {
      let newConversationId = conversationId
      let response = ''

      for await (const event of chatStream(
        userMessage,
        messages,
        conversationId
      )) {
        if (event.type === 'conversation_id') {
          newConversationId = event.id
          // Optionally refresh the URL
          router.push(`/c/${event.id}`)
        } else if (event.type === 'token') {
          response += event.text
          setCurrentResponse(response)
        } else if (event.type === 'done') {
          setMessages((prev) => [...prev, { role: 'assistant', content: response }])
          setCurrentResponse('')
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setCurrentResponse('Error: Failed to get response. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="entries" ref={entriesRef} role="log" aria-live="polite">
      {messages.map((msg, idx) => (
        <div key={idx} className="entry">
          {msg.role === 'user' ? (
            <div className="entry-q">
              <span className="entry-q-glyph" aria-hidden="true">▸</span>
              <span className="entry-q-text">{msg.content}</span>
            </div>
          ) : (
            <div className="entry-a">
              <div
                className="answer-text"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(msg.content),
                }}
              />
            </div>
          )}
        </div>
      ))}

      {currentResponse && (
        <div className="entry">
          <div className="entry-a">
            <div
              className="answer-text"
              dangerouslySetInnerHTML={{
                __html: marked.parse(currentResponse),
              }}
            />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a follow-up question…"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Ask'}
        </button>
      </form>
    </div>
  )
}
