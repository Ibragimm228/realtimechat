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
import { useToast } from "@/components/toast"
import Link from "next/link"
import { useMutation, useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const Page = () => {
  const params = useParams()
  const channelId = params.channelId as string
  const router = useRouter()
  const { toast } = useToast()
  const { enabled: soundEnabled, toggle: toggleSound } = useSound()

  const { addChat } = useActiveChats()
  const { isReady, encryptionKey, keyHash } = useChatEncryption({ type: "channel", id: channelId })
  const {
    messages,
    reactions,
    copiedMessageId,
    decryptedTexts,
    typingUsers,
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
    addOptimisticMessage,
    removeOptimisticMessage,
  } = useChatMessages({ type: "channel", id: channelId, enabled: isReady })
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
    type: "channel",
    id: channelId,
    encryptionKey,
    onOptimisticMessage: addOptimisticMessage,
    onOptimisticRollback: removeOptimisticMessage,
  })

  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [sideOpen, setSideOpen] = useState(true)

  const { data: channelInfo, refetch: refetchInfo } = useQuery({
    queryKey: ["channel-info", channelId],
    enabled: isReady,
    queryFn: async () => (await client.channel.info.get({ query: { channelId } })).data,
  })

  const channelName = channelInfo && "name" in channelInfo ? (channelInfo.name as string) : "Channel"
  const channelDescription = channelInfo && "description" in channelInfo ? (channelInfo.description as string) : ""
  const memberCount = channelInfo && "members" in channelInfo ? (channelInfo.members as number) : 0
  const isAdmin = channelInfo && "isAdmin" in channelInfo ? (channelInfo.isAdmin as boolean) : false

  useEffect(() => {
    if (channelInfo && "name" in channelInfo && keyHash) {
      addChat({ type: "channel", id: channelId, name: channelInfo.name as string, encryptionKey: keyHash })
    }
  }, [channelInfo, channelId, addChat, keyHash])

  const { mutate: updateChannel, isPending: isUpdating } = useMutation({
    mutationFn: async () => { await client.channel.patch({ name: editName, description: editDesc }, { query: { channelId } }) },
    onSuccess: () => { refetchInfo(); setIsSettingsOpen(false); toast("Channel updated!", "success") },
  })

  const { mutate: destroyChannel } = useMutation({
    mutationFn: async () => { await client.channel.delete(null, { query: { channelId } }) },
    onSuccess: () => router.push("/?destroyed=true"),
  })

  if (!isReady) return <LoadingScreen />

  return (
    <>
      <ChatSidebar currentType="channel" currentId={channelId} />
      <KeyboardShortcuts />

      <div className="frame">
        <header className="rail">
          <div className="brand">
            <Link href="/" className="brand-mark" title="Home">← ANON</Link>
            <div className="brand-word">channel<em>.</em>{channelName.slice(0, 16)}</div>
            <div className="brand-tag">
              <span className="pill-dot pulse" style={{ marginRight: 8 }} />
              {memberCount} subscribers
            </div>
          </div>
          <div className="rail-center">
            {channelDescription && <span>— {channelDescription}</span>}
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
            {isAdmin && (
              <button
                className="icon-btn"
                onClick={() => { setEditName(channelName); setEditDesc(channelDescription); setIsSettingsOpen(true) }}
                title="Edit channel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
              </button>
            )}
            <ThemeSelector />
            {isAdmin && (
              <button className="chip danger" onClick={() => setShowDestroyConfirm(true)}>
                Delete
              </button>
            )}
          </div>
        </header>

        <div className={`chat-wrap ${sideOpen ? "" : "side-hidden"}`}>
          <aside className="side-col">
            <div className="side-section">
              <h4>Channel</h4>
              <div className="identity" style={{ padding: 14 }}>
                <div className="glyph" style={{ width: 40, height: 40, fontSize: 16 }}>
                  {channelName.slice(0, 1).toUpperCase()}
                </div>
                <div className="idmeta">
                  <div className="idlbl">{isAdmin ? "Admin" : "Subscriber"}</div>
                  <div className="idnum" style={{ fontSize: 14 }}>{channelName}</div>
                </div>
              </div>
            </div>

            {channelDescription && (
              <div className="side-section">
                <h4>About</h4>
                <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>{channelDescription}</p>
              </div>
            )}

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
              <h4>Stats</h4>
              <div className="legend" style={{ flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <span><span className="dash" />{memberCount} subscribers</span>
                <span><span className="dash" />{messages?.messages.length || 0} messages</span>
                <span><span className="dash" />AES-GCM-256</span>
              </div>
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
                <div className="peer">
                  <div className="glyph" style={{ width: 36, height: 36, border: "1px solid var(--rule)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, borderRadius: "var(--radius)" }}>
                    {channelName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex col">
                    <div className="p-id" title={channelName}>{channelName}</div>
                    <div className="p-status">
                      <span className="pill-dot pulse" style={{ marginRight: 6 }} />
                      {memberCount} subs
                    </div>
                  </div>
                </div>
              </div>
              <div className="center" />
              <div className="right">
                {isAdmin ? (
                  <span className="chip">Admin</span>
                ) : (
                  <span className="chip ghost">Read-only</span>
                )}
              </div>
            </div>

            <div ref={scrollContainerRef} className="transcript" data-bubble="stamped">
              {messages?.messages.length === 0 && <EmptyState type="channel" />}

              {messages?.messages.map((msg) => {
                const mine = !!msg.token
                const copied = copiedMessageId === msg.id
                const reactionItems = REACTION_EMOJIS.map((r) => ({
                  emoji: r.emoji,
                  count: reactions[msg.id]?.[r.emoji]?.count || 0,
                  hasReacted: reactions[msg.id]?.[r.emoji]?.hasReacted || false,
                }))
                const hasActiveReactions = reactionItems.some((reaction) => reaction.count > 0)
                return (
                  <div key={msg.id} className={`msg ${mine ? "mine" : ""}`}>
                    <div className="msg-meta">
                      <div className="msg-meta-inner">
                        <span className={mine ? "mine-tag" : "id"}>
                          {mine ? "YOU" : `#${msg.sender}`}
                        </span>
                        <span className="time">{format(msg.timestamp, "HH:mm")}</span>
                        {msg.token && <span className="time" style={{ color: "var(--accent)" }}>ADMIN</span>}
                      </div>
                    </div>
                    <div className="msg-body">
                      <div className="bubble">
                        <EncryptedMessage
                          text={msg.text}
                          encryptionKey={encryptionKey}
                          onBurn={() => deleteMessage(msg.id)}
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
                        <button onClick={() => copyMessage(msg.id)} className={copied ? "active" : ""} title="Copy">{copied ? "✓" : "⎘"}</button>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setReplyTo({ id: msg.id, sender: mine ? "You" : msg.sender, text: decryptedTexts[msg.id] || "" })
                              inputRef.current?.focus()
                            }}
                            title="Reply"
                          >
                            ↩
                          </button>
                        )}
                        {msg.token && (
                          <button onClick={() => deleteMessage(msg.id)} title="Delete" style={{ color: "var(--danger)" }}>✕</button>
                        )}
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
                    <div className="typing"><div className="dots"><span /><span /><span /></div></div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <ScrollToBottom visible={showScrollBtn} unreadCount={newMsgCount} onClick={scrollToBottom} />

            {isAdmin ? (
              <div className="composer">
                <div className="composer-meta">
                  <span>— Broadcast · only admins can post</span>
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
                    placeholder="Post to your channel…"
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
                    Post <span style={{ fontSize: 14 }}>↵</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="composer" style={{ textAlign: "center" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  — Channel is read-only · only admins can post —
                </span>
              </div>
            )}
          </section>
        </div>
      </div>

      {isSettingsOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h3>Edit channel</h3>
              <button className="icon-btn" onClick={() => setIsSettingsOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <span className="lbl">Name</span>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl">Description</span>
                <textarea rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setIsSettingsOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => updateChannel()} disabled={isUpdating || !editName.trim()}>
                {isUpdating ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDestroyConfirm}
        title="Delete Channel?"
        description="This will permanently delete the channel and all messages. This action cannot be undone."
        confirmText="DELETE"
        variant="danger"
        onConfirm={() => { setShowDestroyConfirm(false); destroyChannel() }}
        onCancel={() => setShowDestroyConfirm(false)}
      />
      <ShareModal
        open={showShareModal}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title="Share Channel"
        onClose={() => setShowShareModal(false)}
      />
    </>
  )
}

export default Page
