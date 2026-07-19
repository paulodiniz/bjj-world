'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { generatePrepPlan } from '@/lib/api'
import { useEffect } from 'react'
import type { User } from '@/lib/auth'

export default function PrepPage() {
  const [user, setUser] = useState<User | null>(null)
  const [topic, setTopic] = useState('')
  const [plan, setPlan] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u || u.plan !== 'coach') {
        router.push('/')
      } else {
        setUser(u)
      }
    })
  }, [router])

  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic')
      return
    }

    setIsLoading(true)
    setPlan('')

    try {
      const data = await generatePrepPlan(topic)
      setPlan(data.plan || 'No plan generated')
    } catch (error) {
      console.error('Failed to generate plan:', error)
      setPlan('Failed to generate plan. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return <div className="prep-area">Loading...</div>

  return (
    <div className="prep-area" role="main" aria-label="Class prep">
      <div className="prep-inner" id="prep-content">
        <h2>Class Prep</h2>
        <p>Generate a lesson plan from the knowledge graph</p>

        <div style={{ marginTop: '24px' }}>
          <label style={{ display: 'block' }}>
            <strong>Class Topic</strong>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 'Guard escapes for white belts' or 'Advanced leg lock combinations'"
              style={{
                marginTop: '8px',
                padding: '12px',
                width: '100%',
                minHeight: '100px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontFamily: 'inherit',
              }}
            />
          </label>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !topic.trim()}
            style={{
              marginTop: '16px',
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading || !topic.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !topic.trim() ? 0.5 : 1,
            }}
          >
            {isLoading ? 'Generating...' : 'Generate Lesson Plan'}
          </button>

          {plan && (
            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {plan}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
