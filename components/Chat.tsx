'use client'

import { useState, useRef, useEffect } from 'react'
import { chatStream, getNodes } from '@/lib/api'
import { setChipNodes, chipifyHtml } from '@/lib/chipifyHtml'
import { registerStop, clearStop } from '@/lib/streamControl'

declare global { interface Window { marked: any } }

function renderMarkdown(text: string): string {
  const html = (typeof window !== 'undefined' && window.marked)
    ? window.marked.parse(text)
    : text.replace(/\n/g, '<br/>')
  return chipifyHtml(html)
}

interface Message { role: 'user' | 'assistant'; content: string }

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
  const [nodesReady, setNodesReady] = useState(false)
  const entriesRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef(false)

  // Load nodes once and register with chipifyHtml
  useEffect(() => {
    getNodes().then((data: any[]) => {
      setChipNodes(Array.isArray(data) ? data : [])
      setNodesReady(true)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (entriesRef.current) {
      entriesRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, currentResponse])

  useEffect(() => {
    if (autoQuestion && !autoSentRef.current) {
      autoSentRef.current = true
      sendMessage(autoQuestion, [])
    }
  }, [autoQuestion]) // eslint-disable-line

  const sendMessage = async (text: string, history: Message[]) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsLoading(true)
    setCurrentResponse('')

    const controller = new AbortController()
    setAbortController(controller)
    registerStop(() => controller.abort())

    try {
      let response = ''
      let currentConvId = conversationId

      for await (const event of chatStream(text, history, currentConvId, controller.signal)) {
        if (controller.signal.aborted) break

        if (event.type === 'conversation_id') {
          currentConvId = event.id
          setConversationId(event.id)
          window.history.replaceState(null, '', `/c/${event.id}`)
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
        setCurrentResponse('Error: Failed to get response. Please try again.')
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
      clearStop()
    }
  }

  const isYouTubeUrl = (text: string) =>
    /(?:youtube\.com\/watch|youtu\.be\/)/.test(text)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return
    const text = query.trim()
    setQuery('')
    if (isYouTubeUrl(text)) {
      // Route video URLs to analysis
      window.location.href = `/a/new?url=${encodeURIComponent(text)}`
      return
    }
    await sendMessage(text, messages)
  }

  const handleStop = () => {
    abortController?.abort()
    setAbortController(null)
    setIsLoading(false)
  }

  // Re-render with chips once nodes are ready (applies to initialMessages too)
  const renderKey = nodesReady ? 'chipped' : 'plain'

  return (
    <div className="entries" ref={entriesRef} role="log" aria-live="polite">
      {messages.map((msg, idx) => (
        <div key={`${renderKey}-${idx}`} className="entry">
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

      <form className="landing-cmd" onSubmit={handleSubmit} style={{ marginTop: '20px', maxWidth: 680, margin: '20px auto 0' }}>
        <span className="landing-cmd-glyph" aria-hidden="true">◎</span>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a follow-up question…" disabled={isLoading} />
        {isLoading ? (
          <button type="button" className="landing-ask-btn" onClick={handleStop}>Stop</button>
        ) : (
          <button type="submit" className="landing-ask-btn" disabled={!query.trim()}>Ask</button>
        )}
      </form>
    </div>
  )
}
