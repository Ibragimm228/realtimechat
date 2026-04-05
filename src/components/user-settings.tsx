"use client"

import { useState } from "react"
import { DECOY_OPTIONS } from "./decoy-screen"

const FONT_SIZES = [
  { value: "sm", label: "Small" },
  { value: "base", label: "Normal" },
  { value: "lg", label: "Large" },
]

interface UserSettingsProps {
  open: boolean
  onClose: () => void
}

function getSetting<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(`setting:${key}`)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function setSetting(key: string, value: unknown) {
  localStorage.setItem(`setting:${key}`, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent("settings-changed", { detail: { key, value } }))
}

export function UserSettings({ open, onClose }: UserSettingsProps) {
  const [fontSize, setFontSize] = useState(() => getSetting("fontSize", "base"))
  const [decoyType, setDecoyType] = useState(() => getSetting("decoyType", "google"))
  const [soundEnabled, setSoundEnabled] = useState(() => getSetting("sound", true))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Message Font Size</label>
            <div className="flex gap-1.5">
              {FONT_SIZES.map((s) => (
                <button key={s.value} onClick={() => { setFontSize(s.value); setSetting("fontSize", s.value) }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${fontSize === s.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Decoy Screen</label>
            <div className="flex gap-1.5">
              {DECOY_OPTIONS.map((d) => (
                <button key={d.type} onClick={() => { setDecoyType(d.type); setSetting("decoyType", d.type) }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${decoyType === d.type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Sound Notifications</label>
            <button onClick={() => { const v = !soundEnabled; setSoundEnabled(v); setSetting("sound", v) }} className={`w-10 h-6 rounded-full transition-all ${soundEnabled ? "bg-primary" : "bg-muted"}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${soundEnabled ? "translate-x-4" : ""}`} />
            </button>
          </div>

          <div className="pt-2 border-t border-border">
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Keyboard Shortcuts</h3>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Panic Mode</span><kbd className="bg-muted px-1.5 py-0.5 rounded font-mono">Alt+P</kbd></div>
              <div className="flex justify-between"><span>Stealth Tab</span><kbd className="bg-muted px-1.5 py-0.5 rounded font-mono">Alt+G</kbd></div>
              <div className="flex justify-between"><span>Search</span><kbd className="bg-muted px-1.5 py-0.5 rounded font-mono">Ctrl+F</kbd></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
