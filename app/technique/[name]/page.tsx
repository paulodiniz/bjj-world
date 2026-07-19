'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface BJJNode { id: string; name: string; type: string }
interface Group { action: string; label: string; nodes: BJJNode[] }
interface Technique {
  id: string; name: string; type: string; description: string | null
  gi_requirement: string | null; video_url: string | null
  outgoing: Group[]; incoming: Group[]
}

function ytId(url: string | null) {
  if (!url) return null
  const m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/)
  return m ? m[1] : null
}

function Chip({ node }: { node: BJJNode }) {
  return (
    <Link href={`/technique/${encodeURIComponent(node.id)}`} className={`nc nc-${node.type}`} title={node.type.replace(/_/g, ' ')}>
      {node.name}
    </Link>
  )
}

export default function TechniquePage({ params }: { params: { name: string } }) {
  const id = decodeURIComponent(params.name)
  const [data, setData] = useState<Technique | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/technique/${encodeURIComponent(id)}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setNotFound(true))
  }, [id])

  useEffect(() => {
    if (data) document.title = `${data.name} — Tapcodex`
  }, [data])

  if (notFound) return (
    <div className="technique-area" role="main">
      <div className="tp-inner">
        <div className="tp-back"><button onClick={() => history.back()}>← back</button></div>
        <p style={{ color: 'var(--ink-3)', fontSize: '0.88rem' }}>Technique not found.</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="technique-area" role="main">
      <div className="tp-inner">
        <p style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--ink-3)' }}>Loading…</p>
      </div>
    </div>
  )

  const vid = ytId(data.video_url)

  return (
    <div className="technique-area" role="main" aria-label={`${data.name} technique`}>
      <div className="tp-inner" id="tp-content">
        <div className="tp-back"><button onClick={() => history.back()}>← back</button></div>

        <div className="tp-hero">
          <div className="tp-meta">
            <span className={`tp-type ${data.type}`}>{data.type.replace(/_/g, ' ')}</span>
            {data.gi_requirement && data.gi_requirement !== 'both' && (
              <span className="tp-gi">{data.gi_requirement}</span>
            )}
          </div>
          <h1 className="tp-name">{data.name}</h1>
          {data.description && <p className="tp-desc">{data.description}</p>}
        </div>

        {vid && (
          <div className="tp-video">
            <iframe
              src={`https://www.youtube.com/embed/${vid}`}
              title={`${data.name} technique`}
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}

        {(data.outgoing.length > 0 || data.incoming.length > 0) && (
          <div className="tp-connections">
            {data.outgoing.length > 0 && (
              <div className="tp-conn-section">
                <h3 className="tp-conn-heading">From here</h3>
                {data.outgoing.map((group) => (
                  <div key={group.action} className="tp-group">
                    <span className="tp-group-label">{group.label}</span>
                    <div className="tp-chips">
                      {group.nodes.map((n) => <Chip key={n.id} node={n} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {data.incoming.length > 0 && (
              <div className="tp-conn-section">
                <h3 className="tp-conn-heading">Leads here from</h3>
                {data.incoming.map((group) => (
                  <div key={group.action} className="tp-group">
                    <span className="tp-group-label">{group.label}</span>
                    <div className="tp-chips">
                      {group.nodes.map((n) => <Chip key={n.id} node={n} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="tp-cta">
          <Link href={`/?q=${encodeURIComponent(`Tell me more about ${data.name}`)}`} className="tp-ask-btn">
            Ask coach about {data.name} →
          </Link>
          <Link href={`/path?to=${encodeURIComponent(data.name)}`} className="tp-path-btn">
            Find path to {data.name} →
          </Link>
        </div>
      </div>
    </div>
  )
}
