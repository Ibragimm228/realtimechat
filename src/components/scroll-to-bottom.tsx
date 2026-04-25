"use client"

interface ScrollToBottomProps {
  visible: boolean
  unreadCount: number
  onClick: () => void
}

export function ScrollToBottom({ visible, unreadCount, onClick }: ScrollToBottomProps) {
  if (!visible) return null

  return (
    <button
      onClick={onClick}
      className="scroll-bottom show"
      style={{
        position: "fixed",
        bottom: 96,
        right: 24,
        zIndex: 30,
      }}
      title="Scroll to bottom"
    >
      <span>↓</span>
      {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
  )
}
