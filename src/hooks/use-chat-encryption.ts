"use client"

import { client } from "@/lib/client"
import { deriveAccessProof } from "@/lib/access-proof"
import { importKey } from "@/lib/crypto"
import type { ChatType } from "@/hooks/use-active-chats"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type UseChatEncryptionOptions = {
  type: ChatType
  id: string
}

async function requestAccess(type: ChatType, id: string, accessProof: string) {
  switch (type) {
    case "room":
      return await client.room.access.post({ roomId: id, accessProof })
    case "channel":
      return await client.channel.access.post({ channelId: id, accessProof })
    case "group":
      return await client.group.access.post({ groupId: id, accessProof })
  }
}

export function useChatEncryption({ type, id }: UseChatEncryptionOptions) {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null)
  const [keyHash, setKeyHash] = useState("")

  useEffect(() => {
    let cancelled = false

    const hash = window.location.hash.slice(1)
    if (!hash) {
      router.push("/?error=missing-key")
      return
    }

    void (async () => {
      try {
        const [key, accessProof] = await Promise.all([
          importKey(hash),
          deriveAccessProof(hash),
        ])

        const access = await requestAccess(type, id, accessProof)
        if (access.status !== 200) {
          if (access.status === 404) {
            router.push("/?error=room-not-found")
            return
          }
          if (access.status === 409) {
            router.push("/?error=room-full")
            return
          }
          if (access.status === 403) {
            router.push("/?error=invite-required")
            return
          }
          throw new Error("Access denied")
        }

        if (cancelled) return

        setEncryptionKey(key)
        setKeyHash(hash)
        setIsReady(true)
      } catch {
        if (!cancelled) {
          router.push("/?error=invalid-key")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, router, type])

  return { isReady, encryptionKey, keyHash }
}
