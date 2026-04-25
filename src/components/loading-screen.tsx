"use client"

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-inner">
        <div className="brand-word" style={{ fontSize: 40 }}>
        anon-chat<em>.</em>com
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Establishing secure channel
        </div>
        <div className="dots" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}
