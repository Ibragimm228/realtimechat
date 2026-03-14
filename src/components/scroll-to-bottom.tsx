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
      className="fixed bottom-24 right-6 z-30 w-10 h-10 rounded-full bg-card border border-border shadow-xl flex items-center justify-center hover:bg-muted transition-all active:scale-90 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  )
}
