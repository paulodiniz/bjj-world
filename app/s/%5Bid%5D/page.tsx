export default function SharedAnalysisPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <div className="shared-area" role="main" aria-label="Shared analysis">
      <header className="shared-header">
        <a href="/" className="shared-brand-link">Tapcodex</a>
        <a href="/" className="shared-cta-link">Analyse your own matches →</a>
      </header>
      <div className="shared-inner" id="shared-content">
        <h2>Shared Analysis</h2>
        <p>Loading shared analysis {params.id}...</p>
      </div>
    </div>
  )
}
