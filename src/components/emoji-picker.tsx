"use client"

import { useState, useRef, useEffect } from "react"

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "Smileys": [
    "\uD83D\uDE00", "\uD83D\uDE02", "\uD83D\uDE05", "\uD83D\uDE09", "\uD83D\uDE0D", "\uD83E\uDD29",
    "\uD83D\uDE18", "\uD83D\uDE1C", "\uD83E\uDD14", "\uD83E\uDD2D", "\uD83E\uDD2F", "\uD83D\uDE31",
    "\uD83D\uDE24", "\uD83D\uDE21", "\uD83E\uDD71", "\uD83D\uDE34", "\uD83E\uDD22", "\uD83E\uDD2E",
    "\uD83E\uDD27", "\uD83D\uDE07", "\uD83E\uDD20", "\uD83E\uDD73", "\uD83E\uDD7A", "\uD83D\uDE0E",
  ],
  "Gestures": [
    "\uD83D\uDC4D", "\uD83D\uDC4E", "\uD83D\uDC4A", "\u270C\uFE0F", "\uD83E\uDD1E", "\uD83E\uDD1F",
    "\uD83D\uDC4B", "\uD83D\uDC4F", "\uD83D\uDE4F", "\uD83D\uDCAA", "\u2764\uFE0F", "\uD83D\uDD25",
    "\u2B50", "\uD83C\uDF1F", "\uD83D\uDCA5", "\uD83D\uDCA9", "\uD83D\uDC80", "\uD83D\uDC7B",
  ],
  "Objects": [
    "\uD83D\uDD12", "\uD83D\uDD11", "\uD83D\uDCAC", "\uD83D\uDCE8", "\uD83D\uDCCE", "\uD83D\uDCBB",
    "\u231A", "\uD83D\uDCF1", "\uD83C\uDFAE", "\uD83C\uDFB5", "\uD83C\uDFB6", "\uD83D\uDCA1",
    "\u2705", "\u274C", "\u26A0\uFE0F", "\uD83D\uDEA8", "\uD83C\uDF89", "\uD83C\uDF8A",
  ],
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState("Smileys")
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        title="Emoji"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
          <div className="flex border-b border-border">
            {Object.keys(EMOJI_CATEGORIES).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeCategory === cat
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="p-2 grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
            {EMOJI_CATEGORIES[activeCategory].map((emoji, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelect(emoji)
                  setIsOpen(false)
                }}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
