"use client"

import { themes } from "@/lib/themes"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react"

export const EDITORIAL_THEMES = [
  "mono",
  "sepia",
  "night",
  "terminal",
  "red",
  "pink",
  "acid",
] as const
export type EditorialTheme = (typeof EDITORIAL_THEMES)[number]

export const LEGACY_THEME_NAMES = Object.keys(themes).sort()

export type ThemeId = EditorialTheme | string // string = legacy name
export type ThemeKind = "editorial" | "legacy"

type ThemeContextType = {
  theme: ThemeId
  kind: ThemeKind
  setTheme: (id: ThemeId) => void
  editorialThemes: readonly EditorialTheme[]
  legacyThemes: readonly string[]
}

const DEFAULT_THEME: ThemeId = "mono"

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  kind: "editorial",
  setTheme: () => {},
  editorialThemes: EDITORIAL_THEMES,
  legacyThemes: LEGACY_THEME_NAMES,
})

const isEditorial = (v: string | null): v is EditorialTheme =>
  !!v && (EDITORIAL_THEMES as readonly string[]).includes(v)
const isLegacy = (v: string | null): v is string =>
  !!v && Object.prototype.hasOwnProperty.call(themes, v)

const getThemeSnapshot = (): ThemeId => {
  if (typeof window === "undefined") return DEFAULT_THEME
  const saved = localStorage.getItem("theme")
  if (isEditorial(saved) || isLegacy(saved)) return saved
  return DEFAULT_THEME
}

const getServerThemeSnapshot = (): ThemeId => DEFAULT_THEME

const subscribeTheme = (cb: () => void) => {
  window.addEventListener("storage", cb)
  window.addEventListener("theme-change", cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener("theme-change", cb)
  }
}

const EDITORIAL_VARS = [
  "--bg",
  "--paper",
  "--ink",
  "--ink-2",
  "--ink-3",
  "--muted",
  "--muted-2",
  "--rule",
  "--rule-soft",
  "--accent",
  "--accent-ink",
  "--signal",
  "--danger",
  "--highlight",
] as const

function deriveEditorialFromLegacy(vars: Record<string, string>) {
  const bg = vars["--background"] ?? ""
  const fg = vars["--foreground"] ?? ""
  const card = vars["--card"] ?? bg
  const mutedFg = vars["--muted-foreground"] ?? fg
  const border = vars["--border"] ?? ""
  const primary = vars["--primary"] ?? fg
  const primaryFg = vars["--primary-foreground"] ?? bg
  const destructive = vars["--destructive"] ?? primary

  return {
    "--bg": bg,
    "--paper": card,
    "--ink": fg,
    "--ink-2": fg,
    "--ink-3": mutedFg,
    "--muted": mutedFg,
    "--muted-2": mutedFg,
    "--rule": border,
    "--rule-soft": border,
    "--accent": primary,
    "--accent-ink": primaryFg,
    "--signal": primary,
    "--danger": destructive,
    "--highlight": primary,
  } as Record<string, string>
}

function applyEditorial(theme: EditorialTheme) {
  const root = document.documentElement
  root.setAttribute("data-theme", theme)
  EDITORIAL_VARS.forEach((v) => root.style.removeProperty(v))
  ;[
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted-foreground",
    "--accent-foreground",
    "--destructive",
    "--destructive-foreground",
    "--border",
    "--input",
    "--ring",
  ].forEach((v) => root.style.removeProperty(v))
}

function applyLegacy(name: string) {
  const def = themes[name]
  if (!def) return
  const root = document.documentElement
  root.removeAttribute("data-theme")

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const active = prefersDark && def.dark ? def.dark : def.light

  Object.entries(active).forEach(([k, v]) => root.style.setProperty(k, v))

  const editorial = deriveEditorialFromLegacy(active)
  Object.entries(editorial).forEach(([k, v]) => root.style.setProperty(k, v))
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  )
  const kind: ThemeKind = isEditorial(theme) ? "editorial" : "legacy"

  const setTheme = useCallback((id: ThemeId) => {
    localStorage.setItem("theme", id)
    window.dispatchEvent(new Event("theme-change"))
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isEditorial(theme)) applyEditorial(theme)
    else if (isLegacy(theme)) applyLegacy(theme)
  }, [theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        kind,
        setTheme,
        editorialThemes: EDITORIAL_THEMES,
        legacyThemes: LEGACY_THEME_NAMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

export const AVAILABLE_THEMES = EDITORIAL_THEMES
export type ThemeName = EditorialTheme
