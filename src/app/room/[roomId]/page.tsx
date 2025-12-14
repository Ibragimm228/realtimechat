"use client"

import { decryptMessage, encryptMessage, importKey } from "@/lib/crypto"
import { EncryptedMessage } from "@/components/encrypted-message"
import { useUsername } from "@/hooks/use-username"
import { client } from "@/lib/client"
import { ThemeSelector } from "@/components/theme-selector"
import { useRealtime } from "@/lib/realtime-client"
import { useMutation, useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { useParams, useRouter } from "next/navigation"
import { use, useEffect, useRef, useState } from "react"

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
  const typingTimeoutRef = useRef<NodeJS.Timeout>(null)

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

  useEffect(() => {
    if (ttlData?.ttl !== undefined) setTimeRemaining(ttlData.ttl)
  }, [ttlData])

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

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!encryptionKey) return
      
      let messageContent = text
      
      if (text.startsWith("/w ") || text.startsWith("/whisper ")) {
        const cleanText = text.replace(/^\/(w|whisper)\s+/, "")
        messageContent = `WHISPER:::${cleanText}`
      }

      const encrypted = await encryptMessage(messageContent, encryptionKey)
      await client.messages.post({ sender: username, text: encrypted }, { query: { roomId } })

      setInput("")
    },
  })

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event === "chat.message") {
        refetch()
      }

      if (event === "chat.destroy") {
        router.push("/?destroyed=true")
      }
    },
  })

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } })
    },
  })

  const copyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopyStatus("COPIED!")
    setTimeout(() => setCopyStatus("COPY LINK"), 2000)
  }

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
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
        </div>

        <div className="flex items-center gap-4">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {messages?.messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm font-mono opacity-50">
              No messages yet, start the conversation.
            </p>
          </div>
        )}

        {messages?.messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === username ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] group ${msg.sender === username ? "items-end" : "items-start"} flex flex-col`}>
              <div className="flex items-baseline gap-2 mb-1 opacity-70">
                <span
                  className={`text-[10px] font-bold uppercase ${
                    msg.sender === username ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {msg.sender === username ? "YOU" : msg.sender}
                </span>

                <span className="text-[10px] text-muted-foreground">
                  {format(msg.timestamp, "HH:mm")}
                </span>
              </div>

              <div className={`
                p-3 rounded-2xl text-sm leading-relaxed break-all shadow-sm
                ${msg.sender === username 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-muted text-foreground rounded-tl-sm border border-border"}
              `}>
                <EncryptedMessage text={msg.text} encryptionKey={encryptionKey} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-background/80 backdrop-blur-md">
        {typingUsers.length > 0 && (
          <div className="text-[10px] text-muted-foreground animate-pulse mb-2 px-4 font-medium">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        )}
        <div className="flex gap-4 max-w-4xl mx-auto w-full">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              {">"}
            </span>
            <input
              autoFocus
              type="text"
              value={input}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.repeat && input.trim() && !isPending) {
                  sendMessage({ text: input })
                  inputRef.current?.focus()
                }
              }}
              placeholder="Type message..."
              onChange={(e) => {
                setInput(e.target.value)
              }}
              className="w-full bg-muted/50 border border-input focus:border-ring focus:outline-none transition-all text-foreground placeholder:text-muted-foreground py-3 pl-8 pr-4 text-sm rounded-lg"
            />
          </div>

          <button
            onClick={() => {
              sendMessage({ text: input })
              inputRef.current?.focus()
            }}
            disabled={!input.trim() || isPending || !encryptionKey}
            className="bg-primary text-primary-foreground px-6 text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-lg shadow-lg shadow-primary/10"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  )
}

export default Page
