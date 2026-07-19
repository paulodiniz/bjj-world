/**
 * API client for FastAPI backend
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface FetchOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT'
  body?: any
  headers?: Record<string, string>
  token?: string
}

async function apiCall(endpoint: string, options: FetchOptions = {}) {
  const { method = 'GET', body, headers = {}, token } = options

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // Include cookies for session
    })

    if (!response.ok) {
      // 401 errors are expected when not authenticated - don't log them
      if (response.status !== 401) {
        console.error(`API error: ${response.status} on ${endpoint}`)
      }
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('401')) {
      console.error(`API call failed: ${endpoint}`, error)
    }
    throw error
  }
}

/**
 * Conversation APIs
 */
export async function getConversation(id: string) {
  return apiCall(`/api/conversations/${id}`)
}

export async function getConversations() {
  return apiCall('/api/conversations')
}

export async function deleteConversation(id: string) {
  return apiCall(`/api/conversations/${id}`, { method: 'DELETE' })
}

/**
 * Chat API - returns SSE stream
 */
export async function* chatStream(
  question: string,
  history: Array<{ role: string; content: string }>,
  conversationId?: string,
  signal?: AbortSignal
) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      history: history.slice(-6),
      conversation_id: conversationId,
    }),
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let sseBuffer = ''

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel()
        break
      }

      const { done, value } = await reader.read()
      if (done) break

      sseBuffer += decoder.decode(value, { stream: true })
      const parts = sseBuffer.split('\n\n')
      sseBuffer = parts.pop() || ''

      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data: ')) continue

        try {
          const event = JSON.parse(line.slice(6))
          yield event
        } catch {
          continue
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Auth APIs
 */
export async function requestMagicLink(email: string) {
  return apiCall('/api/auth/request', {
    method: 'POST',
    body: { email },
  })
}

export async function getMe() {
  return apiCall('/api/auth/me')
}

export async function logout() {
  return apiCall('/api/auth/logout', { method: 'POST' })
}

/**
 * Nodes and Path APIs
 */
export async function getNodes() {
  return apiCall('/api/nodes')
}

export async function getPath(fromNode: string, toNode: string) {
  return apiCall('/api/path', {
    method: 'POST',
    body: { from_node: fromNode, to_node: toNode },
  })
}

/**
 * Analyses APIs
 */
export async function getAnalyses() {
  return apiCall('/api/analyses')
}

export async function getAnalysis(id: string) {
  return apiCall(`/api/analyses/${id}`)
}

export async function deleteAnalysis(id: string) {
  return apiCall(`/api/analyses/${id}`, { method: 'DELETE' })
}

/**
 * Profile APIs
 */
export async function getProfile() {
  return apiCall('/api/profile')
}

export async function updateProfile(data: any) {
  return apiCall('/api/profile', {
    method: 'POST',
    body: data,
  })
}

/**
 * Prep APIs
 */
export async function generatePrepPlan(topic: string) {
  return apiCall('/api/prep/generate', {
    method: 'POST',
    body: { topic },
  })
}
