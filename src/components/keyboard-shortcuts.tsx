"use client"

import { useEffect, useState } from "react"

const SHORTCUTS = [
  { keys: ["Alt", "P"], description: "Toggle Panic Mode (blur screen)" },
  { keys: ["Alt", "S"], description: "Toggle Chat Sidebar" },
  { keys: ["Esc"], description: "Toggle Panic Mode" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line" },
  { keys: ["Ctrl", "/"], description: "Show this shortcuts panel" },
]

const COMMANDS = [
  { command: "/w <text>", description: "Send a whisper (click to reveal, auto-expires)" },
  { command: "/b <text>", description: "Send a burn message (self-destructs in 15s)" },
  { command: "/code <text>", description: "Send a code snippet (monospace block)" },
]

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault()
        setIsOpen((p) => !p)
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false) }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-black uppercase tracking-wider">Keyboard Shortcuts</h2>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Shortcuts</h3>
            {SHORTCUTS.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-foreground/80">{s.description}</span>
                <div className="flex gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="px-2 py-0.5 bg-muted border border-border rounded text-[11px] font-mono font-bold text-muted-foreground">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Message Commands</h3>
            {COMMANDS.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-foreground/80">{c.description}</span>
                <code className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {c.command}
                </code>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Formatting</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <code className="font-mono text-muted-foreground">**bold**</code>
                <span className="font-bold">bold</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-muted-foreground">*italic*</code>
                <span className="italic">italic</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-muted-foreground">~~strike~~</code>
                <span className="line-through">strike</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-muted-foreground">`code`</code>
                <code className="bg-muted px-1 rounded text-[11px]">code</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
