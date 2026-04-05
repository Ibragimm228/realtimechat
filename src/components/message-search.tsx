"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface MessageSearchProps {
  decryptedTexts: Record<string, string>
  onHighlight: (messageId: string | null) => void
}

export function MessageSearch({ decryptedTexts, onHighlight }: MessageSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const closeSearch = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setResults([])
    setActiveIndex(0)
    onHighlight(null)
  }, [onHighlight])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault()
        setIsOpen((p) => !p)
      }
      if (e.key === "Escape" && isOpen) {
        closeSearch()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [closeSearch, isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const search = useCallback((q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); onHighlight(null); return }
    const lower = q.toLowerCase()
    const found = Object.entries(decryptedTexts)
      .filter(([, text]) => text.toLowerCase().includes(lower))
      .map(([id]) => id)
    setResults(found)
    setActiveIndex(0)
    if (found.length > 0) onHighlight(found[0])
    else onHighlight(null)
  }, [decryptedTexts, onHighlight])

  const navigate = (dir: 1 | -1) => {
    if (results.length === 0) return
    const next = (activeIndex + dir + results.length) % results.length
    setActiveIndex(next)
    onHighlight(results[next])
    document.getElementById(`msg-${results[next]}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  if (!isOpen) return null

  return (
    <div className="absolute top-16 right-4 z-30 bg-card border border-border rounded-xl shadow-xl p-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => search(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") navigate(e.shiftKey ? -1 : 1) }}
        placeholder="Search messages..."
        className="bg-transparent outline-none text-sm w-48 text-foreground placeholder:text-muted-foreground"
      />
      {results.length > 0 && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {activeIndex + 1}/{results.length}
        </span>
      )}
      <div className="flex gap-0.5">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground" disabled={results.length === 0}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        </button>
        <button onClick={() => navigate(1)} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground" disabled={results.length === 0}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>
      <button onClick={closeSearch} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}
