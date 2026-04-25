"use client"

import { encryptMessage } from "@/lib/crypto"
import { encryptFile } from "@/lib/file-crypto"
import { client } from "@/lib/client"
import { MAX_ATTACHMENT_FILE_SIZE, MAX_TRANSPORT_MESSAGE_LENGTH } from "@/lib/message-limits"
import { useToast } from "@/components/toast"
import { useUsername } from "@/hooks/use-username"
import type { ChatType } from "@/hooks/use-active-chats"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"

type OptimisticMessage = {
  id: string
  sender: string
  text: string
  timestamp: number
  roomId: string
  token?: string
  burnAfter?: number
}

function createOptimisticId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useMessageInput({
  type,
  id,
  encryptionKey,
  onOptimisticMessage,
  onOptimisticRollback,
}: {
  type: ChatType
  id: string
  encryptionKey: CryptoKey | null
  onOptimisticMessage?: (message: OptimisticMessage) => void
  onOptimisticRollback?: (messageId: string) => void
}) {
  const { toast } = useToast()
  const { username } = useUsername()
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; text: string } | null>(null)

  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, optimisticId }: { text: string; optimisticId: string }) => {
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
      if (encrypted.length > MAX_TRANSPORT_MESSAGE_LENGTH) {
        throw new Error("Encrypted message is too large to send")
      }

      onOptimisticMessage?.({
        id: optimisticId,
        sender: username,
        text: encrypted,
        timestamp: Date.now(),
        roomId: id,
        token: "optimistic",
        ...(isBurn ? { burnAfter: 15 } : {}),
      })

      setInput("")
      setReplyTo(null)
      if (inputRef.current) inputRef.current.style.height = "inherit"

      const body = { sender: username, text: encrypted, ...(isBurn ? { burnAfter: 15 } : {}) }

      switch (type) {
        case "room": await client.messages.post(body, { query: { roomId: id } }); break
        case "channel": await client["channel-messages"].post(body, { query: { channelId: id } }); break
        case "group": await client["group-messages"].post(body, { query: { groupId: id } }); break
      }
    },
    onError: (error, variables) => {
      onOptimisticRollback?.(variables.optimisticId)
      if (!inputRef.current?.value) {
        setInput(variables.text)
      }
      toast(error instanceof Error ? error.message : "Failed to send message", "error")
    },
  })

  const sendMessage = useCallback(
    ({ text }: { text: string }) => {
      sendMessageMutation.mutate({ text, optimisticId: createOptimisticId() })
    },
    [sendMessageMutation],
  )

  const sendFile = useCallback(async (file: File) => {
    if (!encryptionKey) {
      toast("Encryption key missing — reload the page", "error")
      return
    }
    if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
      toast(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max ${(MAX_ATTACHMENT_FILE_SIZE / 1024 / 1024).toFixed(0)}MB)`,
        "error",
      )
      return
    }
    const isVoice = file.type.startsWith("audio/")
    toast(isVoice ? "Sending voice message…" : `Sending ${file.name}…`, "info")
    const optimisticId = createOptimisticId()
    try {
      const encrypted = await encryptFile(file, encryptionKey)
      const prefix = isVoice ? "VOICE" : "FILE"
      const wrappedContent = `${prefix}:::${encrypted}`
      const encryptedMsg = await encryptMessage(wrappedContent, encryptionKey)
      if (encryptedMsg.length > MAX_TRANSPORT_MESSAGE_LENGTH) {
        throw new Error("File is too large after encryption. Try a smaller image or shorter voice clip.")
      }

      onOptimisticMessage?.({
        id: optimisticId,
        sender: username,
        text: encryptedMsg,
        timestamp: Date.now(),
        roomId: id,
        token: "optimistic",
      })

      const body = { sender: username, text: encryptedMsg }

      switch (type) {
        case "room": await client.messages.post(body, { query: { roomId: id } }); break
        case "channel": await client["channel-messages"].post(body, { query: { channelId: id } }); break
        case "group": await client["group-messages"].post(body, { query: { groupId: id } }); break
      }
      toast(isVoice ? "Voice sent" : "File sent", "success")
    } catch (e) {
      onOptimisticRollback?.(optimisticId)
      const msg = e instanceof Error ? e.message : "Failed to send file"
      toast(msg, "error")
    }
  }, [encryptionKey, username, type, id, toast, onOptimisticMessage, onOptimisticRollback])

  return { input, setInput, inputRef, replyTo, setReplyTo, sendMessage, isPending: sendMessageMutation.isPending, sendFile }
}
