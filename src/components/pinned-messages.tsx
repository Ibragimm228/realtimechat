"use client"

import { useState } from "react"

interface PinnedMessage {
  id: string
  sender: string
  text: string
  pinnedBy: string
}

export function PinnedMessages({
  messages,
  decryptedTexts,
  onScrollTo,
  onUnpin,
}: {
  messages: PinnedMessage[]
  decryptedTexts: Record<string, string>
  onScrollTo: (id: string) => void
  onUnpin?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (messages.length === 0) return null

  const latest = messages[0]
  const latestText = decryptedTexts[latest.id]

  return (
    <div className="border-b border-border bg-muted/30 backdrop-blur-sm">
      <button
        onClick={() => messages.length > 1 ? setExpanded(!expanded) : onScrollTo(latest.id)}
        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted/50 transition-colors group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
          <line x1="12" y1="17" x2="12" y2="3" />
          <path d="m5 10 7-7 7 7" />
          <line x1="4" y1="21" x2="20" y2="21" />
        </svg>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{latest.sender}</span>
          <p className="text-xs text-foreground/80 truncate">{latestText || "Encrypted message"}</p>
        </div>
        {messages.length > 1 && (
          <span className="text-[10px] text-muted-foreground font-bold shrink-0">
            {messages.length} pinned
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`inline ml-1 transition-transform ${expanded ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        )}
      </button>

      {expanded && (
        <div className="max-h-48 overflow-y-auto border-t border-border/50 divide-y divide-border/30">
          {messages.map((msg) => {
            const text = decryptedTexts[msg.id]
            return (
              <div
                key={msg.id}
                className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => { onScrollTo(msg.id); setExpanded(false) }}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-primary">{msg.sender}</span>
                  <p className="text-xs text-foreground/80 truncate">{text || "Encrypted message"}</p>
                  <span className="text-[9px] text-muted-foreground/50">pinned by {msg.pinnedBy}</span>
                </div>
                {onUnpin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUnpin(msg.id) }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    title="Unpin"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
