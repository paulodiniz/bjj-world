'use client'

import { useEffect, useState } from 'react'
import { getNodes, getPath } from '@/lib/api'

interface Node {
  id: string
  name: string
  type: string
}

export default function PathPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [fromNode, setFromNode] = useState('')
  const [toNode, setToNode] = useState('')
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingNodes, setIsLoadingNodes] = useState(true)

  useEffect(() => {
    loadNodes()
  }, [])

  const loadNodes = async () => {
    try {
      const data = await getNodes()
      setNodes(data.nodes || [])
    } catch (error) {
      console.error('Failed to load nodes:', error)
    } finally {
      setIsLoadingNodes(false)
    }
  }

  const handleFindPath = async () => {
    if (!fromNode || !toNode) {
      alert('Please select both FROM and TO nodes')
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const data = await getPath(fromNode, toNode)
      setResult(data)
    } catch (error) {
      console.error('Failed to find path:', error)
      setResult({ error: 'Failed to find path' })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredFromNodes = nodes.filter((n) =>
    n.name.toLowerCase().includes(fromNode.toLowerCase())
  )
  const filteredToNodes = nodes.filter((n) =>
    n.name.toLowerCase().includes(toNode.toLowerCase())
  )

  return (
    <div className="path-area" role="main" aria-label="Path Finder">
      <div className="path-inner">
        <div className="path-head">
          <h2>Path Finder</h2>
          <p>Shortest route between any two positions or techniques</p>
        </div>

        {isLoadingNodes ? (
          <p>Loading nodes...</p>
        ) : (
          <>
            <div className="path-controls">
              <div className="path-field">
                <label className="path-field-label" htmlFor="path-from">FROM</label>
                <input
                  id="path-from"
                  className="path-combobox"
                  type="text"
                  value={fromNode}
                  onChange={(e) => setFromNode(e.target.value)}
                  placeholder="Search techniques…"
                  list="path-from-list"
                />
                <datalist id="path-from-list">
                  {filteredFromNodes.slice(0, 10).map((n) => (
                    <option key={n.id} value={n.name} />
                  ))}
                </datalist>
              </div>

              <div className="path-field">
                <label className="path-field-label" htmlFor="path-to">TO</label>
                <input
                  id="path-to"
                  className="path-combobox"
                  type="text"
                  value={toNode}
                  onChange={(e) => setToNode(e.target.value)}
                  placeholder="Search techniques…"
                  list="path-to-list"
                />
                <datalist id="path-to-list">
                  {filteredToNodes.slice(0, 10).map((n) => (
                    <option key={n.id} value={n.name} />
                  ))}
                </datalist>
              </div>

              <button
                type="button"
                onClick={handleFindPath}
                disabled={isLoading || !fromNode || !toNode}
                style={{ opacity: isLoading || !fromNode || !toNode ? 0.5 : 1 }}
              >
                {isLoading ? 'Finding...' : 'Find Path'}
              </button>
            </div>

            <div id="path-result" aria-live="polite">
              {result && (
                <div style={{ marginTop: '24px' }}>
                  {result.error ? (
                    <p style={{ color: '#ef4444' }}>{result.error}</p>
                  ) : result.path ? (
                    <div>
                      <h3>Path: {result.path.length - 1} steps</h3>
                      <ol>
                        {result.path.map((node: any, idx: number) => (
                          <li key={idx}>{node}</li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <p>No path found</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
