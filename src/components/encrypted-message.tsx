import { decryptMessage } from "@/lib/crypto"
import { useEffect, useState } from "react"

export const EncryptedMessage = ({ text, encryptionKey }: { text: string; encryptionKey: CryptoKey | null }) => {
  const [decrypted, setDecrypted] = useState<string>("🔒 Encrypted...")

  useEffect(() => {
    if (!encryptionKey) return
    decryptMessage(text, encryptionKey).then(setDecrypted)
  }, [text, encryptionKey])

  return <>{decrypted}</>
}
