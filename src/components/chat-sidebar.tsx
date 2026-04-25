"use client"

import { useActiveChats, type ActiveChat, type ChatType } from "@/hooks/use-active-chats"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"

const typeConfig: Record<ChatType, { label: string; prefix: string }> = {
  room: { label: "Room", prefix: "/room/" },
  channel: { label: "Channel", prefix: "/channel/" },
  group: { label: "Group", prefix: "/group/" },
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
  const cfg = typeConfig[chat.type]
  const href = `${cfg.prefix}${chat.id}#${chat.encryptionKey}`

  return (
    <div
      className={`room-item ${isActive ? "active" : ""}`}
      onClick={() => {
        if (!isActive) window.location.href = href
      }}
    >
      <div className="rid" title={chat.name}>{chat.name}</div>
      <div className="rmeta">{cfg.label}</div>
      <div className="rlast">{formatDistanceToNow(chat.joinedAt, { addSuffix: true })}</div>
      <button
        className="rclose"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        title="Remove from list"
      >
        remove ✕
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
      if (e.touches[0].clientX < 30) touchStartRef.current = e.touches[0].clientX
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
        className="icon-btn"
        style={{ position: "fixed", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 50, width: 36, height: 36 }}
        title="Chats (Alt+S)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {chats.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--accent)",
              color: "var(--accent-ink)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 600,
              display: "grid",
              placeItems: "center",
            }}
          >
            {chats.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "color-mix(in srgb, var(--ink) 30%, transparent)",
            zIndex: 60,
            animation: "fadeIn .2s ease",
          }}
        />
      )}

      <aside
        ref={panelRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          height: "100%",
          width: 300,
          background: "var(--bg)",
          borderRight: "1px solid var(--rule)",
          zIndex: 70,
          transform: isOpen ? "translateX(0)" : "translateX(-105%)",
          transition: "transform .3s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="brand-mark">CHATS</div>
            <span className="mono text-muted" style={{ fontSize: 11 }}>{chats.length}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link href="/" className="icon-btn" title="Home">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <button onClick={() => setIsOpen(false)} className="icon-btn" title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.length === 0 && (
            <div className="empty-state">
              <div className="kicker"><span>— Empty —</span></div>
              <h3>No active chats</h3>
              <p>Start or join one from the home screen.</p>
              <Link href="/" className="btn-ghost">Home</Link>
            </div>
          )}

          {rooms.length > 0 && (
            <div className="side-section">
              <h4>Rooms <span className="mono text-muted">{rooms.length}</span></h4>
              {rooms.map((c) => (
                <ChatItem
                  key={c.id}
                  chat={c}
                  isActive={currentType === "room" && currentId === c.id}
                  onRemove={() => removeChat("room", c.id)}
                />
              ))}
            </div>
          )}

          {groups.length > 0 && (
            <div className="side-section">
              <h4>Groups <span className="mono text-muted">{groups.length}</span></h4>
              {groups.map((c) => (
                <ChatItem
                  key={c.id}
                  chat={c}
                  isActive={currentType === "group" && currentId === c.id}
                  onRemove={() => removeChat("group", c.id)}
                />
              ))}
            </div>
          )}

          {channels.length > 0 && (
            <div className="side-section">
              <h4>Channels <span className="mono text-muted">{channels.length}</span></h4>
              {channels.map((c) => (
                <ChatItem
                  key={c.id}
                  chat={c}
                  isActive={currentType === "channel" && currentId === c.id}
                  onRemove={() => removeChat("channel", c.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--rule-soft)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: "var(--muted-2)",
            textAlign: "center",
          }}
        >
          Alt+S to toggle · swipe from left
        </div>
      </aside>
    </>
  )
}
