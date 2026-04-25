import { useSyncExternalStore, useCallback } from "react"

export type ChatType = "room" | "channel" | "group"

export type ActiveChat = {
  type: ChatType
  id: string
  name: string
  encryptionKey: string
  joinedAt: number
}

let listeners: Array<() => void> = []
let chatsStore: ActiveChat[] = []

function emitChange() {
  for (const listener of listeners) listener()
}

function getChats(): ActiveChat[] {
  return chatsStore
}

function saveChats(chats: ActiveChat[]) {
  chatsStore = chats
  emitChange()
}

const getSnapshot = () => JSON.stringify(chatsStore)

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
