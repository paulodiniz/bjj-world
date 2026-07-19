export default function PathPage() {
  return (
    <div className="path-area" role="main" aria-label="Path Finder">
      <div className="path-inner">
        <div className="path-head">
          <h2>Path Finder</h2>
          <p>Shortest route between any two positions or techniques</p>
        </div>
        <div className="path-controls">
          <div className="path-field">
            <label className="path-field-label" htmlFor="path-from">FROM</label>
            <input id="path-from" className="path-combobox" type="text" placeholder="Search techniques…" />
          </div>
          <div className="path-field">
            <label className="path-field-label" htmlFor="path-to">TO</label>
            <input id="path-to" className="path-combobox" type="text" placeholder="Search techniques…" />
          </div>
          <button type="button">Find Path</button>
        </div>
        <div id="path-result" aria-live="polite"></div>
      </div>
    </div>
  )
}
