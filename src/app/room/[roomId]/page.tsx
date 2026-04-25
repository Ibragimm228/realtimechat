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
import { MessageReactions, ReactionPicker, REACTION_EMOJIS } from "@/components/message-reactions"
import { DecoyScreen, DECOY_OPTIONS } from "@/components/decoy-screen"
import { MessageSearch } from "@/components/message-search"
import { PinnedMessages } from "@/components/pinned-messages"
import { UserSettings } from "@/components/user-settings"
import Link from "next/link"
import { useMutation, useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
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
  const { isReady, encryptionKey, keyHash } = useChatEncryption({ type: "room", id: roomId })

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
    addOptimisticMessage,
    removeOptimisticMessage,
  } = useChatMessages({ type: "room", id: roomId, enabled: isReady })

  const {
    input,
    setInput,
    inputRef,
    replyTo,
    setReplyTo,
    sendMessage,
    isPending,
    sendFile,
  } = useMessageInput({
    type: "room",
    id: roomId,
    encryptionKey,
    onOptimisticMessage: addOptimisticMessage,
    onOptimisticRollback: removeOptimisticMessage,
  })

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
  const [sideOpen, setSideOpen] = useState(true)

  useEffect(() => {
    if (keyHash && roomId) {
      addChat({ type: "room", id: roomId, name: `Room ${roomId.slice(0, 8)}…`, encryptionKey: keyHash })
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

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    enabled: isReady,
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
        if (canDestroyRoom) {
          destroyRoom()
          router.push("/?destroyed=true")
        } else {
          router.push("/")
        }
      }
    }
  }

  if (!isReady) return <LoadingScreen />

  return (
    <>
      <ChatSidebar currentType="room" currentId={roomId} />
      <KeyboardShortcuts />

      <div className={`frame ${isPanicMode ? "filter" : ""}`} style={isPanicMode ? { filter: "blur(40px) grayscale(1) brightness(0.5)", pointerEvents: "none", userSelect: "none" } : undefined}>
        <header className="rail">
          <div className="brand">
            <Link href="/" className="brand-mark" title="Home">← ANON</Link>
            <a
              href="https://anon-chat.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="brand-word"
              style={{ textDecoration: "none" }}
            >
              anon-chat<em>.</em>com
            </a>
            <div className="brand-tag">
              <span className="pill-dot pulse" style={{ marginRight: 8 }} />
              ID <b style={{ color: "var(--ink)", marginLeft: 6 }}>{roomId.slice(0, 10)}…</b>
            </div>
          </div>

          <div className="rail-center">
            <span>Self-destruct</span>
            <b
              style={{
                color: timeRemaining !== null && timeRemaining < 60 ? "var(--danger)" : "var(--ink)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
              }}
            >
              {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : "--:--"}
            </b>
          </div>

          <div className="rail-right">
            <button className="icon-btn" onClick={() => setShowShareModal(true)} title="Share">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
            </button>
            <button className="icon-btn" onClick={toggleSound} title={soundEnabled ? "Mute" : "Unmute"}>
              {soundEnabled ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
              )}
            </button>
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
            <button className="icon-btn" onClick={() => setIsPanicMode(true)} title="Panic (Alt+P)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
            <ThemeSelector />
            {canDestroyRoom && (
              <button className="chip danger" onClick={() => setShowDestroyConfirm(true)} title="Destroy room">
                Destroy
              </button>
            )}
          </div>
        </header>

        <div className={`chat-wrap ${sideOpen ? "" : "side-hidden"}`}>
          <aside className="side-col">
            <div className="side-section">
              <h4>Session</h4>
              <div className="identity" style={{ padding: 14 }}>
                <div className="glyph" style={{ width: 40, height: 40, fontSize: 16 }}>◆</div>
                <div className="idmeta">
                  <div className="idlbl">Room</div>
                  <div className="idnum" style={{ fontSize: 14 }}>#{roomId.slice(0, 8)}</div>
                </div>
              </div>
            </div>

            <div className="side-section">
              <h4>Security <span className="mono text-muted">E2EE</span></h4>
              <div className="legend" style={{ flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                <span><span className="dash" />AES-GCM-256</span>
                <span><span className="dash" />Keys stay in browser</span>
                <span><span className="dash" />Messages vanish on destroy</span>
              </div>
            </div>

            <div className="side-section">
              <h4>Commands</h4>
              <div className="legend" style={{ flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <span><span className="dash" /><b style={{ color: "var(--ink)", fontWeight: 500 }}>/w</b> whisper</span>
                <span><span className="dash" /><b style={{ color: "var(--ink)", fontWeight: 500 }}>/b</b> burn</span>
                <span><span className="dash" /><b style={{ color: "var(--ink)", fontWeight: 500 }}>/code</b> snippet</span>
                <span><span className="dash" /><b style={{ color: "var(--ink)", fontWeight: 500 }}>/ink</b> invisible</span>
              </div>
            </div>

            <div className="side-section">
              <h4>Shortcuts</h4>
              <div className="legend" style={{ flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <span><span className="dash" />Alt+P — Panic</span>
                <span><span className="dash" />Alt+S — Chats</span>
                <span><span className="dash" />Ctrl+/ — Keys</span>
              </div>
            </div>

            <div className="side-section mt-auto">
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--muted)",
                  letterSpacing: "0.08em",
                  lineHeight: 1.5,
                }}
              >
                This session is ephemeral. Close the tab and everything is gone.
              </p>
            </div>
          </aside>

          <section className="chat-center">
            <div className="chat-head">
              <div className="left">
                <button
                  type="button"
                  className="side-toggle"
                  onClick={() => setSideOpen((v) => !v)}
                  title={sideOpen ? "Hide panel" : "Show panel"}
                  aria-label={sideOpen ? "Hide panel" : "Show panel"}
                >
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    {sideOpen ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
                  </svg>
                </button>
                {typingUsers.length > 0 && (
                  <div className="p-status" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
                    <span className="pill-dot pulse" style={{ marginRight: 6 }} />
                    {typingUsers.join(", ")} is typing…
                  </div>
                )}
              </div>

              <div className="center" />

              <div className="right">
                <button className="icon-btn" onClick={() => setShowShareModal(true)} title="Share">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                </button>
                {canDestroyRoom && (
                  <button className="icon-btn danger" onClick={() => setShowDestroyConfirm(true)} title="Destroy">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                  </button>
                )}
              </div>
            </div>

            <PinnedMessages
              messages={pinnedMessages}
              decryptedTexts={decryptedTexts}
              onScrollTo={(id) => {
                setHighlightedMsg(id)
                document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                setTimeout(() => setHighlightedMsg(null), 2000)
              }}
              onUnpin={(id) => pinMessage({ messageId: id, action: "unpin" })}
            />
            <MessageSearch decryptedTexts={decryptedTexts} onHighlight={setHighlightedMsg} />

            <div
              ref={scrollContainerRef}
              className="transcript"
              data-density="cozy"
              data-bubble="stamped"
              style={{ position: "relative" }}
            >
              {messages?.messages.length === 0 && <EmptyState type="room" />}

              {messages?.messages.map((msg) => {
                const mine = !!msg.token
                const isPinned = pinnedMessages.some((p) => p.id === msg.id)
                const copied = copiedMessageId === msg.id
                const reactionItems = REACTION_EMOJIS.map((r) => ({
                  emoji: r.emoji,
                  count: reactions[msg.id]?.[r.emoji]?.count || 0,
                  hasReacted: reactions[msg.id]?.[r.emoji]?.hasReacted || false,
                }))
                const hasActiveReactions = reactionItems.some((reaction) => reaction.count > 0)
                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`msg ${mine ? "mine" : ""} ${highlightedMsg === msg.id ? "highlighted" : ""}`}
                  >
                    <div className="msg-meta">
                      <div className="msg-meta-inner">
                        <span className={mine ? "mine-tag" : "id"}>
                          {mine ? "YOU" : `#${msg.sender}`}
                        </span>
                        <span className="time">{format(msg.timestamp, "HH:mm:ss")}</span>
                      </div>
                    </div>
                    <div className="msg-body">
                      <div className="bubble">
                        <EncryptedMessage
                          text={msg.text}
                          encryptionKey={encryptionKey}
                          onBurn={() => { deleteMessage(msg.id); refetch() }}
                          burnAfter={(msg as typeof msg & { burnAfter?: number }).burnAfter}
                          messageTimestamp={msg.timestamp}
                          onDecrypted={(plaintext) => onDecrypted(msg.id, plaintext)}
                        />
                      </div>
                      <div className={`msg-reaction-row ${hasActiveReactions ? "has-reactions" : ""}`}>
                        <MessageReactions
                          reactions={reactionItems}
                          onReact={(emoji) => handleReact(msg.id, emoji)}
                          align={mine ? "end" : "start"}
                        />
                        <ReactionPicker
                          onReact={(emoji) => handleReact(msg.id, emoji)}
                          align={mine ? "end" : "start"}
                          variant="pill"
                        />
                      </div>

                      <div className="msg-actions">
                        <button onClick={() => copyMessage(msg.id)} title="Copy" className={copied ? "active" : ""}>
                          {copied ? "✓" : "⎘"}
                        </button>
                        <button
                          onClick={() => {
                            setReplyTo({ id: msg.id, sender: mine ? "You" : msg.sender, text: decryptedTexts[msg.id] || "" })
                            inputRef.current?.focus()
                          }}
                          title="Reply"
                        >
                          ↩
                        </button>
                        <button
                          onClick={() => pinMessage({ messageId: msg.id, action: isPinned ? "unpin" : "pin" })}
                          className={isPinned ? "active" : ""}
                          title={isPinned ? "Unpin" : "Pin"}
                        >
                          ⌖
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {typingUsers.length > 0 && (
                <div className="msg">
                  <div className="msg-meta">
                    <div className="msg-meta-inner">
                      <span className="id">{typingUsers[0]}</span>
                      <span className="time">typing…</span>
                    </div>
                  </div>
                  <div className="msg-body">
                    <div className="typing">
                      <div className="dots"><span /><span /><span /></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <ScrollToBottom visible={showScrollBtn} unreadCount={newMsgCount} onClick={scrollToBottom} />

            <div className="composer">
              <div className="composer-meta">
                <span>— <span className="ident">{canDestroyRoom ? "OWNER" : "MEMBER"}</span> · press ↵ to send · shift+↵ newline</span>
                <span>{input.length}/2000</span>
              </div>

              {replyTo && (
                <div className="composer-reply">
                  <div className="rp-meta">
                    <div className="rp-sender">{replyTo.sender}</div>
                    <div className="rp-text">{replyTo.text}</div>
                  </div>
                  <button className="rp-close" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button>
                </div>
              )}

              <div className="composer-inner">
                <div className="composer-tools">
                  <FileAttach onFile={(f) => sendFile(f)} />
                  <VoiceRecorder onSend={(f) => sendFile(f)} />
                  <EmojiPicker onSelect={(emoji) => setInput((prev) => prev + emoji)} />
                </div>
                <textarea
                  ref={inputRef}
                  autoFocus
                  rows={1}
                  value={input}
                  placeholder="Say something private…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      if (input.trim() && !isPending) { sendMessage({ text: input }); sendTyping(false) }
                    }
                  }}
                  onChange={(e) => {
                    setInput(e.target.value)
                    if (e.target.value) handleTyping()
                    e.target.style.height = "inherit"
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
                  }}
                />
                <button
                  className="send-btn"
                  onClick={() => { if (input.trim() && !isPending) { sendMessage({ text: input }); sendTyping(false); inputRef.current?.focus() } }}
                  disabled={!input.trim() || isPending || !encryptionKey}
                >
                  Send <span style={{ fontSize: 14 }}>↵</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

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
                if (canDestroyRoom) { destroyRoom(); router.push("/?destroyed=true") }
                else { router.push("/") }
              }
            }
          }}
        />
      )}

      {isPanicMode && !useDecoy && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h3>Security breach?</h3>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Interface locked. Enter the 4-digit PIN to restore access.
                <br />
                <b style={{ color: "var(--danger)" }}>{Math.max(0, 2 - panicAttempts)} attempts remaining</b>
              </p>
              <input
                autoFocus
                type="password"
                maxLength={4}
                value={panicInput}
                onChange={(e) => setPanicInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handlePanicUnlock()}
                placeholder="••••"
                style={{
                  width: "100%",
                  padding: "18px 20px",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 28,
                  textAlign: "center",
                  letterSpacing: "0.6em",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
              <button className="btn-primary" onClick={handlePanicUnlock}>Unlock session</button>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--muted-2)",
                  textAlign: "center",
                }}
              >
                {canDestroyRoom ? "Wrong code twice = room self-destruct" : "Wrong code twice = leave room"}
              </p>
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h3>Your panic PIN</h3>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ fontSize: 12 }}>
                Memorize this — it unlocks panic mode.
              </p>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 40,
                  fontWeight: 600,
                  letterSpacing: "0.3em",
                  color: "var(--ink)",
                  textAlign: "center",
                  padding: "12px 0",
                }}
              >
                {panicPin}
              </div>
              <div className="field">
                <span className="lbl">Panic screen</span>
                <div className="seg">
                  {DECOY_OPTIONS.map((d) => (
                    <button
                      key={d.type}
                      type="button"
                      className={decoyType === d.type && useDecoy ? "active" : ""}
                      onClick={() => { setDecoyType(d.type); setUseDecoy(true) }}
                    >
                      {d.label}
                    </button>
                  ))}
                  <button type="button" className={!useDecoy ? "active" : ""} onClick={() => setUseDecoy(false)}>Blur</button>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-primary" onClick={() => setShowPinModal(false)}>I memorized it ↵</button>
            </div>
          </div>
        </div>
      )}

      {canDestroyRoom && (
        <ConfirmDialog
          open={showDestroyConfirm}
          title="Destroy Room?"
          description="This will permanently delete all messages and the room itself. This action cannot be undone."
          confirmText="DESTROY"
          variant="danger"
          onConfirm={() => { setShowDestroyConfirm(false); destroyRoom() }}
          onCancel={() => setShowDestroyConfirm(false)}
        />
      )}
      <ShareModal
        open={showShareModal}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title="Share Room"
        onClose={() => setShowShareModal(false)}
      />
      <UserSettings open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}

export default Page
