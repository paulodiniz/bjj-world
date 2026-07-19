export default function HistoryPage() {
  return (
    <div className="history-area" role="main" aria-label="Chat history">
      <div className="history-inner">
        <div className="history-head">
          <h2 className="history-title">History</h2>
          <a href="/" className="history-new-btn">+ New conversation</a>
        </div>
        <div id="history-list"></div>
      </div>
    </div>
  )
}
