export default function AnalysisPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <div className="analysis-area" role="main" aria-label="Video analysis">
      <div id="analysis-content">
        <h2>Video Analysis</h2>
        <p>Loading analysis {params.id}...</p>
      </div>
    </div>
  )
}
