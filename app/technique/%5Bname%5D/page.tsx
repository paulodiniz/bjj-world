export default function TechniquePage({
  params,
}: {
  params: { name: string }
}) {
  return (
    <div className="technique-area" role="main" aria-label="Technique details">
      <div className="tp-inner" id="tp-content">
        <h2>{decodeURIComponent(params.name)}</h2>
        <p>Loading technique details...</p>
      </div>
    </div>
  )
}
