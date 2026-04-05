"use client"

import { useActiveChats, type ActiveChat, type ChatType } from "@/hooks/use-active-chats"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"

const typeConfig: Record<ChatType, { icon: string; label: string; prefix: string }> = {
  room: { icon: "\uD83D\uDD12", label: "Room", prefix: "/room/" },
  channel: { icon: "\uD83D\uDCE2", label: "Channel", prefix: "/channel/" },
  group: { icon: "\uD83D\uDC65", label: "Group", prefix: "/group/" },
}

function ChatItem({
  chat,
  isActive,
  onRemove,
}: {
  chat: ActiveChat
  isActive: boolean
  onRemove: () => void
}) {
  const config = typeConfig[chat.type]
  const href = `${config.prefix}${chat.id}#${chat.encryptionKey}`

  return (
    <div
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
        isActive
          ? "bg-primary/15 text-primary"
          : "hover:bg-muted text-foreground"
      }`}
      onClick={() => {
        if (!isActive) window.location.href = href
      }}
    >
      <span className="text-base shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate">{chat.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(chat.joinedAt, { addSuffix: true })}
        </div>
      </div>
      {isActive && (
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" title="Active" />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all shrink-0"
        title="Remove from list"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

export function ChatSidebar({
  currentType,
  currentId,
}: {
  currentType: ChatType
  currentId: string
}) {
  const { chats, removeChat } = useActiveChats()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<number | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        setIsOpen((p) => !p)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0].clientX < 30) {
        touchStartRef.current = e.touches[0].clientX
      }
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartRef.current !== null) {
        const diff = e.changedTouches[0].clientX - touchStartRef.current
        if (diff > 80) setIsOpen(true)
        touchStartRef.current = null
      }
    }
    window.addEventListener("touchstart", handleTouchStart, { passive: true })
    window.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [])

  const rooms = chats.filter((c) => c.type === "room")
  const channels = chats.filter((c) => c.type === "channel")
  const groups = chats.filter((c) => c.type === "group")

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-3 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-card border border-border shadow-lg hover:bg-muted transition-all group"
        title="Chats (Alt+S)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground transition-colors">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {chats.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {chats.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-[60] animate-in fade-in duration-200" />
      )}

      <div
        ref={panelRef}
        className={`fixed left-0 top-0 h-full w-72 bg-card border-r border-border shadow-2xl z-[70] transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-wider text-foreground">Chats</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground font-bold">
              {chats.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {chats.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-muted-foreground text-xs">No active chats</p>
              <Link href="/" className="text-primary text-xs font-bold mt-2 inline-block hover:underline">
                Create one
              </Link>
            </div>
          )}

          {rooms.length > 0 && (
            <Section label="Rooms" count={rooms.length}>
              {rooms.map((c) => (
                <ChatItem
                  key={c.id}
                  chat={c}
                  isActive={currentType === "room" && currentId === c.id}
                  onRemove={() => removeChat("room", c.id)}
                />
              ))}
            </Section>
          )}

          {groups.length > 0 && (
            <Section label="Groups" count={groups.length}>
              {groups.map((c) => (
                <ChatItem
                  key={c.id}
                  chat={c}
                  isActive={currentType === "group" && currentId === c.id}
                  onRemove={() => removeChat("group", c.id)}
                />
              ))}
            </Section>
          )}

          {channels.length > 0 && (
            <Section label="Channels" count={channels.length}>
              {channels.map((c) => (
                <ChatItem
                  key={c.id}
                  chat={c}
                  isActive={currentType === "channel" && currentId === c.id}
                  onRemove={() => removeChat("channel", c.id)}
                />
              ))}
            </Section>
          )}
        </div>

        <div className="p-3 border-t border-border">
          <div className="text-[10px] text-muted-foreground/40 text-center font-mono">
            Alt+S to toggle · Swipe from left edge on mobile
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground/50">{count}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
