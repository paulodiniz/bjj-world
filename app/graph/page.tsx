export default function GraphPage() {
  return (
    <div className="graph-area" aria-label="BJJ knowledge graph">
      <div className="graph-loading" id="graph-loading">Loading graph…</div>
      <div className="graph-filters" id="graph-filters"></div>
      <svg id="graph-svg" aria-hidden="true"></svg>
      <div className="graph-legend" id="graph-legend"></div>
    </div>
  )
}
