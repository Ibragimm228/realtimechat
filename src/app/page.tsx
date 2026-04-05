"use client"

import { generateKey } from "@/lib/crypto"
import { useUsername } from "@/hooks/use-username"
import { useActiveChats, type ChatType } from "@/hooks/use-active-chats"
import { client } from "@/lib/client"
import { ThemeSelector } from "@/components/theme-selector"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"
import { useToast } from "@/components/toast"
import { Onboarding } from "@/components/onboarding"
import { useMutation } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { formatDistanceToNow } from "date-fns"

const Page = () => {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  )
}

export default Page

function Lobby() {
  const { username, regenerate } = useUsername()
  const { chats, removeChat } = useActiveChats()
  const router = useRouter()
  const { toast } = useToast()

  const searchParams = useSearchParams()
  const wasDestroyed = searchParams.get("destroyed") === "true"
  const error = searchParams.get("error")

  const [capacity, setCapacity] = useState("2")
  const [duration, setDuration] = useState("600")

  const [activeTab, setActiveTab] = useState<"room" | "channel" | "group">("room")
  const [channelName, setChannelName] = useState("")
  const [channelDescription, setChannelDescription] = useState("")
  const [channelHandle, setChannelHandle] = useState("")
  const [channelDuration, setChannelDuration] = useState("0")

  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [groupHandle, setGroupHandle] = useState("")
  const [groupDuration, setGroupDuration] = useState("0")
  const [groupCapacity, setGroupCapacity] = useState("500")

  const [joinHandle, setJoinHandle] = useState("")

  const { mutate: createRoom, isPending: isCreatingRoom } = useMutation({
    mutationFn: async () => {
      const key = await generateKey()
      
      const res = await client.room.create.post({
        capacity: parseInt(capacity),
        ttl: parseInt(duration),
      })

      if (res.status === 200 && res.data?.roomId) {
        window.location.href = `${window.location.origin}/room/${res.data.roomId}#${key}`
      } else {
        throw new Error("Failed to create room")
      }
    },
    onError: () => {
      toast("Failed to create room. Please try again.", "error")
    }
  })

  const { mutate: createChannel, isPending: isCreatingChannel } = useMutation({
    mutationFn: async () => {
      const key = await generateKey()

      const res = await client.channel.create.post({
        name: channelName.trim(),
        description: channelDescription.trim() || undefined,
        handle: channelHandle.trim() || undefined,
        ttl: parseInt(channelDuration) || undefined,
      })

      if (res.status === 200 && res.data?.channelId) {
        window.location.href = `${window.location.origin}/channel/${res.data.channelId}#${key}`
      } else {
        throw new Error("Failed to create channel")
      }
    },
    onError: () => {
      toast("Failed to create channel. Please try again.", "error")
    }
  })

  const { mutate: createGroup, isPending: isCreatingGroup } = useMutation({
    mutationFn: async () => {
      const key = await generateKey()

      const res = await client.group.create.post({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        handle: groupHandle.trim() || undefined,
        ttl: parseInt(groupDuration) || undefined,
        capacity: parseInt(groupCapacity),
      })

      if (res.status === 200 && res.data?.groupId) {
        window.location.href = `${window.location.origin}/group/${res.data.groupId}#${key}`
      } else {
        throw new Error("Failed to create group")
      }
    },
    onError: () => {
      toast("Failed to create group. Please try again.", "error")
    }
  })

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 relative bg-background text-foreground transition-colors duration-300">
      <Onboarding />
      <KeyboardShortcuts />
      <div className="absolute top-4 right-4 z-50">
        <ThemeSelector />
      </div>
      <div className="w-full max-w-md space-y-8">
        {wasDestroyed && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">ROOM DESTROYED</p>
            <p className="text-muted-foreground text-xs mt-1">
              All messages were permanently deleted.
            </p>
          </div>
        )}
        {error === "room-not-found" && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">ROOM NOT FOUND</p>
            <p className="text-muted-foreground text-xs mt-1">
              This room may have expired or never existed.
            </p>
          </div>
        )}
        {error === "room-full" && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">ROOM FULL</p>
            <p className="text-muted-foreground text-xs mt-1">
              This room is at maximum capacity.
            </p>
          </div>
        )}
        {error === "invalid-room" && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">INVALID ROOM</p>
            <p className="text-muted-foreground text-xs mt-1">
              The room ID format is invalid.
            </p>
          </div>
        )}
        {error === "missing-key" && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">🔑 ENCRYPTION KEY MISSING</p>
            <p className="text-muted-foreground text-xs mt-1">
              This link is incomplete. The encryption key (#...) is missing from the URL.
            </p>
            <p className="text-muted-foreground text-xs mt-2 font-bold">
              ⚠️ Request a new invite link from the room creator.
            </p>
          </div>
        )}
        {error === "invalid-key" && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">🔑 INVALID ENCRYPTION KEY</p>
            <p className="text-muted-foreground text-xs mt-1">
              The encryption key in the URL is corrupted or invalid.
            </p>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {">"}private_chat
          </h1>
          <p className="text-muted-foreground text-sm">Encrypted chat rooms without sign-up.</p>
          
          <a 
            href="https://t.me/FrontendMania" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-xs font-medium rounded-full transition-colors border border-border"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.29-.48.79-.74 3.08-1.34 5.15-2.23 6.21-2.66 2.95-1.23 3.56-1.43 3.97-1.43.09 0 .28.02.4.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
            @FrontendMania
          </a>
        </div>

        <div className="border border-border bg-card p-6 backdrop-blur-md rounded-xl shadow-2xl">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-muted-foreground text-xs uppercase font-bold tracking-wider">Your Identity</label>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md truncate">
                  {username}
                </div>
                <button 
                  onClick={regenerate}
                  className="bg-muted border border-input p-3 rounded-md hover:bg-secondary hover:text-secondary-foreground transition-colors group"
                  title="Generate new identity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                    <path d="M16 16h5v5"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Join by @handle</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">@</span>
                  <input
                    type="text"
                    value={joinHandle}
                    onChange={(e) => setJoinHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    placeholder="handle"
                    maxLength={30}
                    className="w-full bg-muted border border-input p-3 pl-8 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && joinHandle.trim()) {
                        router.push(`/join/${joinHandle.trim()}`)
                      }
                    }}
                  />
                </div>
                <button
                  onClick={() => joinHandle.trim() && router.push(`/join/${joinHandle.trim()}`)}
                  disabled={!joinHandle.trim()}
                  className="bg-primary text-primary-foreground px-4 text-sm font-bold rounded-md hover:opacity-90 transition-all disabled:opacity-50"
                >
                  JOIN
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase font-bold">or create</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setActiveTab("room")}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === "room"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Room
              </button>
              <button
                onClick={() => setActiveTab("channel")}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === "channel"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Channel
              </button>
              <button
                onClick={() => setActiveTab("group")}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === "group"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Group
              </button>
            </div>

            {activeTab === "room" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Max Users</label>
                    <select 
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    >
                      <option value="2">2 Users</option>
                      <option value="5">5 Users</option>
                      <option value="10">10 Users</option>
                      <option value="50">50 Users</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Duration</label>
                    <select 
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    >
                      <option value="600">10 Minutes</option>
                      <option value="3600">1 Hour</option>
                      <option value="86400">24 Hours</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => createRoom()}
                  disabled={isCreatingRoom}
                  className="w-full bg-primary text-primary-foreground p-3 text-sm font-bold hover:opacity-90 transition-all mt-2 cursor-pointer disabled:opacity-50 rounded-md shadow-lg shadow-primary/20"
                >
                  {isCreatingRoom ? "CREATING..." : "CREATE ENCRYPTED ROOM"}
                </button>
              </>
            )}

            {activeTab === "channel" && (
              <>
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Channel Name</label>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="e.g. announcements..."
                    maxLength={64}
                    className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">@Handle (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">@</span>
                    <input
                      type="text"
                      value={channelHandle}
                      onChange={(e) => setChannelHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                      placeholder="my_channel"
                      maxLength={30}
                      className="w-full bg-muted border border-input p-3 pl-8 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 px-1">Others can find and join via /join/@handle</p>
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Description (Optional)</label>
                  <input
                    type="text"
                    value={channelDescription}
                    onChange={(e) => setChannelDescription(e.target.value)}
                    placeholder="What is this channel about?"
                    maxLength={256}
                    className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Duration</label>
                  <select
                    value={channelDuration}
                    onChange={(e) => setChannelDuration(e.target.value)}
                    className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="0">Permanent</option>
                    <option value="3600">1 Hour</option>
                    <option value="86400">24 Hours</option>
                    <option value="604800">7 Days</option>
                  </select>
                </div>

                <button
                  onClick={() => createChannel()}
                  disabled={isCreatingChannel || !channelName.trim()}
                  className="w-full bg-primary text-primary-foreground p-3 text-sm font-bold hover:opacity-90 transition-all mt-2 cursor-pointer disabled:opacity-50 rounded-md shadow-lg shadow-primary/20"
                >
                  {isCreatingChannel ? "CREATING..." : "CREATE CHANNEL"}
                </button>
              </>
            )}

            {activeTab === "group" && (
              <>
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Group Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. dev-team, project-x..."
                    maxLength={64}
                    className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">@Handle (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">@</span>
                    <input
                      type="text"
                      value={groupHandle}
                      onChange={(e) => setGroupHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                      placeholder="my_group"
                      maxLength={30}
                      className="w-full bg-muted border border-input p-3 pl-8 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 px-1">Others can find and join via /join/@handle</p>
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Description (Optional)</label>
                  <input
                    type="text"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="What is this group about?"
                    maxLength={256}
                    className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Max Members</label>
                    <select
                      value={groupCapacity}
                      onChange={(e) => setGroupCapacity(e.target.value)}
                      className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    >
                      <option value="10">10</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="500">500</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Duration</label>
                    <select
                      value={groupDuration}
                      onChange={(e) => setGroupDuration(e.target.value)}
                      className="w-full bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    >
                      <option value="0">Permanent</option>
                      <option value="3600">1 Hour</option>
                      <option value="86400">24 Hours</option>
                      <option value="604800">7 Days</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => createGroup()}
                  disabled={isCreatingGroup || !groupName.trim()}
                  className="w-full bg-primary text-primary-foreground p-3 text-sm font-bold hover:opacity-90 transition-all mt-2 cursor-pointer disabled:opacity-50 rounded-md shadow-lg shadow-primary/20"
                >
                  {isCreatingGroup ? "CREATING..." : "CREATE GROUP"}
                </button>
              </>
            )}
          </div>
        </div>

        {chats.length > 0 && (
          <div className="border border-border bg-card p-5 backdrop-blur-md rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Your Chats
              </h2>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-bold">
                {chats.length}
              </span>
            </div>
            <div className="space-y-1">
              {chats.map((chat) => {
                const config: Record<ChatType, { icon: string; color: string; prefix: string }> = {
                  room: { icon: "🔒", color: "text-primary", prefix: "/room/" },
                  channel: { icon: "📢", color: "text-blue-500", prefix: "/channel/" },
                  group: { icon: "👥", color: "text-emerald-500", prefix: "/group/" },
                }
                const c = config[chat.type]
                const href = `${c.prefix}${chat.id}#${chat.encryptionKey}`
                return (
                  <div
                    key={`${chat.type}-${chat.id}`}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => { window.location.href = href }}
                  >
                    <span className="text-base shrink-0">{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate">{chat.name}</span>
                        <span className={`text-[9px] font-black uppercase ${c.color} opacity-70`}>{chat.type}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(chat.joinedAt, { addSuffix: true })}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeChat(chat.type, chat.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      title="Remove"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
