"use client"

interface EmptyStateProps {
  type: "room" | "channel" | "group"
}

export function EmptyState({ type }: EmptyStateProps) {
  const config = {
    room: {
      title: "Secure room ready",
      subtitle: "Messages are end-to-end encrypted. Share the link to invite someone.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/30">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    channel: {
      title: "Channel created",
      subtitle: "Only admins can post. Share the link for others to subscribe.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/30">
          <path d="m3 11 18-5v12L3 13v-2z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      ),
    },
    group: {
      title: "Group ready",
      subtitle: "Everyone can post. Start the conversation!",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/30">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  }

  const c = config[type]

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-500">
      <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center">
        {c.icon}
      </div>
      <div className="text-center space-y-1.5 max-w-xs">
        <p className="text-sm font-bold text-foreground/60">{c.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{c.subtitle}</p>
      </div>
      <div className="flex gap-4 text-[10px] text-muted-foreground/40 mt-2">
        <span>/w whisper</span>
        <span>/b burn</span>
        <span>/code snippet</span>
      </div>
    </div>
  )
}
