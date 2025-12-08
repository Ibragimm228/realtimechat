"use client"

import { themes, type Theme } from "@/lib/themes"
import { createContext, useContext, useEffect, useState } from "react"

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

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState("default")
  const [mounted, setMounted] = useState(false)

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme && themes[savedTheme]) {
      setTheme(savedTheme)
    } else {
      // Find a default or just use the first one
      const keys = Object.keys(themes)
      if (keys.length > 0) {
        setTheme(keys[0])
      }
    }
    setMounted(true)
  }, [])

  // Apply theme variables
  useEffect(() => {
    if (!mounted) return

    const themeData = themes[theme]
    if (!themeData) return

    const root = document.documentElement
    const vars = themeData.light // Currently only supporting light mode or we can auto-detect
    
    // Check system preference for dark mode if theme supports it
    // For simplicity, we'll just apply 'light' for now unless we add a dark mode toggle
    // Or we can merge them if the user wants auto-switching. 
    // Given the request, let's stick to the 'light' definitions as the base for the theme
    // but actually most themes provided had .dark block too.
    
    // Let's implement basic dark mode support:
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const activeVars = isDark && themeData.dark ? themeData.dark : themeData.light

    Object.entries(activeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    localStorage.setItem("theme", theme)
  }, [theme, mounted])

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
