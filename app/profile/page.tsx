'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile, updateProfile } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { User } from '@/lib/auth'

interface Profile {
  favourite_game: string[]
  weight: string
  belt: string
}

const gameOptions = [
  'Top',
  'Bottom',
  'Guard',
  'Mount',
  'Side Control',
  'Submissions',
  'Escapes',
  'Transitions',
  'Footlock',
  'Leg Lock',
]

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile>({
    favourite_game: [],
    weight: '',
    belt: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push('/signin')
        return
      }
      setUser(currentUser)

      const profileData = await getProfile()
      if (profileData?.profile) {
        setProfile(profileData.profile)
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGameToggle = (game: string) => {
    setProfile((prev) => ({
      ...prev,
      favourite_game: prev.favourite_game.includes(game)
        ? prev.favourite_game.filter((g) => g !== game)
        : [...prev.favourite_game, game],
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateProfile(profile)
      alert('Profile saved!')
    } catch (error) {
      console.error('Failed to save profile:', error)
      alert('Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="profile-area">Loading...</div>
  if (!user) return <div className="profile-area">Not signed in</div>

  return (
    <div className="profile-area" role="main" aria-label="My game profile">
      <div className="profile-inner" id="profile-content">
        <h2>My Game Profile</h2>
        <p>Personalise your answers by telling us about your BJJ game</p>

        <div style={{ marginTop: '24px' }}>
          <label>
            <strong>Belt Level</strong>
            <select
              value={profile.belt}
              onChange={(e) => setProfile((prev) => ({ ...prev, belt: e.target.value }))}
              style={{ marginTop: '8px', padding: '8px', width: '100%' }}
            >
              <option value="">Select belt level</option>
              <option value="white">White</option>
              <option value="blue">Blue</option>
              <option value="purple">Purple</option>
              <option value="brown">Brown</option>
              <option value="black">Black</option>
            </select>
          </label>

          <label style={{ display: 'block', marginTop: '16px' }}>
            <strong>Weight</strong>
            <input
              type="text"
              value={profile.weight}
              onChange={(e) => setProfile((prev) => ({ ...prev, weight: e.target.value }))}
              placeholder="e.g. 70kg"
              style={{ marginTop: '8px', padding: '8px', width: '100%' }}
            />
          </label>

          <div style={{ marginTop: '16px' }}>
            <strong>Favourite Techniques</strong>
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {gameOptions.map((game) => (
                <button
                  key={game}
                  onClick={() => handleGameToggle(game)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    background: profile.favourite_game.includes(game) ? '#3b82f6' : 'white',
                    color: profile.favourite_game.includes(game) ? 'white' : 'black',
                    cursor: 'pointer',
                  }}
                >
                  {game}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
