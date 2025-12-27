"use client"

import { encryptMessage, importKey } from "@/lib/crypto"
import { EncryptedMessage } from "@/components/encrypted-message"
import { useUsername } from "@/hooks/use-username"
import { client } from "@/lib/client"
import { ThemeSelector } from "@/components/theme-selector"
import { useRealtime } from "@/lib/realtime-client"
import { useMutation, useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useCallback } from "react"

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const Page = () => {
  const params = useParams()
  const roomId = params.roomId as string

  const router = useRouter()

  const { username } = useUsername()
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const [copyStatus, setCopyStatus] = useState("COPY LINK")
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [isPanicMode, setIsPanicMode] = useState(false)
  const [panicPin, setPanicPin] = useState("")
  const [panicInput, setPanicInput] = useState("")
  const [panicAttempts, setPanicAttempts] = useState(0)
  const typingTimeoutRef = useRef<NodeJS.Timeout>(null)
  
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(0)

  useEffect(() => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString()
    setPanicPin(pin)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === "p") || e.key === "Escape") {
        setIsPanicMode((prev) => !prev)
        setPanicInput("")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handlePanicUnlock = () => {
    if (panicInput === panicPin) {
      setIsPanicMode(false)
      setPanicInput("")
      setPanicAttempts(0)
    } else {
      const newAttempts = panicAttempts + 1
      setPanicAttempts(newAttempts)
      setPanicInput("")
      
      if (newAttempts >= 2) {
        destroyRoom()
      }
    }
  }

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      importKey(hash).then(setEncryptionKey).catch(console.error)
    }
  }, [])

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId } })
      return res.data
    },
  })

  /* eslint-disable react-hooks/set-state-in-effect -- syncing derived state from query */
  useEffect(() => {
    if (ttlData?.ttl !== undefined) setTimeRemaining(ttlData.ttl)
  }, [ttlData])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return

    if (timeRemaining === 0) {
      router.push("/?destroyed=true")
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining, router])

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } })
      return res.data
    },
  })

  const { mutate: deleteMessage } = useMutation({
    mutationFn: async (messageId: string) => {
      await client.messages.delete(null, { query: { roomId, messageId } })
    },
  })

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!encryptionKey) return
      
      let messageContent = text
      
      if (text.startsWith("/w ") || text.startsWith("/whisper ")) {
        const cleanText = text.replace(/^\/(w|whisper)\s+/, "")
        messageContent = `WHISPER:::${cleanText}`
      } else if (text.startsWith("/b ") || text.startsWith("/burn ")) {
        const cleanText = text.replace(/^\/(b|burn)\s+/, "")
        messageContent = `BURN:::${cleanText}`
      } else if (text.startsWith("/code ")) {
        const cleanText = text.replace(/^\/code\s+/, "")
        messageContent = `CODE:::${cleanText}`
      }

      const encrypted = await encryptMessage(messageContent, encryptionKey)
      await client.messages.post({ sender: username, text: encrypted }, { query: { roomId } })

      setInput("")
      if (inputRef.current) {
        inputRef.current.style.height = "inherit"
      }
    },
  })

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy", "chat.typing", "chat.join", "chat.leave", "chat.delete"],
    onData: ({ event, data }) => {
      if (event === "chat.message" || event === "chat.delete") {
        refetch()
      }

      if (event === "chat.destroy") {
        router.push("/?destroyed=true")
      }

      if (event === "chat.typing") {
        const typingData = data as { username: string; isTyping: boolean }
        if (typingData.username !== username) {
          setTypingUsers((prev) => {
            if (typingData.isTyping) {
              return prev.includes(typingData.username) ? prev : [...prev, typingData.username]
            }
            return prev.filter((u) => u !== typingData.username)
          })
        }
      }
    },
  })

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } })
    },
  })

  const { mutate: sendTyping } = useMutation({
    mutationFn: async (isTyping: boolean) => {
      await client.messages.typing.post({ username, isTyping }, { query: { roomId } })
    },
  })

  const handleTyping = useCallback(() => {
    sendTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000)
  }, [sendTyping])

  useEffect(() => {
    if (messages?.messages.length && messages.messages.length > lastMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    lastMessageCountRef.current = messages?.messages.length || 0
  }, [messages?.messages.length])

  const copyMessage = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(id)
      setTimeout(() => setCopiedMessageId(null), 1500)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const copyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopyStatus("COPIED!")
    setTimeout(() => setCopyStatus("COPY LINK"), 2000)
  }

  return (
    <>
      <main className={`flex flex-col h-screen max-h-screen overflow-hidden bg-background text-foreground transition-all duration-500 ${isPanicMode ? "filter blur-[40px] grayscale brightness-50 pointer-events-none select-none" : ""}`}>
        <header className="border-b border-border p-4 flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Room ID</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary truncate">{roomId.slice(0,10) + "..."}</span>
                <button
                  onClick={copyLink}
                  className="text-[10px] bg-secondary hover:bg-secondary/80 px-2 py-0.5 rounded text-secondary-foreground transition-colors"
                >
                  {copyStatus}
                </button>
              </div>
            </div>

            <div className="h-8 w-px bg-border" />

            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Self-Destruct</span>
              <span
                className={`text-sm font-bold flex items-center gap-2 ${
                  timeRemaining !== null && timeRemaining < 60
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : "--:--"}
              </span>
            </div>

            <div className="h-8 w-px bg-border hidden md:block" />

          <div className="hidden md:flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Security Protocol</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-green-500 flex items-center gap-1.5 font-bold">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                AES-GCM-256
              </span>
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded font-mono font-bold" title="Panic PIN">
                PIN: {panicPin}
              </span>
            </div>
          </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPanicMode(true)}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground"
              title="Panic Mode (Alt+P / Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <ThemeSelector />
            <button
              onClick={() => destroyRoom()}
              className="text-xs bg-destructive hover:bg-destructive/90 px-3 py-1.5 rounded text-destructive-foreground font-bold transition-all group flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-destructive/20"
            >
              <span className="group-hover:animate-pulse">💣</span>
              DESTROY
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
        {messages?.messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm font-mono opacity-50">
              No messages yet, start the conversation.
            </p>
          </div>
        )}

        {messages?.messages.map((msg, index) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.token ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
          >
            <div className={`max-w-[85%] group ${msg.token ? "items-end" : "items-start"} flex flex-col`}>
              <div className="flex items-baseline gap-2 mb-1 opacity-70">
                <span
                  className={`text-[10px] font-bold uppercase ${
                    msg.token ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {msg.token ? "YOU" : msg.sender}
                </span>

                <span className="text-[10px] text-muted-foreground">
                  {format(msg.timestamp, "HH:mm")}
                </span>
                
                <span className="text-[10px] text-muted-foreground/50 hidden group-hover:inline">
                  {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                </span>
              </div>

              <div className="relative">
                <div className={`
                  p-3 rounded-2xl text-sm leading-relaxed break-all shadow-sm transition-transform hover:scale-[1.02]
                  ${msg.token 
                    ? "bg-primary text-primary-foreground rounded-tr-sm" 
                    : "bg-muted text-foreground rounded-tl-sm border border-border"}
                `}>
                  <EncryptedMessage 
                    text={msg.text} 
                    encryptionKey={encryptionKey} 
                    onBurn={() => deleteMessage(msg.id)}
                  />
                </div>
                
                <button
                  onClick={() => copyMessage(msg.text, msg.id)}
                  className={`absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted ${
                    copiedMessageId === msg.id ? "text-green-500" : "text-muted-foreground"
                  }`}
                  title="Copy encrypted"
                >
                  {copiedMessageId === msg.id ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border bg-background/80 backdrop-blur-md">
        {typingUsers.length > 0 && (
          <div className="text-[10px] text-muted-foreground mb-2 px-4 font-medium flex items-center gap-2">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </span>
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        )}
        <div className="flex flex-col gap-2 max-w-4xl mx-auto w-full">
          <div className="flex gap-3">
            <div className="flex-1 relative group">
              <textarea
                ref={inputRef as any}
                autoFocus
                rows={1}
                value={input}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (input.trim() && !isPending) {
                      sendMessage({ text: input })
                      sendTyping(false)
                    }
                  }
                }}
                placeholder="Type message... (/w whisper, /b burn, /code snippets)"
                onChange={(e) => {
                  setInput(e.target.value)
                  if (e.target.value) handleTyping()
                  
                  e.target.style.height = "inherit"
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                className="w-full bg-muted/50 border border-input focus:border-ring focus:outline-none transition-all text-foreground placeholder:text-muted-foreground py-3 px-4 text-sm rounded-lg resize-none max-h-48 overflow-y-auto block"
              />
            </div>

            <button
              onClick={() => {
                if (input.trim() && !isPending) {
                  sendMessage({ text: input })
                  sendTyping(false)
                  inputRef.current?.focus()
                }
              }}
              disabled={!input.trim() || isPending || !encryptionKey}
              className="bg-primary text-primary-foreground px-6 text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-lg shadow-lg shadow-primary/10 active:scale-95 self-end h-[46px]"
            >
              SEND
            </button>
          </div>
          
          <div className="flex justify-between items-center px-1">
            <div className="flex gap-4 text-[10px] text-muted-foreground/60">
              <span>💡 /w whisper</span>
              <span>🔥 /b burn</span>
              <span>⌨️ /code snippet</span>
            </div>
            <div className="text-[10px] text-muted-foreground/40 font-mono italic">
              Alt+P to Panic
            </div>
          </div>
        </div>
      </div>
    </main>
    
    {isPanicMode && (
      <div 
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-300"
      >
        <div className="bg-background/95 p-8 rounded-3xl border border-primary/20 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center mx-4">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive animate-pulse border-4 border-destructive/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 14 4-4"/><path d="m3.34 19 8.66-15 8.66 15H3.34Z"/><path d="m12 14-4-4"/>
            </svg>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tighter uppercase">Security Breach?</h3>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              Interface locked for your safety. Enter the 4-digit PIN to restore access.
              <br />
              <span className="text-destructive font-black underline mt-1 block">
                {2 - panicAttempts} ATTEMPTS REMAINING
              </span>
            </p>
          </div>

          <div className="w-full space-y-4">
            <input 
              autoFocus
              type="password"
              maxLength={4}
              value={panicInput}
              onChange={(e) => setPanicInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handlePanicUnlock()}
              placeholder="••••"
              className="w-full bg-muted text-center text-3xl tracking-[1em] font-black py-4 rounded-2xl border-2 border-transparent focus:border-primary/50 outline-none transition-all"
            />
            
            <button 
              className="w-full py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-primary/20 active:scale-[0.98]"
              onClick={handlePanicUnlock}
            >
              UNLOCK SESSION
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground/30 uppercase tracking-[0.2em] font-bold">
            Wrong code twice = Room Self-Destruct
          </p>
        </div>
      </div>
    )}
  </>
)
}

export default Page
