"use client"

import { useTheme } from "./theme-provider"
import { useState, useRef, useEffect } from "react"

export const ThemeSelector = () => {
  const { theme, setTheme, availableThemes } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:opacity-80 transition-all border border-border cursor-pointer shadow-sm"
      >
        <div className="w-3 h-3 rounded-full bg-primary border border-primary-foreground/20" />
        <span className="uppercase tracking-wider max-w-[100px] truncate">
          {theme.replace(/-/g, " ")}
        </span>
        <span className="text-muted-foreground ml-1">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 max-h-96 overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-50 py-1 scrollbar-thin">
          <div className="sticky top-0 bg-card p-2 border-b border-border mb-1 z-10">
             <span className="text-[10px] text-muted-foreground uppercase font-bold pl-2">Select Theme</span>
          </div>
          {availableThemes.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTheme(t)
                setIsOpen(false)
              }}
              className={`w-full text-left px-4 py-2.5 text-xs uppercase font-medium transition-colors flex items-center gap-3 cursor-pointer
                ${theme === t 
                  ? "bg-primary text-primary-foreground" 
                  : "text-card-foreground hover:bg-muted"
                }
              `}
            >
              <div className={`w-2 h-2 rounded-full ${theme === t ? "bg-primary-foreground" : "bg-primary"}`} />
              {t.replace(/-/g, " ")}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
