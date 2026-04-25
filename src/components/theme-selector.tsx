"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme, EDITORIAL_THEMES, type EditorialTheme } from "./theme-provider"

const LABELS: Record<EditorialTheme, string> = {
  mono: "Mono",
  sepia: "Sepia",
  night: "Night",
  terminal: "Terminal",
  red: "Red",
  pink: "Pink",
  acid: "Acid",
}

export const ThemeSelector = () => {
  const { theme, setTheme, legacyThemes } = useTheme()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const popoverRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

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

  const filtered = filter
    ? legacyThemes.filter((n) => n.toLowerCase().includes(filter.toLowerCase()))
    : legacyThemes

  const isLegacyActive = !(EDITORIAL_THEMES as readonly string[]).includes(theme)

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
      <div className="theme-switch" role="radiogroup" aria-label="Theme">
        {EDITORIAL_THEMES.map((t) => (
          <button
            key={t}
            type="button"
            className={`sw-${t}`}
            data-active={theme === t}
            onClick={() => setTheme(t)}
            aria-label={LABELS[t]}
            title={LABELS[t]}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="More themes"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          border: "1px solid var(--rule)",
          borderRadius: "var(--radius)",
          background: open || isLegacyActive ? "var(--ink)" : "transparent",
          color: open || isLegacyActive ? "var(--bg)" : "var(--ink)",
          cursor: "pointer",
          transition: "background .12s, color .12s",
          height: 24,
          lineHeight: 1,
        }}
      >
        <span>{isLegacyActive ? truncate(String(theme), 10) : "+more"}</span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="popover"
          style={{
            top: "calc(100% + 8px)",
            right: 0,
            width: 260,
            maxHeight: 380,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          role="listbox"
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--rule-soft)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              All themes <span style={{ color: "var(--muted-2)" }}>{legacyThemes.length}</span>
            </div>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search…"
              style={{
                border: "1px solid var(--rule-soft)",
                background: "var(--bg)",
                color: "var(--ink)",
                padding: "6px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                borderRadius: "var(--radius)",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ink)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule-soft)")}
            />
          </div>

          <div style={{ overflowY: "auto", padding: 6 }}>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: "16px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--muted)",
                  textAlign: "center",
                }}
              >
                No matches
              </div>
            )}
            {filtered.map((name) => {
              const active = theme === name
              return (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setTheme(name)
                    setOpen(false)
                    setFilter("")
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 10px",
                    border: "none",
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--bg)" : "var(--ink)",
                    textAlign: "left",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    letterSpacing: "0.04em",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    transition: "background .12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--bg)"
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent"
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      border: "1px solid var(--rule)",
                      background: swatchFor(name),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {name}
                  </span>
                  {active && <span style={{ opacity: 0.7 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

function swatchFor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes("amber")) return "#e4a42b"
  if (n.includes("amethyst") || n.includes("violet")) return "#7c5ce6"
  if (n.includes("caffeine") || n.includes("mocha")) return "#5a3e2b"
  if (n.includes("candy") || n.includes("bubble") || n.includes("pastel") || n.includes("rose")) return "#e48ab8"
  if (n.includes("catppuccin")) return "#b4befe"
  if (n.includes("claude") || n.includes("orange") || n.includes("tangerine")) return "#f08a3e"
  if (n.includes("clay") || n.includes("slate")) return "#9aa0a6"
  if (n.includes("cosmic") || n.includes("night") || n.includes("midnight") || n.includes("starry")) return "#1a2040"
  if (n.includes("cyber") || n.includes("acid")) return "#b6ff3a"
  if (n.includes("doom") || n.includes("red") || n.includes("retro")) return "#c62b1f"
  if (n.includes("dark")) return "#141414"
  if (n.includes("elegant") || n.includes("luxury")) return "#c6a15d"
  if (n.includes("graphite") || n.includes("mono")) return "#2a2a2a"
  if (n.includes("kodama") || n.includes("sage") || n.includes("nature")) return "#6a8f5a"
  if (n.includes("neo")) return "#f6ff3a"
  if (n.includes("northern")) return "#5ec6d0"
  if (n.includes("notebook") || n.includes("paper") || n.includes("vintage")) return "#ece4d1"
  if (n.includes("ocean") || n.includes("quantum")) return "#3a86c6"
  if (n.includes("perpetuity")) return "#2b3a4a"
  if (n.includes("soft pop")) return "#f8c8b4"
  if (n.includes("solar") || n.includes("sunset") || n.includes("supabase")) return "#3ecf8e"
  if (n.includes("t3")) return "#a16bff"
  if (n.includes("twitter")) return "#1da1f2"
  if (n.includes("vercel")) return "#0a0a0a"
  if (n.includes("tech")) return "#4a4a4a"
  if (n.includes("default")) return "#0a0a0a"
  return "#6e6e6e"
}
