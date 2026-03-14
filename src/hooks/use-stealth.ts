"use client"

import { useEffect, useState, useCallback } from "react"

const STEALTH_TITLES: Record<string, { title: string; favicon: string }> = {
  google: { title: "Google", favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>" },
  gmail: { title: "Inbox (3) - Gmail", favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📧</text></svg>" },
  docs: { title: "Untitled document - Google Docs", favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📄</text></svg>" },
}

export function useStealth() {
  const [isActive, setIsActive] = useState(false)
  const [originalTitle, setOriginalTitle] = useState("")
  const [originalFavicon, setOriginalFavicon] = useState("")

  const activate = useCallback(() => {
    if (isActive) return
    setOriginalTitle(document.title)
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    setOriginalFavicon(link?.href || "")

    const disguise = STEALTH_TITLES.google
    document.title = disguise.title
    let faviconEl = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    if (!faviconEl) {
      faviconEl = document.createElement("link")
      faviconEl.rel = "icon"
      document.head.appendChild(faviconEl)
    }
    faviconEl.href = disguise.favicon
    setIsActive(true)
  }, [isActive])

  const deactivate = useCallback(() => {
    if (!isActive) return
    document.title = originalTitle
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    if (link && originalFavicon) link.href = originalFavicon
    setIsActive(false)
  }, [isActive, originalTitle, originalFavicon])

  const toggle = useCallback(() => {
    if (isActive) deactivate()
    else activate()
  }, [isActive, activate, deactivate])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [toggle])

  return { isStealthActive: isActive, toggleStealth: toggle }
}
