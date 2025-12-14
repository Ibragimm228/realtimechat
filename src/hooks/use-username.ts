import { generateRandomName } from "@/lib/name-generator"
import { useSyncExternalStore, useCallback } from "react"

const STORAGE_KEY = "chat_username"

const getSnapshot = () => {
  if (typeof window === "undefined") return ""
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return stored
  const generated = generateRandomName()
  localStorage.setItem(STORAGE_KEY, generated)
  return generated
}

const getServerSnapshot = () => ""

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

export const useUsername = () => {
  const username = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const regenerate = useCallback(() => {
    const newName = generateRandomName()
    localStorage.setItem(STORAGE_KEY, newName)
    window.dispatchEvent(new Event("storage"))
  }, [])

  return { username: username || "...", regenerate }
}
