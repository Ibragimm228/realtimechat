"use client"

interface EmptyStateProps {
  type: "room" | "channel" | "group"
}

const CONFIG = {
  room: {
    title: "Secure room ready",
    subtitle: "Messages are end-to-end encrypted. Share the link to invite someone.",
    kicker: "— 01 · Room —",
  },
  channel: {
    title: "Channel created",
    subtitle: "Only admins can post. Share the link for others to subscribe.",
    kicker: "— 02 · Channel —",
  },
  group: {
    title: "Group ready",
    subtitle: "Everyone can post. Start the conversation.",
    kicker: "— 03 · Group —",
  },
} as const

export function EmptyState({ type }: EmptyStateProps) {
  const c = CONFIG[type]
  return (
    <div className="empty-state" style={{ margin: "auto 0" }}>
      <div className="kicker">
        <span>{c.kicker}</span>
      </div>
      <h3>{c.title}</h3>
      <p>{c.subtitle}</p>
      <div className="legend" style={{ marginTop: 20 }}>
        <span><span className="dash" />/w whisper</span>
        <span><span className="dash" />/b burn</span>
        <span><span className="dash" />/code snippet</span>
      </div>
    </div>
  )
}
