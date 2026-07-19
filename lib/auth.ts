import { getMe } from './api'

export interface User {
  email: string
  plan: 'free' | 'coach'
}

let cachedUser: User | null = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getCurrentUser(): Promise<User | null> {
  // Return cached user if still fresh
  if (cachedUser && Date.now() - cacheTime < CACHE_TTL) {
    return cachedUser
  }

  try {
    const response = await getMe()
    cachedUser = response.user || null
    cacheTime = Date.now()
    return cachedUser
  } catch {
    cachedUser = null
    return null
  }
}

export function clearUserCache() {
  cachedUser = null
  cacheTime = 0
}
