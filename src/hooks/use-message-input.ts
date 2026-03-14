"use client"

import { encryptMessage } from "@/lib/crypto"
import { encryptFile } from "@/lib/file-crypto"
import { client } from "@/lib/client"
import { useToast } from "@/components/toast"
import { useUsername } from "@/hooks/use-username"
import type { ChatType } from "@/hooks/use-active-chats"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"

export function useMessageInput({ type, id, encryptionKey }: { type: ChatType; id: string; encryptionKey: CryptoKey | null }) {
  const { toast } = useToast()
  const { username } = useUsername()
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; text: string } | null>(null)

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!encryptionKey) return

      let content = text

      if (text.startsWith("/w ") || text.startsWith("/whisper ")) {
        content = `WHISPER:::${text.replace(/^\/(w|whisper)\s+/, "")}`
      } else if (text.startsWith("/b ") || text.startsWith("/burn ")) {
        content = `BURN:::${text.replace(/^\/(b|burn)\s+/, "")}`
      } else if (text.startsWith("/code ")) {
        content = `CODE:::${text.replace(/^\/code\s+/, "")}`
      } else if (text.startsWith("/ink ")) {
        content = `INK:::${text.replace(/^\/ink\s+/, "")}`
      }

      if (replyTo) {
        content = `REPLY:::${replyTo.sender}:::${replyTo.text.slice(0, 100)}:::${content}`
      }

      const isBurn = text.startsWith("/b ") || text.startsWith("/burn ")
      const encrypted = await encryptMessage(content, encryptionKey)
      const body = { sender: username, text: encrypted, ...(isBurn ? { burnAfter: 15 } : {}) }

      switch (type) {
        case "room": await client.messages.post(body, { query: { roomId: id } }); break
        case "channel": await client["channel-messages"].post(body, { query: { channelId: id } }); break
        case "group": await client["group-messages"].post(body, { query: { groupId: id } }); break
      }

      setInput("")
      setReplyTo(null)
      if (inputRef.current) inputRef.current.style.height = "inherit"
    },
    onError: () => toast("Failed to send message", "error"),
  })

  const sendFile = useCallback(async (file: File) => {
    if (!encryptionKey) return
    try {
      const encrypted = await encryptFile(file, encryptionKey)
      const prefix = file.type.startsWith("audio/") ? "VOICE" : "FILE"
      const wrappedContent = `${prefix}:::${encrypted}`
      const encryptedMsg = await encryptMessage(wrappedContent, encryptionKey)
      const body = { sender: username, text: encryptedMsg }

      switch (type) {
        case "room": await client.messages.post(body, { query: { roomId: id } }); break
        case "channel": await client["channel-messages"].post(body, { query: { channelId: id } }); break
        case "group": await client["group-messages"].post(body, { query: { groupId: id } }); break
      }
    } catch {
      toast("Failed to send file (max 5MB)", "error")
    }
  }, [encryptionKey, username, type, id, toast])

  return { input, setInput, inputRef, replyTo, setReplyTo, sendMessage, isPending, sendFile }
}
