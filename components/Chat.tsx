'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { chatStream } from '@/lib/api'

declare global {
  interface Window { marked: any }
}

function renderMarkdown(text: string): string {
  if (typeof window !== 'undefined' && window.marked) {
    return window.marked.parse(text)
  }
  return text.replace(/\n/g, '<br/>')
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatProps {
  conversationId: string
  initialMessages: Message[]
  autoQuestion?: string
}

export function Chat({ conversationId: initialConvId, initialMessages, autoQuestion }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [conversationId, setConversationId] = useState(initialConvId)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const entriesRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (entriesRef.current) {
      entriesRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, currentResponse])

  // Auto-send the initial question once on mount
  useEffect(() => {
    if (autoQuestion && !autoSentRef.current) {
      autoSentRef.current = true
      sendMessage(autoQuestion, [])
    }
  }, [autoQuestion])

  const sendMessage = async (text: string, history: Message[]) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsLoading(true)
    setCurrentResponse('')

    const controller = new AbortController()
    setAbortController(controller)

    try {
      let response = ''
      let currentConvId = conversationId

      for await (const event of chatStream(text, history, currentConvId === 'new' ? undefined : currentConvId, controller.signal)) {
        if (controller.signal.aborted) break

        if (event.type === 'conversation_id') {
          currentConvId = event.id
          setConversationId(event.id)
          router.replace(`/c/${event.id}`, { scroll: false })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return
    const text = query
    setQuery('')
    await sendMessage(text, messages)
  }

  const handleStop = () => {
    abortController?.abort()
    setAbortController(null)
    setIsLoading(false)
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
              <div className="answer-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
            </div>
          )}
        </div>
      ))}

      {currentResponse && (
        <div className="entry">
          <div className="entry-a">
            <div className="answer-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(currentResponse) }} />
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
            style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px', font: 'inherit' }}
          />
          {isLoading ? (
            <button type="button" onClick={handleStop}
              style={{ padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!query.trim()}
              style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px',
                cursor: !query.trim() ? 'not-allowed' : 'pointer', opacity: !query.trim() ? 0.5 : 1 }}>
              Ask
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
