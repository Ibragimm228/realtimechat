"use client"

import { useEffect, useRef, useState } from "react"

const REACTION_EMOJIS = [
  { emoji: "\uD83D\uDC4D", label: "like" },
  { emoji: "\uD83D\uDD25", label: "fire" },
  { emoji: "\u2764\uFE0F", label: "heart" },
  { emoji: "\uD83D\uDE02", label: "laugh" },
  { emoji: "\uD83D\uDE2E", label: "wow" },
  { emoji: "\uD83D\uDE22", label: "sad" },
]

interface Reaction {
  emoji: string
  count: number
  hasReacted: boolean
}

export function MessageReactions({
  reactions,
  onReact,
  align = "start",
}: {
  reactions: Reaction[]
  onReact: (emoji: string) => void
  align?: "start" | "end"
}) {
  const active = reactions.filter((r) => r.count > 0)
  if (active.length === 0) return null
  return (
    <div
      className="reactions"
      style={{ justifyContent: align === "end" ? "flex-end" : "flex-start" }}
    >
      {active.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={`reaction ${r.hasReacted ? "mine" : ""}`}
          onClick={() => onReact(r.emoji)}
          title={r.hasReacted ? "Remove reaction" : "Add reaction"}
        >
          <span className="sym">{r.emoji}</span>
          <span className="rct-count">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

export function ReactionPicker({
  onReact,
  align = "start",
  variant = "icon",
}: {
  onReact: (emoji: string) => void
  align?: "start" | "end"
  variant?: "icon" | "pill"
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        title="Add reaction"
        aria-label="Add reaction"
        className={variant === "pill" ? `reaction reaction-add ${open ? "active" : ""}` : open ? "active" : ""}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {variant === "pill" ? (
          <>
            <span className="sym">🙂</span>
            <span className="rct-count">+</span>
          </>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 10h.01M15 10h.01" />
            <path d="M8.5 15a4 4 0 0 0 7 0" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="react-picker"
          style={{
            top: "auto",
            bottom: "calc(100% + 6px)",
            ...(align === "end"
              ? { right: 0, left: "auto" }
              : { left: 0, right: "auto" }),
          }}
        >
          {REACTION_EMOJIS.map((r) => (
            <button
              key={r.emoji}
              type="button"
              title={r.label}
              onClick={() => {
                onReact(r.emoji)
                setOpen(false)
              }}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

export { REACTION_EMOJIS }
