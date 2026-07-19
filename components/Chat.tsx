'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { chatStream } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatProps {
  conversationId: string
  initialMessages: Message[]
}

export function Chat({ conversationId: initialConvId, initialMessages }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [conversationId, setConversationId] = useState(initialConvId)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const entriesRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (entriesRef.current) {
      entriesRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, currentResponse])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    const userMessage = query
    setQuery('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    setCurrentResponse('')

    const controller = new AbortController()
    setAbortController(controller)

    try {
      let response = ''
      let newConversationId = conversationId

      for await (const event of chatStream(
        userMessage,
        messages,
        conversationId,
        controller.signal
      )) {
        if (controller.signal.aborted) break

        if (event.type === 'conversation_id') {
          newConversationId = event.id
          setConversationId(event.id)
          if (conversationId === 'new' || !conversationId) {
            router.push(`/c/${event.id}`)
          }
        } else if (event.type === 'token') {
          response += event.text
          setCurrentResponse(response)
        } else if (event.type === 'done') {
          setMessages((prev) => [...prev, { role: 'assistant', content: response }])
          setCurrentResponse('')
        } else if (event.type === 'error') {
          setCurrentResponse(`Error: ${event.text}`)
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Chat error:', error)
        setCurrentResponse('Error: Failed to get response. Please try again.')
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
    }
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
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

      <form onSubmit={handleSubmit} style={{ marginTop: '20px', padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a follow-up question…"
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              font: 'inherit',
            }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !query.trim() ? 0.5 : 1,
              }}
            >
              Ask
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
