"use client"

import { EncryptedMessage } from "@/components/encrypted-message"
import { useActiveChats } from "@/hooks/use-active-chats"
import { useChatEncryption } from "@/hooks/use-chat-encryption"
import { useChatMessages } from "@/hooks/use-chat-messages"
import { useMessageInput } from "@/hooks/use-message-input"
import { useSound } from "@/hooks/use-sound"
import { client } from "@/lib/client"
import { ThemeSelector } from "@/components/theme-selector"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ShareModal } from "@/components/share-modal"
import { ScrollToBottom } from "@/components/scroll-to-bottom"
import { EmptyState } from "@/components/empty-state"
import { LoadingScreen } from "@/components/loading-screen"
import { EmojiPicker } from "@/components/emoji-picker"
import { FileAttach } from "@/components/file-attach"
import { VoiceRecorder } from "@/components/voice-recorder"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"
import { MessageReactions, REACTION_EMOJIS } from "@/components/message-reactions"
import { DecoyScreen, DECOY_OPTIONS } from "@/components/decoy-screen"
import { MessageSearch } from "@/components/message-search"
import { PinnedMessages } from "@/components/pinned-messages"
import { UserSettings } from "@/components/user-settings"
import { useStealth } from "@/hooks/use-stealth"
import { useMutation, useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const Page = () => {
  const params = useParams()
  const roomId = params.roomId as string
  const router = useRouter()
  const { enabled: soundEnabled, toggle: toggleSound } = useSound()

  const { addChat } = useActiveChats()
  const { isReady, encryptionKey, keyHash } = useChatEncryption()

  const {
    messages,
    reactions,
    pinnedMessages,
    decryptedTexts,
    typingUsers,
    copiedMessageId,
    messagesEndRef,
    scrollContainerRef,
    showScrollBtn,
    newMsgCount,
    copyMessage,
    deleteMessage,
    handleReact,
    scrollToBottom,
    onDecrypted,
    sendTyping,
    handleTyping,
    pinMessage,
    refetch,
  } = useChatMessages({ type: "room", id: roomId })
  const {
    input,
    setInput,
    inputRef,
    replyTo,
    setReplyTo,
    sendMessage,
    isPending,
    sendFile,
  } = useMessageInput({ type: "room", id: roomId, encryptionKey })

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isPanicMode, setIsPanicMode] = useState(false)
  const [panicPin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString())
  const [panicInput, setPanicInput] = useState("")
  const [panicAttempts, setPanicAttempts] = useState(0)
  const [showPinModal, setShowPinModal] = useState(true)
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [decoyType, setDecoyType] = useState<"google" | "calculator" | "notes">("google")
  const [useDecoy, setUseDecoy] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [highlightedMsg, setHighlightedMsg] = useState<string | null>(null)
  const { isStealthActive, toggleStealth } = useStealth()

  useEffect(() => {
    if (keyHash && roomId) {
      addChat({ type: "room", id: roomId, name: `Room ${roomId.slice(0, 8)}...`, encryptionKey: keyHash })
    }
  }, [keyHash, roomId, addChat])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === "p") || (e.key === "Escape" && !showDestroyConfirm && !showShareModal)) {
        setIsPanicMode((prev) => !prev)
        setPanicInput("")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showDestroyConfirm, showShareModal])

  const handlePanicUnlock = () => {
    if (panicAttempts >= 2) return
    if (panicInput === panicPin) {
      setIsPanicMode(false)
      setPanicInput("")
      setPanicAttempts(0)
    } else {
      const next = panicAttempts + 1
      setPanicAttempts(next)
      setPanicInput("")
      if (next >= 2) {
        if (ttlData?.isOwner) {
          destroyRoom()
          router.push("/?destroyed=true")
        } else {
          router.push("/")
        }
      }
    }
  }

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => (await client.room.ttl.get({ query: { roomId } })).data,
  })

  const canDestroyRoom = Boolean(ttlData?.isOwner)

  useEffect(() => {
    if (ttlData?.ttl === undefined) return
    const frame = requestAnimationFrame(() => setTimeRemaining(ttlData.ttl))
    return () => cancelAnimationFrame(frame)
  }, [ttlData?.ttl])

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return
    if (timeRemaining === 0) { router.push("/?destroyed=true"); return }
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeRemaining, router])

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => { await client.room.delete(null, { query: { roomId } }) },
  })

  if (!isReady) return <LoadingScreen />

  return (
    <>
      <ChatSidebar currentType="room" currentId={roomId} />
      <KeyboardShortcuts />
      <main className={`flex flex-col h-screen max-h-screen overflow-hidden bg-background text-foreground transition-all duration-500 ${isPanicMode ? "filter blur-[40px] grayscale brightness-50 pointer-events-none select-none" : ""}`}>
        <header className="border-b border-border p-3 md:p-4 flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3 md:gap-4 ml-10">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider hidden md:block">Room ID</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary truncate max-w-[80px] md:max-w-none">{roomId.slice(0,10) + "..."}</span>
                <button onClick={() => setShowShareModal(true)} className="text-[10px] bg-secondary hover:bg-secondary/80 px-2 py-0.5 rounded text-secondary-foreground transition-colors flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  <span className="hidden sm:inline">SHARE</span>
                </button>
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider hidden md:block">Self-Destruct</span>
              <span className={`text-sm font-bold flex items-center gap-2 ${timeRemaining !== null && timeRemaining < 60 ? "text-destructive" : "text-foreground"}`}>
                {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : "--:--"}
              </span>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Security</span>
              <span className="text-[10px] font-mono text-green-500 flex items-center gap-1.5 font-bold">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                AES-GCM-256
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3">
            <button onClick={toggleStealth} className={`p-2 rounded-lg transition-all ${isStealthActive ? "bg-green-500/20 text-green-500" : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"}`} title="Stealth Tab (Alt+G)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>{isStealthActive && <line x1="1" y1="1" x2="23" y2="23"/>}<circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button onClick={toggleSound} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground" title={soundEnabled ? "Mute notifications" : "Unmute notifications"}>
              {soundEnabled ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
              )}
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground" title="Settings">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button onClick={() => setIsPanicMode(true)} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground" title="Panic Mode (Alt+P)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <ThemeSelector />
            {canDestroyRoom && (
              <button onClick={() => setShowDestroyConfirm(true)} className="text-[10px] md:text-xs bg-destructive hover:bg-destructive/90 px-2 md:px-3 py-1.5 rounded text-destructive-foreground font-bold transition-all group flex items-center gap-1.5 shadow-lg shadow-destructive/20">
                <span className="hidden md:inline group-hover:animate-pulse">DESTROY</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:hidden"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        </header>

        <PinnedMessages
          messages={pinnedMessages}
          decryptedTexts={decryptedTexts}
          onScrollTo={(id) => { setHighlightedMsg(id); document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => setHighlightedMsg(null), 2000) }}
          onUnpin={(id) => pinMessage({ messageId: id, action: "unpin" })}
        />
        <MessageSearch decryptedTexts={decryptedTexts} onHighlight={setHighlightedMsg} />
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
          {messages?.messages.length === 0 && <EmptyState type="room" />}
          {messages?.messages.map((msg, index) => (
            <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${msg.token ? "items-end" : "items-start"} animate-message-in ${highlightedMsg === msg.id ? "ring-2 ring-primary rounded-2xl" : ""}`} style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}>
              <div className={`max-w-[85%] group ${msg.token ? "items-end" : "items-start"} flex flex-col`}>
                <div className="flex items-baseline gap-2 mb-1 opacity-70">
                  <span className={`text-[10px] font-bold uppercase ${msg.token ? "text-primary" : "text-muted-foreground"}`}>
                    {msg.token ? "YOU" : msg.sender}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{format(msg.timestamp, "HH:mm")}</span>
                  <span className="text-[10px] text-muted-foreground/50 hidden group-hover:inline">{formatDistanceToNow(msg.timestamp, { addSuffix: true })}</span>
                </div>
                <div className="relative">
                  <div className={`p-3 rounded-2xl text-sm leading-relaxed break-all shadow-sm transition-transform hover:scale-[1.01] ${msg.token ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm border border-border"}`}>
                    <EncryptedMessage text={msg.text} encryptionKey={encryptionKey} onBurn={() => { deleteMessage(msg.id); refetch() }} burnAfter={(msg as typeof msg & { burnAfter?: number }).burnAfter} messageTimestamp={msg.timestamp} onDecrypted={(plaintext) => onDecrypted(msg.id, plaintext)} />
                  </div>
                  <div className={`absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.token ? "-left-10" : "-right-10"}`}>
                    <button onClick={() => copyMessage(msg.id)} className={`p-1 rounded hover:bg-muted transition-colors ${copiedMessageId === msg.id ? "text-green-500" : "text-muted-foreground"}`} title="Copy decrypted">
                      {copiedMessageId === msg.id ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      )}
                    </button>
                    <button onClick={() => { setReplyTo({ id: msg.id, sender: msg.token ? "You" : msg.sender, text: decryptedTexts[msg.id] || "" }); inputRef.current?.focus() }} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground" title="Reply">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    </button>
                    <button onClick={() => { const isPinned = pinnedMessages.some((p) => p.id === msg.id); pinMessage({ messageId: msg.id, action: isPinned ? "unpin" : "pin" }) }} className={`p-1 rounded hover:bg-muted transition-colors ${pinnedMessages.some((p) => p.id === msg.id) ? "text-primary" : "text-muted-foreground"}`} title={pinnedMessages.some((p) => p.id === msg.id) ? "Unpin" : "Pin"}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="3"/><path d="m5 10 7-7 7 7"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                    </button>
                  </div>
                </div>
                <MessageReactions reactions={REACTION_EMOJIS.map((r) => ({ emoji: r.emoji, count: reactions[msg.id]?.[r.emoji]?.count || 0, hasReacted: reactions[msg.id]?.[r.emoji]?.hasReacted || false }))} onReact={(emoji) => handleReact(msg.id, emoji)} />
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ScrollToBottom visible={showScrollBtn} unreadCount={newMsgCount} onClick={scrollToBottom} />

        <div className="p-3 md:p-4 border-t border-border bg-background/80 backdrop-blur-md">
          {typingUsers.length > 0 && (
            <div className="text-[10px] text-muted-foreground mb-2 px-4 font-medium flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
            </div>
          )}
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-4 py-2 bg-muted/50 rounded-lg border-l-2 border-primary">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-primary">{replyTo.sender}</span>
                <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2 max-w-4xl mx-auto w-full">
            <div className="flex gap-2 md:gap-3">
              <div className="flex-1 relative flex items-end gap-1 bg-muted/50 border border-input focus-within:border-ring rounded-lg transition-all px-2">
                <div className="flex items-center gap-1 mb-1.5">
                  <FileAttach onFile={(f) => sendFile(f)} />
                  <VoiceRecorder onSend={(f) => sendFile(f)} />
                  <EmojiPicker onSelect={(emoji) => setInput((prev) => prev + emoji)} />
                </div>
                <textarea ref={inputRef} autoFocus rows={1} value={input} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim() && !isPending) { sendMessage({ text: input }); sendTyping(false) } } }} placeholder="Message..." onChange={(e) => { setInput(e.target.value); if (e.target.value) handleTyping(); e.target.style.height = "inherit"; e.target.style.height = `${e.target.scrollHeight}px` }} className="flex-1 bg-transparent focus:outline-none transition-all text-foreground placeholder:text-muted-foreground py-3 text-sm resize-none max-h-48 overflow-y-auto block" />
              </div>
              <button onClick={() => { if (input.trim() && !isPending) { sendMessage({ text: input }); sendTyping(false); inputRef.current?.focus() } }} disabled={!input.trim() || isPending || !encryptionKey} className="bg-primary text-primary-foreground px-5 md:px-6 text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-lg shadow-lg shadow-primary/10 active:scale-95 self-end h-[46px]">
                SEND
              </button>
            </div>
            <div className="flex justify-between items-center px-1">
              <div className="flex gap-3 md:gap-4 text-[10px] text-muted-foreground/60">
                <span>/w whisper</span>
                <span>/b burn</span>
                <span>/code snippet</span>
                <span>/ink invisible</span>
              </div>
              <div className="text-[10px] text-muted-foreground/40 font-mono italic hidden md:block">Ctrl+/ shortcuts</div>
            </div>
          </div>
        </div>
      </main>

      {isPanicMode && useDecoy && (
        <DecoyScreen
          type={decoyType}
          maxAttempts={2}
          attemptsUsed={panicAttempts}
          onUnlock={(pin) => {
            setPanicInput(pin)
            if (pin === panicPin) {
              setIsPanicMode(false)
              setPanicInput("")
              setPanicAttempts(0)
            } else {
              const next = panicAttempts + 1
              setPanicAttempts(next)
              if (next >= 2) {
                if (canDestroyRoom) {
                  destroyRoom()
                  router.push("/?destroyed=true")
                } else {
                  router.push("/")
                }
              }
            }
          }}
        />
      )}

      {isPanicMode && !useDecoy && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-background/95 p-8 rounded-3xl border border-primary/20 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center mx-4">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive animate-pulse border-4 border-destructive/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4"/><path d="m3.34 19 8.66-15 8.66 15H3.34Z"/><path d="m12 14-4-4"/></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tighter uppercase">Security Breach?</h3>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Interface locked. Enter 4-digit PIN to restore access.<br />
                <span className="text-destructive font-black underline mt-1 block">{Math.max(0, 2 - panicAttempts)} ATTEMPTS REMAINING</span>
              </p>
            </div>
            <div className="w-full space-y-4">
              <input autoFocus type="password" maxLength={4} value={panicInput} onChange={(e) => setPanicInput(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && handlePanicUnlock()} placeholder="****" className="w-full bg-muted text-center text-3xl tracking-[1em] font-black py-4 rounded-2xl border-2 border-transparent focus:border-primary/50 outline-none transition-all" />
              <button className="w-full py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-primary/20 active:scale-[0.98]" onClick={handlePanicUnlock}>UNLOCK SESSION</button>
            </div>
            <p className="text-[10px] text-muted-foreground/30 uppercase tracking-[0.2em] font-bold">{canDestroyRoom ? "Wrong code twice = Room Self-Destruct" : "Wrong code twice = Leave Room"}</p>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-xs rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider">Your Panic PIN</h3>
              <p className="text-xs text-muted-foreground mt-1">Memorize this. It unlocks Panic Mode.</p>
            </div>
            <div className="text-4xl font-black tracking-[0.5em] text-primary py-2">{panicPin}</div>
            <p className="text-[10px] text-muted-foreground/60">{canDestroyRoom ? "2 wrong attempts = room destroyed" : "2 wrong attempts = leave room"}</p>
            <div className="w-full space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Panic Screen</label>
              <div className="flex gap-1.5">
                {DECOY_OPTIONS.map((d) => (
                  <button key={d.type} onClick={() => { setDecoyType(d.type); setUseDecoy(true) }} className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold transition-all ${decoyType === d.type && useDecoy ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{d.label}</button>
                ))}
                <button onClick={() => setUseDecoy(false)} className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold transition-all ${!useDecoy ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Blur</button>
              </div>
            </div>
            <button onClick={() => setShowPinModal(false)} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-all">I MEMORIZED IT</button>
          </div>
        </div>
      )}

      {canDestroyRoom && (
        <ConfirmDialog open={showDestroyConfirm} title="Destroy Room?" description="This will permanently delete all messages and the room itself. This action cannot be undone." confirmText="DESTROY" variant="danger" onConfirm={() => { setShowDestroyConfirm(false); destroyRoom() }} onCancel={() => setShowDestroyConfirm(false)} />
      )}
      <ShareModal open={showShareModal} url={typeof window !== "undefined" ? window.location.href : ""} title="Share Room" onClose={() => setShowShareModal(false)} />
      <UserSettings open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}

export default Page
