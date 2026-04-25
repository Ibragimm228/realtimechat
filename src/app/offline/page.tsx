"use client"

export default function OfflinePage() {
  return (
    <div className="frame" style={{ justifyContent: "center", alignItems: "center" }}>
      <div className="empty-state" style={{ maxWidth: 460 }}>
        <div className="kicker"><span>— Offline —</span></div>
        <h3>No connection</h3>
        <p>
          You&apos;re offline. Messages will be sent when the connection is restored.
        </p>
        <button
          className="btn-primary"
          style={{ marginTop: 12 }}
          onClick={() => window.location.reload()}
        >
          Retry ↻
        </button>
      </div>
    </div>
  )
}
