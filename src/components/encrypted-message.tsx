import { decryptMessage } from "@/lib/crypto"
import { useEffect, useState } from "react"

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+"

export const EncryptedMessage = ({ text, encryptionKey }: { text: string; encryptionKey: CryptoKey | null }) => {
  const [isWhisper, setIsWhisper] = useState(false)
  const [content, setContent] = useState("")
  const [displayContent, setDisplayContent] = useState("")
  const [isRevealed, setIsRevealed] = useState(false)
  
  useEffect(() => {
    if (!content || isRevealed) return

    let iterations = 0
    
    const interval = setInterval(() => {
      setDisplayContent(
        content
          .split("")
          .map((_, index) => {
            if (index < iterations) {
              return content[index]
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)]
          })
          .join("")
      )

      if (iterations >= content.length) {
        clearInterval(interval)
        setIsRevealed(true)
      }
      
      iterations += 1 / 2
    }, 30)

    return () => clearInterval(interval)
  }, [content, isRevealed])

  useEffect(() => {
    if (!encryptionKey) return
    decryptMessage(text, encryptionKey).then((raw) => {
      if (raw.startsWith("WHISPER:::")) {
        setIsWhisper(true)
        setContent(raw.replace("WHISPER:::", ""))
        setIsRevealed(true)
      } else {
        setIsWhisper(false)
        setContent(raw)
      }
    })
  }, [text, encryptionKey])

  if (isWhisper) {
    return (
      <span 
        onClick={() => setIsWhisper(false)}
        className="relative cursor-pointer inline-block bg-foreground/10 rounded px-1 -mx-1"
        title="Click to reveal (Visible to everyone)"
      >
        <span className="filter blur-md hover:blur-sm transition-all duration-300 select-none block min-w-[50px]">
          {content} 
        </span>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black uppercase text-muted-foreground/70 pointer-events-none tracking-widest whitespace-nowrap">
          Whisper
        </span>
      </span>
    )
  }

  return <>{isRevealed ? content : displayContent || "..."}</>
}
