"use client"

import { importKey } from "@/lib/crypto"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export function useChatEncryption() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null)
  const [keyHash, setKeyHash] = useState("")

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) {
      router.push("/?error=missing-key")
      return
    }
    importKey(hash)
      .then((key) => {
        setEncryptionKey(key)
        setKeyHash(hash)
        setIsReady(true)
      })
      .catch(() => router.push("/?error=invalid-key"))
  }, [router])

  return { isReady, encryptionKey, keyHash }
}
