"use client"

import { themes } from "@/lib/themes"
import { createContext, useContext, useEffect, useSyncExternalStore, useCallback, useRef } from "react"

type ThemeContextType = {
  theme: string
  setTheme: (theme: string) => void
  availableThemes: string[]
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "default",
  setTheme: () => {},
  availableThemes: [],
})

const getThemeSnapshot = () => {
  if (typeof window === "undefined") return "default"
  const saved = localStorage.getItem("theme")
  if (saved && themes[saved]) return saved
  const keys = Object.keys(themes)
  return keys.length > 0 ? keys[0] : "default"
}

const getServerThemeSnapshot = () => "default"

const subscribeTheme = (callback: () => void) => {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot)
  const mounted = useRef(false)

  const setTheme = useCallback((newTheme: string) => {
    if (themes[newTheme]) {
      localStorage.setItem("theme", newTheme)
      window.dispatchEvent(new Event("storage"))
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    
    const themeData = themes[theme]
    if (!themeData) return

    const root = document.documentElement
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const activeVars = isDark && themeData.dark ? themeData.dark : themeData.light

    Object.entries(activeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  }, [theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        availableThemes: Object.keys(themes).sort(),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
