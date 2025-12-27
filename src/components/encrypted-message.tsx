import { decryptMessage } from "@/lib/crypto"
import { useEffect, useState } from "react"

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+"

export const EncryptedMessage = ({ 
  text, 
  encryptionKey,
  onBurn,
}: { 
  text: string; 
  encryptionKey: CryptoKey | null;
  onBurn?: () => void;
}) => {
  const [isWhisper, setIsWhisper] = useState(false)
  const [isBurn, setIsBurn] = useState(false)
  const [burnTime, setBurnTime] = useState<number | null>(null)
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
        
        if (isBurn && burnTime === null) {
          setBurnTime(10)
        }
      }
      
      iterations += 1 / 2
    }, 30)

    return () => clearInterval(interval)
  }, [content, isRevealed, isBurn, burnTime])

  useEffect(() => {
    if (burnTime === null || burnTime <= 0) {
      if (burnTime === 0 && onBurn) onBurn()
      return
    }

    const timer = setTimeout(() => {
      setBurnTime(prev => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [burnTime, onBurn])

  useEffect(() => {
    if (!encryptionKey) return
    decryptMessage(text, encryptionKey).then((raw) => {
      if (raw.startsWith("WHISPER:::")) {
        setIsWhisper(true)
        setContent(raw.replace("WHISPER:::", ""))
        setIsRevealed(true)
      } else if (raw.startsWith("BURN:::")) {
        setIsBurn(true)
        setContent(raw.replace("BURN:::", ""))
      } else if (raw.startsWith("CODE:::")) {
        setContent(raw.replace("CODE:::", ""))
      } else {
        setIsWhisper(false)
        setIsBurn(false)
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

  const isCode = text.includes("CODE:::") || content.includes("\n") || content.length > 100 && (content.includes("{") || content.includes("}"))

  return (
    <div className="relative">
      {isBurn && isRevealed && burnTime !== null && (
        <div className="absolute -top-6 -right-2 flex items-center gap-1.5 px-2 py-0.5 bg-destructive/10 rounded-full border border-destructive/20 animate-pulse">
          <span className="text-[9px] font-black text-destructive uppercase tracking-tighter">Self-Destruct in</span>
          <span className="text-[10px] font-mono font-bold text-destructive">{burnTime}s</span>
        </div>
      )}
      {isCode && isRevealed ? (
        <pre className="font-mono text-[13px] bg-black/20 p-3 rounded-lg overflow-x-auto border border-white/5 my-1 leading-relaxed">
          <code>{content}</code>
        </pre>
      ) : (
        <span className="whitespace-pre-wrap">{isRevealed ? content : displayContent || "..."}</span>
      )}
    </div>
  )
}
