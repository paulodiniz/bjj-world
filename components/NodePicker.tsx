'use client'

import { useState } from 'react'
import { useNodes, type BJJNode } from '@/lib/useNodes'

interface NodePickerProps {
  label: string
  types: string[]
  value: string[]
  multi?: boolean
  onChange: (ids: string[]) => void
}

export function NodePicker({ label, types, value, multi = false, onChange }: NodePickerProps) {
  const allNodes = useNodes()
  const [query, setQuery] = useState('')

  const filtered = allNodes
    .filter((n) => types.includes(n.type) && n.name.toLowerCase().includes(query.toLowerCase()) && !value.includes(n.id))
    .slice(0, 8)

  const selectedNodes = value.map((id) => allNodes.find((n) => n.id === id)).filter(Boolean) as BJJNode[]

  const select = (node: BJJNode) => {
    if (multi) onChange([...value, node.id])
    else onChange([node.id])
    setQuery('')
  }

  const remove = (id: string) => onChange(value.filter((v) => v !== id))

  const datalistId = `np-${label.replace(/\s+/g, '-').toLowerCase()}`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    const match = allNodes.find((n) => n.name.toLowerCase() === val.toLowerCase() && types.includes(n.type))
    if (match) select(match)
  }

  return (
    <div className="profile-section">
      <span className="profile-section-label">{label}</span>
      <div className="node-picker-wrap">
        <input
          className="node-picker-input"
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search…"
          autoComplete="off"
          list={datalistId}
        />
        <datalist id={datalistId}>
          {filtered.map((n) => <option key={n.id} value={n.name} />)}
        </datalist>
        {selectedNodes.length > 0 && (
          <div className="node-picker-selected">
            {selectedNodes.map((n) => (
              <span key={n.id} className="node-picker-chip">
                {n.name}
                <button className="node-picker-chip-remove" type="button" onClick={() => remove(n.id)} aria-label={`Remove ${n.name}`}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
