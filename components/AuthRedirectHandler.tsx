'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clearUserCache } from '@/lib/auth'
import { Suspense } from 'react'

function Handler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const signedIn = searchParams.get('signed_in')
    const authError = searchParams.get('auth_error')

    if (signedIn) {
      clearUserCache()
      window.history.replaceState(null, '', window.location.pathname)
      // Force header to re-fetch user by dispatching a custom event
      window.dispatchEvent(new CustomEvent('auth:refresh'))
    } else if (authError) {
      window.history.replaceState(null, '', window.location.pathname)
      router.push(`/signin?auth_error=${encodeURIComponent(authError)}`)
    }
  }, [searchParams, router])

  return null
}

export function AuthRedirectHandler() {
  return <Suspense><Handler /></Suspense>
}
