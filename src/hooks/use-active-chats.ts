import { useSyncExternalStore, useCallback } from "react"

export type ChatType = "room" | "channel" | "group"

export type ActiveChat = {
  type: ChatType
  id: string
  name: string
  encryptionKey: string
  joinedAt: number
}

const STORAGE_KEY = "active_chats"
let listeners: Array<() => void> = []

function emitChange() {
  for (const listener of listeners) listener()
}

function getChats(): ActiveChat[] {
  if (typeof window === "undefined") return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveChats(chats: ActiveChat[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  emitChange()
}

const getSnapshot = () => {
  if (typeof window === "undefined") return "[]"
  return sessionStorage.getItem(STORAGE_KEY) || "[]"
}

const getServerSnapshot = () => "[]"

const subscribe = (callback: () => void) => {
  listeners.push(callback)
  return () => {
    listeners = listeners.filter((l) => l !== callback)
  }
}

export function useActiveChats() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  let chats: ActiveChat[] = []
  try {
    chats = JSON.parse(raw)
  } catch {
    chats = []
  }

  const addChat = useCallback((chat: Omit<ActiveChat, "joinedAt">) => {
    const current = getChats()
    const exists = current.find((c) => c.type === chat.type && c.id === chat.id)
    if (exists) {
      if (exists.encryptionKey !== chat.encryptionKey || exists.name !== chat.name) {
        const updated = current.map((c) =>
          c.type === chat.type && c.id === chat.id
            ? { ...c, name: chat.name, encryptionKey: chat.encryptionKey }
            : c
        )
        saveChats(updated)
      }
      return
    }
    saveChats([{ ...chat, joinedAt: Date.now() }, ...current])
  }, [])

  const removeChat = useCallback((type: ChatType, id: string) => {
    const current = getChats()
    saveChats(current.filter((c) => !(c.type === type && c.id === id)))
  }, [])

  return { chats, addChat, removeChat }
}
