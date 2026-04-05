"use client"

import { useState } from "react"

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

interface MessageReactionsProps {
  reactions: Reaction[]
  onReact: (emoji: string) => void
}

export function MessageReactions({ reactions, onReact }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false)

  const activeReactions = reactions.filter((r) => r.count > 0)

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1 relative">
      {activeReactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onReact(r.emoji)}
          className={`
            flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold transition-all active:scale-90
            ${r.hasReacted
              ? "bg-primary/15 text-primary border border-primary/30"
              : "bg-muted text-muted-foreground border border-transparent hover:border-border"
            }
          `}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setShowPicker((p) => !p)}
          className="w-6 h-6 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground/50 hover:text-muted-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 bg-card border border-border rounded-xl shadow-xl p-1.5 animate-in fade-in zoom-in-95 duration-150 z-50">
            {REACTION_EMOJIS.map((r) => (
              <button
                key={r.label}
                onClick={() => {
                  onReact(r.emoji)
                  setShowPicker(false)
                }}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded-lg transition-all hover:scale-110"
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { REACTION_EMOJIS }
