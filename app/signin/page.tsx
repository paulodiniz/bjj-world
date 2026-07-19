'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { requestMagicLink } from '@/lib/api'
import { clearUserCache } from '@/lib/auth'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const authError = searchParams.get('auth_error')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await requestMagicLink(email)
      setSuccess(true)
    } catch (err) {
      setError('Failed to send magic link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLinkVerified = () => {
    clearUserCache()
    router.push('/')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="auth-dialog-inner">
        {!success ? (
          <div id="auth-form-state">
            <h2 className="auth-dialog-title">Sign in to Tapcodex</h2>
            <p className="auth-dialog-sub">We'll send a magic link to your email</p>

            {authError && (
              <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px' }}>
                {authError === 'invalid_token'
                  ? 'This link has expired or already been used. Request a new one.'
                  : 'Invalid sign-in link.'}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                className="auth-email-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>

            {error && (
              <p className="auth-error">{error}</p>
            )}

            <p className="auth-notice">No password. No tracking. Just a link.</p>
          </div>
        ) : (
          <div className="auth-success">
            <p className="auth-success-title">Check your email</p>
            <p className="auth-success-msg">
              We sent a sign-in link to<br />
              <strong>{email}</strong><br /><br />
              Click it to continue. The link expires in 15 minutes.
            </p>
            <button
              className="auth-close-btn"
              onClick={() => {
                setSuccess(false)
                setEmail('')
              }}
            >
              Send another link
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
