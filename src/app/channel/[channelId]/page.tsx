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
import { useToast } from "@/components/toast"
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
  const { isReady, encryptionKey } = useChatEncryption()
  const chat = useChatMessages({ type: "channel", id: channelId })
  const mi = useMessageInput({ type: "channel", id: channelId, encryptionKey })

  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")

  const { data: channelInfo, refetch: refetchInfo } = useQuery({
    queryKey: ["channel-info", channelId],
    queryFn: async () => (await client.channel.info.get({ query: { channelId } })).data,
  })

  const channelName = channelInfo && "name" in channelInfo ? (channelInfo.name as string) : "Channel"
  const channelDescription = channelInfo && "description" in channelInfo ? (channelInfo.description as string) : ""
  const memberCount = channelInfo && "members" in channelInfo ? (channelInfo.members as number) : 0
  const isAdmin = channelInfo && "isAdmin" in channelInfo ? (channelInfo.isAdmin as boolean) : false

  useEffect(() => {
    if (channelInfo && "name" in channelInfo) {
      const hash = window.location.hash.slice(1)
      addChat({ type: "channel", id: channelId, name: channelInfo.name as string, encryptionKey: hash })
    }
  }, [channelInfo, channelId, addChat])

  useEffect(() => {
    if (channelInfo && "name" in channelInfo) {
      setEditName(channelInfo.name as string)
      setEditDesc((channelInfo.description as string) || "")
    }
  }, [channelInfo])

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
      <main className="flex flex-col h-screen max-h-screen overflow-hidden bg-background text-foreground transition-all duration-500">
        <header className="border-b border-border p-2.5 flex items-center justify-between bg-card/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3 ml-10">
            <div className="w-10 h-10 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm shrink-0">
              {channelName.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base leading-tight truncate">{channelName}</span>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-[13px] text-muted-foreground font-medium leading-tight whitespace-nowrap">{memberCount} subscribers</span>
                {channelDescription && (
                  <>
                    <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground opacity-40 shrink-0" />
                    <span className="text-[12px] text-muted-foreground truncate italic opacity-80">{channelDescription}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors" title="Channel Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            )}
            <button onClick={() => setShowShareModal(true)} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors flex items-center gap-2 text-xs font-bold" title="Share channel link">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              <span className="hidden md:inline">SHARE</span>
            </button>
            <button onClick={toggleSound} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors" title={soundEnabled ? "Mute" : "Unmute"}>
              {soundEnabled ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              )}
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              AES-256
            </div>
            <ThemeSelector />
            {isAdmin && (
              <button onClick={() => setShowDestroyConfirm(true)} className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors" title="Delete channel">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        </header>

        <div ref={chat.scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 max-w-3xl mx-auto w-full">
          {chat.messages?.messages.length === 0 && <EmptyState type="channel" />}
          {chat.messages?.messages.map((msg, index) => (
            <div key={msg.id} className="flex items-end gap-2.5 group animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}>
              <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0 mb-0.5 shadow-sm">
                {msg.sender.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex flex-col max-w-[85%] min-w-0">
                <div className="relative p-2.5 rounded-2xl text-[14.5px] leading-snug break-all shadow-sm transition-all bg-card text-foreground rounded-bl-sm border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-bold text-primary leading-none">{msg.sender}</span>
                    {msg.token && <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">Admin</span>}
                  </div>
                  <EncryptedMessage text={msg.text} encryptionKey={encryptionKey} onBurn={() => chat.deleteMessage(msg.id)} onDecrypted={(plaintext) => chat.onDecrypted(msg.id, plaintext)} />
                  <div className="flex items-center justify-end gap-1.5 mt-1 -mb-1 ml-4 select-none opacity-60">
                    <span className="text-[11px] font-medium text-muted-foreground">{format(msg.timestamp, "HH:mm")}</span>
                  </div>
                  <div className="absolute top-1/2 -right-12 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                    <button onClick={() => chat.copyMessage(msg.id)} className={`p-1.5 rounded-full bg-card hover:bg-muted shadow-sm transition-colors border border-border ${chat.copiedMessageId === msg.id ? "text-green-500" : "text-muted-foreground"}`} title="Copy decrypted">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button onClick={() => { mi.setReplyTo({ id: msg.id, sender: msg.sender, text: chat.decryptedTexts[msg.id] || "" }); mi.inputRef.current?.focus() }} className="p-1.5 rounded-full bg-card hover:bg-muted shadow-sm transition-colors text-muted-foreground border border-border" title="Reply">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    </button>
                    {msg.token && (
                      <button onClick={() => chat.deleteMessage(msg.id)} className="p-1.5 rounded-full bg-card hover:bg-muted shadow-sm transition-colors text-destructive border border-border" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                <MessageReactions reactions={REACTION_EMOJIS.map((r) => ({ emoji: r.emoji, count: chat.reactions[msg.id]?.[r.emoji]?.count || 0, hasReacted: chat.reactions[msg.id]?.[r.emoji]?.hasReacted || false }))} onReact={(emoji) => chat.handleReact(msg.id, emoji)} />
              </div>
            </div>
          ))}
          <div ref={chat.messagesEndRef} />
        </div>

        <ScrollToBottom visible={chat.showScrollBtn} unreadCount={chat.newMsgCount} onClick={chat.scrollToBottom} />

        <div className="p-3 border-t border-border bg-card/80 backdrop-blur-md min-h-[64px] flex items-center">
          {isAdmin ? (
            <div className="w-full flex flex-col">
              {chat.typingUsers.length > 0 && (
                <div className="text-[12px] text-primary mb-1.5 px-4 font-medium flex items-center gap-1.5 animate-pulse">
                  {chat.typingUsers.join(", ")} is typing...
                </div>
              )}
              {mi.replyTo && (
                <div className="flex items-center gap-2 mb-2 mx-auto max-w-3xl w-full px-1 py-2 bg-muted/50 rounded-lg border-l-2 border-primary">
                  <div className="flex-1 min-w-0 px-3">
                    <span className="text-[10px] font-bold text-primary">{mi.replyTo.sender}</span>
                    <p className="text-xs text-muted-foreground truncate">{mi.replyTo.text}</p>
                  </div>
                  <button onClick={() => mi.setReplyTo(null)} className="p-1 text-muted-foreground hover:text-foreground shrink-0 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}
              <div className="max-w-3xl mx-auto w-full flex items-end gap-2.5">
                <div className="flex-1 flex items-end gap-2 bg-card rounded-[22px] px-3.5 py-2.5 shadow-sm border border-border transition-all focus-within:ring-2 focus-within:ring-primary/20">
                  <FileAttach onFile={(f) => mi.sendFile(f)} />
                  <VoiceRecorder onSend={(f) => mi.sendFile(f)} />
                  <EmojiPicker onSelect={(emoji) => mi.setInput((prev) => prev + emoji)} />
                  <textarea ref={mi.inputRef} autoFocus rows={1} value={mi.input} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (mi.input.trim() && !mi.isPending) { mi.sendMessage({ text: mi.input }); chat.sendTyping(false) } } }} placeholder="Message..." onChange={(e) => { mi.setInput(e.target.value); if (e.target.value) chat.handleTyping(); e.target.style.height = "inherit"; e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px` }} className="flex-1 w-full bg-transparent border-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-[15px] leading-[22px] p-0 text-foreground placeholder:text-muted-foreground resize-none overflow-y-auto block min-h-[22px] max-h-48" />
                </div>
                <button onClick={() => { if (mi.input.trim() && !mi.isPending) { mi.sendMessage({ text: mi.input }); chat.sendTyping(false); mi.inputRef.current?.focus() } }} disabled={!mi.input.trim() || mi.isPending || !encryptionKey} className="w-11 h-11 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-all disabled:opacity-0 disabled:scale-90 scale-100 shadow-md shrink-0 active:scale-95">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center py-2 px-4 bg-muted/30 rounded-lg max-w-3xl mx-auto">
              <span className="text-primary font-bold text-sm tracking-wide uppercase">Channel — Read Only</span>
            </div>
          )}
        </div>

        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-bold">Edit Channel</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-1 hover:bg-muted rounded-full transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-primary tracking-wider ml-1">Channel Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-muted border border-input focus:ring-2 focus:ring-primary/50 rounded-xl px-4 py-3 text-sm transition-all focus:outline-none" placeholder="Channel Name" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-primary tracking-wider ml-1">Description</label>
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="w-full bg-muted border border-input focus:ring-2 focus:ring-primary/50 rounded-xl px-4 py-3 text-sm transition-all resize-none focus:outline-none" placeholder="Describe your channel..." />
                </div>
                <button onClick={() => updateChannel()} disabled={isUpdating || !editName.trim()} className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <ConfirmDialog open={showDestroyConfirm} title="Delete Channel?" description="This will permanently delete the channel and all messages. This action cannot be undone." confirmText="DELETE" variant="danger" onConfirm={() => { setShowDestroyConfirm(false); destroyChannel() }} onCancel={() => setShowDestroyConfirm(false)} />
      <ShareModal open={showShareModal} url={typeof window !== "undefined" ? window.location.href : ""} title="Share Channel" onClose={() => setShowShareModal(false)} />
    </>
  )
}

export default Page
