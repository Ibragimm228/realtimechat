"use client"

import { client } from "@/lib/client"
import { useRealtime } from "@/lib/realtime-client"
import { useToast } from "@/components/toast"
import { useUsername } from "@/hooks/use-username"
import { useSound } from "@/hooks/use-sound"
import type { ChatType } from "@/hooks/use-active-chats"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const ROOM_EVENTS = ["chat.message", "chat.destroy", "chat.typing", "chat.join", "chat.leave", "chat.delete", "chat.react", "chat.pin"] as const
const CHANNEL_EVENTS = ["channel.message", "channel.typing", "channel.delete", "channel.react", "channel.pin"] as const
const GROUP_EVENTS = ["group.message", "group.typing", "group.delete", "group.destroy", "group.react", "group.pin"] as const

function realtimeConfig(type: ChatType, id: string) {
  switch (type) {
    case "room": return {
      channels: [id], events: ROOM_EVENTS,
      messageEvent: "chat.message" as string, deleteEvent: "chat.delete" as string,
      typingEvent: "chat.typing" as string, destroyEvent: "chat.destroy" as string | undefined,
      reactEvent: "chat.react" as string, pinEvent: "chat.pin" as string,
    }
    case "channel": return {
      channels: [`ch:${id}`], events: CHANNEL_EVENTS,
      messageEvent: "channel.message" as string, deleteEvent: "channel.delete" as string,
      typingEvent: "channel.typing" as string, destroyEvent: undefined as string | undefined,
      reactEvent: "channel.react" as string, pinEvent: "channel.pin" as string,
    }
    case "group": return {
      channels: [`grp:${id}`], events: GROUP_EVENTS,
      messageEvent: "group.message" as string, deleteEvent: "group.delete" as string,
      typingEvent: "group.typing" as string, destroyEvent: "group.destroy" as string | undefined,
      reactEvent: "group.react" as string, pinEvent: "group.pin" as string,
    }
  }
}

export function useChatMessages({ type, id }: { type: ChatType; id: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const { username } = useUsername()
  const { playNotification } = useSound()

  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [decryptedTexts, setDecryptedTexts] = useState<Record<string, string>>({})
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, Record<string, { count: number; hasReacted: boolean }>>>({})
  const [pinnedMessages, setPinnedMessages] = useState<{ id: string; sender: string; text: string; pinnedBy: string }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(0)
  const typingTimeoutRef = useRef<NodeJS.Timeout>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [newMsgCount, setNewMsgCount] = useState(0)

  const { data: messages, refetch } = useQuery({
    queryKey: [type === "room" ? "messages" : `${type}-messages`, id],
    queryFn: async () => {
      switch (type) {
        case "room": return (await client.messages.get({ query: { roomId: id } })).data
        case "channel": return (await client["channel-messages"].get({ query: { channelId: id } })).data
        case "group": return (await client["group-messages"].get({ query: { groupId: id } })).data
      }
    },
  })

  const { refetch: refetchPinned } = useQuery({
    queryKey: ["pinned", type, id],
    queryFn: async () => {
      if (type !== "room") return { pinned: [] }
      const res = (await client.messages.pinned.get({ query: { roomId: id } })).data as { pinned: { id: string; sender: string; text: string; pinnedBy: string }[] } | undefined
      if (res?.pinned) setPinnedMessages(res.pinned)
      return res
    },
  })

  const { mutate: deleteMessage } = useMutation({
    mutationFn: async (messageId: string) => {
      switch (type) {
        case "room": await client.messages.delete(null, { query: { roomId: id, messageId } }); break
        case "channel": await client["channel-messages"].delete(null, { query: { channelId: id, messageId } }); break
        case "group": await client["group-messages"].delete(null, { query: { groupId: id, messageId } }); break
      }
    },
  })

  const { mutate: sendTyping } = useMutation({
    mutationFn: async (isTyping: boolean) => {
      switch (type) {
        case "room": await client.messages.typing.post({ username, isTyping }, { query: { roomId: id } }); break
        case "channel": await client["channel-messages"].typing.post({ username, isTyping }, { query: { channelId: id } }); break
        case "group": await client["group-messages"].typing.post({ username, isTyping }, { query: { groupId: id } }); break
      }
    },
  })

  const rt = useMemo(() => realtimeConfig(type, id), [type, id])

  useRealtime({
    channels: rt.channels,
    events: rt.events,
    onData: ({ event, data }) => {
      if (event === rt.messageEvent) { refetch(); playNotification() }
      if (event === rt.deleteEvent) refetch()
      if (rt.destroyEvent && event === rt.destroyEvent) router.push("/?destroyed=true")
      if (event === rt.typingEvent) {
        const td = data as { username: string; isTyping: boolean }
        if (td.username !== username) {
          setTypingUsers((prev) =>
            td.isTyping
              ? prev.includes(td.username) ? prev : [...prev, td.username]
              : prev.filter((u) => u !== td.username)
          )
        }
      }
      if (event === rt.reactEvent) {
        const rd = data as { messageId: string; emoji: string; action: string; token: string }
        setReactions((prev) => {
          const mr = { ...prev[rd.messageId] }
          const cur = mr[rd.emoji] || { count: 0, hasReacted: false }
          if (rd.action === "add") {
            mr[rd.emoji] = { count: cur.count + 1, hasReacted: cur.hasReacted || rd.token === "self" }
          } else {
            mr[rd.emoji] = { count: Math.max(0, cur.count - 1), hasReacted: false }
          }
          return { ...prev, [rd.messageId]: mr }
        })
      }
      if (event === rt.pinEvent) {
        const pd = data as { messageId: string; sender: string; text: string; action: string; pinnedBy: string }
        if (pd.action === "pin") {
          setPinnedMessages((prev) => [{ id: pd.messageId, sender: pd.sender, text: pd.text, pinnedBy: pd.pinnedBy }, ...prev.filter((p) => p.id !== pd.messageId)])
        } else {
          setPinnedMessages((prev) => prev.filter((p) => p.id !== pd.messageId))
        }
      }
    },
  })

  const handleTyping = useCallback(() => {
    sendTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000)
  }, [sendTyping])

  useEffect(() => {
    const len = messages?.messages?.length ?? 0
    if (len > 0 && len > lastMessageCountRef.current) {
      const el = scrollContainerRef.current
      if (el) {
        const near = el.scrollHeight - el.scrollTop - el.clientHeight < 150
        if (near) { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); setNewMsgCount(0) }
        else setNewMsgCount((p) => p + (len - lastMessageCountRef.current))
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }
    }
    lastMessageCountRef.current = len
  }, [messages?.messages?.length])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const fn = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 150
      setShowScrollBtn(!near)
      if (near) setNewMsgCount(0)
    }
    el.addEventListener("scroll", fn)
    return () => el.removeEventListener("scroll", fn)
  }, [])

  const copyMessage = useCallback(async (msgId: string) => {
    const txt = decryptedTexts[msgId]
    if (!txt) return
    try {
      await navigator.clipboard.writeText(txt)
      setCopiedMessageId(msgId)
      toast("Copied!", "success")
      setTimeout(() => setCopiedMessageId(null), 1500)
    } catch { toast("Failed to copy", "error") }
  }, [decryptedTexts, toast])

  const { mutate: pinMessage } = useMutation({
    mutationFn: async ({ messageId, action }: { messageId: string; action: "pin" | "unpin" }) => {
      if (type === "room") {
        await client.messages.pin.post({ messageId, action }, { query: { roomId: id } })
      }
    },
    onSuccess: () => refetchPinned(),
    onError: () => toast("Failed to pin message", "error"),
  })

  const handleReact = useCallback((messageId: string, emoji: string) => {
    setReactions((prev) => {
      const mr = { ...prev[messageId] }
      const cur = mr[emoji] || { count: 0, hasReacted: false }
      mr[emoji] = cur.hasReacted
        ? { count: Math.max(0, cur.count - 1), hasReacted: false }
        : { count: cur.count + 1, hasReacted: true }
      return { ...prev, [messageId]: mr }
    })
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    setNewMsgCount(0)
  }, [])

  const onDecrypted = useCallback((msgId: string, plaintext: string) => {
    setDecryptedTexts((prev) => ({ ...prev, [msgId]: plaintext }))
  }, [])

  return {
    messages, refetch, deleteMessage, sendTyping,
    typingUsers, decryptedTexts, copiedMessageId, reactions, pinnedMessages,
    messagesEndRef, scrollContainerRef, showScrollBtn, newMsgCount,
    handleTyping, copyMessage, handleReact, scrollToBottom, onDecrypted, pinMessage,
  }
}
