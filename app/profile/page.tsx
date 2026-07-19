'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile, updateProfile } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { NodePicker } from '@/components/NodePicker'

const BELTS = ['white', 'blue', 'purple', 'brown', 'black']
const GI_OPTIONS = [{ value: 'gi', label: 'Gi' }, { value: 'nogi', label: 'No-Gi' }, { value: 'both', label: 'Both' }]
const GUARD_TYPES = ['position', 'technique']
const PASS_TYPES = ['guard_pass', 'technique']
const SUB_TYPES = ['submission']
const GAME_TYPES = ['position', 'technique', 'submission', 'guard_pass', 'concept', 'system', 'sweep', 'takedown', 'escape']

interface WeakNode {
  id: string
  name: string
  type: string
  count: number
}

interface Profile {
  belt?: string
  gi_preference?: string
  primary_guard?: string | null
  passing_style?: string | null
  submission_prefs?: string[]
  favourite_game?: string[]
  notes?: string | null
  weak_nodes?: WeakNode[]
}

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [belt, setBelt] = useState('white')
  const [gi, setGi] = useState('both')
  const [primaryGuard, setPrimaryGuard] = useState<string[]>([])
  const [passingStyle, setPassingStyle] = useState<string[]>([])
  const [subPrefs, setSubPrefs] = useState<string[]>([])
  const [favGame, setFavGame] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [weakNodes, setWeakNodes] = useState<WeakNode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const router = useRouter()

  useEffect(() => {
    Promise.all([getCurrentUser(), getProfile()]).then(([user, data]) => {
      if (!user) { router.push('/signin'); return }
      setEmail(user.email)
      const p: Profile = data?.profile || {}
      setBelt(p.belt || 'white')
      setGi(p.gi_preference || 'both')
      setPrimaryGuard(p.primary_guard ? [p.primary_guard] : [])
      setPassingStyle(p.passing_style ? [p.passing_style] : [])
      setSubPrefs(p.submission_prefs || [])
      setFavGame(p.favourite_game || [])
      setNotes(p.notes || '')
      setWeakNodes(p.weak_nodes || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await updateProfile({
        belt,
        gi_preference: gi,
        primary_guard: primaryGuard[0] || null,
        passing_style: passingStyle[0] || null,
        submission_prefs: subPrefs,
        favourite_game: favGame,
        notes: notes.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setSaveError('Save failed — try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="profile-area" style={{ display: "block" }}><div className="profile-inner" /></div>

  return (
    <div className="profile-area" style={{ display: "block" }} role="main" aria-label="My game profile">
      <div className="profile-inner" id="profile-content">
        <div className="profile-head">
          <h2 className="profile-title">My game</h2>
          <p className="profile-sub">{email} · answers are tailored to your game when this is set</p>
        </div>

        <div className="profile-section">
          <span className="profile-section-label" id="label-belt">Belt</span>
          <div className="belt-options" role="group" aria-labelledby="label-belt">
            {BELTS.map((b) => (
              <button key={b} type="button" className={`belt-btn${belt === b ? ' active' : ''}`}
                aria-pressed={belt === b} onClick={() => setBelt(b)}>{b}</button>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <span className="profile-section-label" id="label-gi">Trains</span>
          <div className="gi-options" role="group" aria-labelledby="label-gi">
            {GI_OPTIONS.map(({ value, label }) => (
              <button key={value} type="button" className={`gi-btn${gi === value ? ' active' : ''}`}
                aria-pressed={gi === value} onClick={() => setGi(value)}>{label}</button>
            ))}
          </div>
        </div>

        <NodePicker label="Primary guard" types={GUARD_TYPES} value={primaryGuard} onChange={setPrimaryGuard} />
        <NodePicker label="Passing style" types={PASS_TYPES} value={passingStyle} onChange={setPassingStyle} />
        <NodePicker label="Favourite submissions" types={SUB_TYPES} value={subPrefs} multi onChange={setSubPrefs} />
        <NodePicker label="Favourite game / focus" types={GAME_TYPES} value={favGame} multi onChange={setFavGame} />

        <div className="profile-section">
          <span className="profile-section-label" id="label-notes">Anything else? (injuries, goals, style)</span>
          <textarea className="profile-notes" aria-labelledby="label-notes"
            placeholder="e.g. &quot;Recovering from a knee injury, avoiding leg entanglements&quot;"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {weakNodes.length > 0 && (
          <div className="profile-section profile-gaps">
            <span className="profile-section-label">Detected gaps · from your video analyses</span>
            <div className="profile-gap-list">
              {weakNodes.slice(0, 8).map((n) => (
                <span key={n.id} className="profile-gap-tag" title={`Flagged ${n.count}×`}>
                  {n.name}
                </span>
              ))}
            </div>
            <p className="profile-gaps-hint">These positions surfaced repeatedly in your video analyses. Your AI answers are already weighted toward these areas.</p>
          </div>
        )}

        <div className="profile-footer">
          <button type="button" className="profile-save-btn" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {saved && <span className="profile-saved visible" role="status">✓ Saved</span>}
          {saveError && <span className="profile-save-error">{saveError}</span>}
        </div>
      </div>
    </div>
  )
}
