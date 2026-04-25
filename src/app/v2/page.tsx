"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ThemeSelector } from "@/components/theme-selector"
import { useToast } from "@/components/toast"
import {
  apiAddGroupMembers,
  apiCreateLinkToken,
  apiGetGroup,
  apiMe,
  apiRemoveGroupMembers,
  apiRevokeDevice,
} from "@/lib/v2/api"
import {
  bootstrapNewIdentity,
  createGroup,
  distributeSenderKey,
  getSafetyNumbers,
  loadConversationMessages,
  loadConversationState,
  loadTransparency,
  refreshLocalPreKeys,
  sendDirectText,
  sendGroupText,
  startDirectConversation,
  syncInbox,
} from "@/lib/v2/protocol"
import type {
  V2ConversationMessage,
  V2ConversationRecord,
  V2LocalDeviceState,
  V2MeResponse,
  V2TransparencyEvent,
} from "@/lib/v2/types"

function splitCsv(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

export default function V2Page() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [local, setLocal] = useState<V2LocalDeviceState | null>(null)
  const [me, setMe] = useState<V2MeResponse | null>(null)
  const [conversations, setConversations] = useState<V2ConversationRecord[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<V2ConversationMessage[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [bootstrapName, setBootstrapName] = useState("anon-v2")
  const [bootstrapDeviceLabel, setBootstrapDeviceLabel] = useState("Primary Browser")
  const [bootstrapLinkToken, setBootstrapLinkToken] = useState("")
  const [remoteUserId, setRemoteUserId] = useState("")
  const [groupTitle, setGroupTitle] = useState("Secure Group")
  const [groupMembersInput, setGroupMembersInput] = useState("")
  const [groupAddInput, setGroupAddInput] = useState("")
  const [groupRemoveInput, setGroupRemoveInput] = useState("")
  const [groupMembers, setGroupMembers] = useState<Array<{ userId: string; role: "owner" | "member"; active: boolean; joinedAt: number }>>([])
  const [safetyNumbers, setSafetyNumbers] = useState<Array<{ deviceId: number; display: string }>>([])
  const [transparency, setTransparency] = useState<V2TransparencyEvent[]>([])
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationId === selectedConversationId) || null,
    [conversations, selectedConversationId],
  )

  const reloadDashboard = useCallback(async () => {
    const state = await loadConversationState()
    setLocal(state.local ?? null)
    setConversations(state.conversations)

    if (state.local) {
      const meData = await apiMe()
      setMe(meData)
    } else {
      setMe(null)
    }
  }, [])

  const reloadMessages = useCallback(async (conversationId: string | null) => {
    if (!conversationId) {
      setMessages([])
      return
    }

    setMessages(await loadConversationMessages(conversationId))
  }, [])

  const reloadGroupMembers = useCallback(async (groupId: string | undefined) => {
    if (!groupId || !local) {
      setGroupMembers([])
      return
    }

    try {
      const response = await apiGetGroup(groupId)
      setGroupMembers(response.members)
    } catch {
      setGroupMembers([])
    }
  }, [local])

  useEffect(() => {
    void (async () => {
      try {
        await reloadDashboard()
      } finally {
        setLoading(false)
      }
    })()
  }, [reloadDashboard])

  useEffect(() => {
    void reloadMessages(selectedConversationId)
    void reloadGroupMembers(selectedConversation?.groupId)
  }, [reloadGroupMembers, reloadMessages, selectedConversation?.groupId, selectedConversationId])

  useEffect(() => {
    if (!local) return

    const interval = window.setInterval(() => {
      void (async () => {
        const processed = await syncInbox()
        if (processed > 0) {
          await reloadDashboard()
          await reloadMessages(selectedConversationId)
        }
      })()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [local, reloadDashboard, reloadMessages, selectedConversationId])

  const runBusy = useCallback(
    async (label: string, task: () => Promise<void>) => {
      setBusy(label)
      try {
        await task()
      } catch (error) {
        toast(error instanceof Error ? error.message : "Operation failed", "error")
      } finally {
        setBusy(null)
      }
    },
    [toast],
  )

  const handleBootstrap = async () => {
    await runBusy("bootstrap", async () => {
      await bootstrapNewIdentity(bootstrapName, bootstrapDeviceLabel, bootstrapLinkToken || undefined)
      setBootstrapLinkToken("")
      await reloadDashboard()
      toast("V2 identity is ready", "success")
    })
  }

  const handleStartDirect = async () => {
    const userId = remoteUserId.trim()
    if (!userId) return

    await runBusy("direct", async () => {
      const result = await startDirectConversation(userId)
      await reloadDashboard()
      setSelectedConversationId(result.conversation.conversationId)
      setRemoteUserId("")
      toast("Secure session prepared", "success")
    })
  }

  const handleSend = async () => {
    const plaintext = messageInput.trim()
    if (!plaintext || !selectedConversation) return

    await runBusy("send", async () => {
      if (selectedConversation.kind === "direct" && selectedConversation.counterpartUserId) {
        await sendDirectText(selectedConversation.counterpartUserId, plaintext)
      } else if (selectedConversation.kind === "group" && selectedConversation.groupId) {
        await sendGroupText(selectedConversation.groupId, plaintext)
      } else {
        throw new Error("Unsupported conversation")
      }

      setMessageInput("")
      await reloadDashboard()
      await reloadMessages(selectedConversation.conversationId)
    })
  }

  const handleSync = async () => {
    await runBusy("sync", async () => {
      const processed = await syncInbox()
      await reloadDashboard()
      await reloadMessages(selectedConversationId)
      toast(processed > 0 ? `Synced ${processed} envelopes` : "No new envelopes", "info")
    })
  }

  const handleRefreshPrekeys = async () => {
    await runBusy("prekeys", async () => {
      await refreshLocalPreKeys()
      toast("Prekeys rotated locally", "success")
    })
  }

  const handleCreateLinkToken = async () => {
    await runBusy("link", async () => {
      const token = await apiCreateLinkToken()
      setLinkToken(token.token)
      toast("Link token created", "success")
    })
  }

  const handleRevokeDevice = async (deviceId: number) => {
    await runBusy("revoke", async () => {
      await apiRevokeDevice(deviceId)
      await reloadDashboard()
      toast(`Device ${deviceId} revoked`, "warning")
    })
  }

  const handleLoadSafetyNumbers = async () => {
    if (!selectedConversation?.counterpartUserId) return

    await runBusy("safety", async () => {
      const values = await getSafetyNumbers(selectedConversation.counterpartUserId!)
      setSafetyNumbers(values)
      toast("Safety numbers refreshed", "success")
    })
  }

  const handleLoadTransparency = async () => {
    if (!local) return

    await runBusy("transparency", async () => {
      const data = await loadTransparency(local.userId)
      setTransparency(data.events)
      toast("Transparency log loaded", "success")
    })
  }

  const handleCreateGroup = async () => {
    await runBusy("group", async () => {
      const created = await createGroup(groupTitle, splitCsv(groupMembersInput))
      await reloadDashboard()
      setSelectedConversationId(`group:${created.groupId}`)
      setGroupMembersInput("")
      toast("Secure group created", "success")
    })
  }

  const handleAddGroupMembers = async () => {
    const groupId = selectedConversation?.groupId
    if (!groupId) return

    await runBusy("group-members", async () => {
      const userIds = splitCsv(groupAddInput)
      if (userIds.length === 0) return
      await apiAddGroupMembers(groupId, userIds)
      await distributeSenderKey(groupId)
      await reloadGroupMembers(groupId)
      setGroupAddInput("")
      toast("Group members added and sender key rotated", "success")
    })
  }

  const handleRemoveGroupMembers = async () => {
    const groupId = selectedConversation?.groupId
    if (!groupId) return

    await runBusy("group-members", async () => {
      const userIds = splitCsv(groupRemoveInput)
      if (userIds.length === 0) return
      await apiRemoveGroupMembers(groupId, userIds)
      await distributeSenderKey(groupId)
      await reloadGroupMembers(groupId)
      setGroupRemoveInput("")
      toast("Group members removed and sender key rotated", "warning")
    })
  }

  if (loading) {
    return (
      <div className="frame">
        <div className="empty-state">
          <div className="kicker"><span>— Loading V2 —</span></div>
          <h3>Bootstrapping secure client…</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="frame">
      <header className="rail">
        <div className="brand">
          <Link href="/" className="brand-mark" title="Back home">← ANON</Link>
          <div className="brand-word">v2<em>.</em>secure</div>
        </div>
        <div className="rail-center">
          <span>Protocol MVP: X3DH + Double Ratchet + Sender Keys</span>
        </div>
        <div className="rail-right" style={{ gap: 8 }}>
          {busy && <span className="mono text-muted" style={{ fontSize: 11 }}>{busy}…</span>}
          <ThemeSelector />
        </div>
      </header>

      {!local ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "40px 20px" }}>
          <div className="panel" style={{ width: "100%", maxWidth: 720 }}>
            <div className="panel-body flex col gap-16">
              <div className="kicker">
                <span className="num">01 / 01</span>
                <span>— Initialize V2 identity</span>
              </div>
              <h2 className="modal-hero-title">New <em>protocol</em> identity.</h2>
              <p className="hero-sub">
                This creates a persistent user and device identity for the parallel `v2` messenger.
                It does not reuse the legacy room URL-key model.
              </p>
              <input value={bootstrapName} onChange={(e) => setBootstrapName(e.target.value)} placeholder="Profile name" />
              <input value={bootstrapDeviceLabel} onChange={(e) => setBootstrapDeviceLabel(e.target.value)} placeholder="Device label" />
              <input value={bootstrapLinkToken} onChange={(e) => setBootstrapLinkToken(e.target.value)} placeholder="Optional device link token" />
              <button className="btn-primary" type="button" onClick={handleBootstrap} disabled={busy !== null}>
                Create secure identity ↵
              </button>
              <div className="alert">
                <div className="alert-title">Web MVP note</div>
                <div className="alert-body">
                  Keys stay in IndexedDB for this browser profile. This is stronger than URL/shared-key
                  storage, but still not equal to a native secure enclave.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(340px, 380px) minmax(0, 1fr)",
            gap: 16,
            padding: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          <aside className="panel" style={{ minHeight: 0 }}>
            <div className="panel-body flex col gap-16" style={{ height: "100%", overflowY: "auto" }}>
              <div className="identity">
                <div className="glyph">{local.profileName[0]?.toUpperCase() || "V"}</div>
                <div className="idmeta">
                  <div className="idlbl">V2 identity</div>
                  <div className="idnum" title={local.userId}>{local.profileName}</div>
                  <div className="mono text-muted" style={{ fontSize: 10 }}>{local.userId}</div>
                  <div className="mono text-muted" style={{ fontSize: 10 }}>device #{local.deviceId} · {local.deviceLabel}</div>
                </div>
              </div>

              <div className="flex gap-8">
                <button className="btn-ghost" type="button" onClick={handleSync}>Sync inbox</button>
                <button className="btn-ghost" type="button" onClick={handleRefreshPrekeys}>Rotate prekeys</button>
                <button className="btn-ghost" type="button" onClick={handleCreateLinkToken}>Link device</button>
              </div>

              {linkToken && (
                <div className="alert">
                  <div className="alert-title">Link token</div>
                  <div className="alert-body">
                    <code style={{ wordBreak: "break-all" }}>{linkToken}</code>
                  </div>
                </div>
              )}

              {me && (
                <div className="flex col gap-8">
                  <div className="kicker"><span>— Devices —</span></div>
                  {me.devices.map((device) => (
                    <div key={device.deviceId} className="room-item">
                      <div className="rid">{device.deviceLabel}</div>
                      <div className="rmeta">#{device.deviceId}</div>
                      <div className="rlast">{device.revokedAt ? "revoked" : "active"}</div>
                      {device.deviceId !== local.deviceId && !device.revokedAt && (
                        <button className="rclose" onClick={() => void handleRevokeDevice(device.deviceId)}>revoke</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex col gap-8">
                <div className="kicker"><span>— Start direct chat —</span></div>
                <input value={remoteUserId} onChange={(e) => setRemoteUserId(e.target.value)} placeholder="Recipient userId" />
                <button className="btn-primary" type="button" onClick={handleStartDirect}>Prepare direct session</button>
              </div>

              <div className="flex col gap-8">
                <div className="kicker"><span>— Create group —</span></div>
                <input value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Group title" />
                <textarea
                  value={groupMembersInput}
                  onChange={(e) => setGroupMembersInput(e.target.value)}
                  placeholder="Comma-separated member userIds"
                  rows={3}
                />
                <button className="btn-primary" type="button" onClick={handleCreateGroup}>Create sender-key group</button>
              </div>

              <div className="flex col gap-8" style={{ minHeight: 0 }}>
                <div className="kicker">
                  <span>— Conversations —</span>
                  <span style={{ marginLeft: "auto" }}>{conversations.length}</span>
                </div>
                {conversations.length === 0 && (
                  <div className="empty-state" style={{ padding: "16px 12px" }}>
                    <p>No direct or group conversations yet.</p>
                  </div>
                )}
                {conversations.map((conversation) => (
                  <div
                    key={conversation.conversationId}
                    className={`room-item ${selectedConversationId === conversation.conversationId ? "active" : ""}`}
                    onClick={() => setSelectedConversationId(conversation.conversationId)}
                  >
                    <div className="rid">{conversation.title}</div>
                    <div className="rmeta">{conversation.kind}</div>
                    <div className="rlast">{new Date(conversation.lastMessageAt).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="panel" style={{ minHeight: 0 }}>
            <div className="panel-body flex col gap-16" style={{ height: "100%" }}>
              {selectedConversation ? (
                <>
                  <div className="flex gap-8" style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="kicker"><span>— Selected conversation —</span></div>
                      <h3 style={{ marginTop: 6 }}>{selectedConversation.title}</h3>
                      <div className="mono text-muted" style={{ fontSize: 10 }}>
                        {selectedConversation.conversationId}
                      </div>
                    </div>
                    <div className="flex gap-8">
                      {selectedConversation.kind === "direct" && (
                        <button className="btn-ghost" type="button" onClick={handleLoadSafetyNumbers}>
                          Safety numbers
                        </button>
                      )}
                      {selectedConversation.kind === "group" && selectedConversation.groupId && (
                        <button className="btn-ghost" type="button" onClick={() => void runBusy("sender-key", async () => {
                          await distributeSenderKey(selectedConversation.groupId!)
                          toast("Sender key redistributed", "success")
                        })}>
                          Redistribute sender key
                        </button>
                      )}
                      <button className="btn-ghost" type="button" onClick={handleLoadTransparency}>
                        Transparency
                      </button>
                    </div>
                  </div>

                  {selectedConversation.kind === "direct" && safetyNumbers.length > 0 && (
                    <div className="alert">
                      <div className="alert-title">Safety numbers</div>
                      <div className="alert-body">
                        {safetyNumbers.map((entry) => (
                          <div key={entry.deviceId} className="mono" style={{ fontSize: 11, marginBottom: 6 }}>
                            device #{entry.deviceId}: {entry.display}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedConversation.kind === "group" && selectedConversation.groupId && (
                    <div className="flex col gap-10">
                      <div className="kicker"><span>— Group membership —</span></div>
                      <div className="flex gap-8">
                        <input value={groupAddInput} onChange={(e) => setGroupAddInput(e.target.value)} placeholder="Add userIds" />
                        <button className="btn-ghost" type="button" onClick={handleAddGroupMembers}>Add</button>
                      </div>
                      <div className="flex gap-8">
                        <input value={groupRemoveInput} onChange={(e) => setGroupRemoveInput(e.target.value)} placeholder="Remove userIds" />
                        <button className="btn-ghost" type="button" onClick={handleRemoveGroupMembers}>Remove</button>
                      </div>
                      {groupMembers.map((member) => (
                        <div key={member.userId} className="room-item">
                          <div className="rid">{member.userId}</div>
                          <div className="rmeta">{member.role}</div>
                          <div className="rlast">{member.active ? "active" : "inactive"}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius)",
                      padding: 14,
                    }}
                  >
                    {messages.length === 0 ? (
                      <div className="empty-state" style={{ padding: "24px 12px" }}>
                        <p>No messages yet.</p>
                      </div>
                    ) : (
                      <div className="flex col gap-10">
                        {messages.map((message) => (
                          <div key={message.id} style={{ alignSelf: message.direction === "outgoing" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                            <div className="mono text-muted" style={{ fontSize: 10, marginBottom: 4 }}>
                              {message.direction} · {message.fromUserId} · {new Date(message.sentAt).toLocaleTimeString()}
                            </div>
                            <div
                              style={{
                                padding: "10px 12px",
                                borderRadius: 14,
                                border: "1px solid var(--rule)",
                                background: message.direction === "outgoing" ? "var(--ink)" : "var(--paper)",
                                color: message.direction === "outgoing" ? "var(--bg)" : "var(--ink)",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {message.plaintext}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-8">
                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={selectedConversation.kind === "group" ? "Encrypted group message" : "Encrypted direct message"}
                      rows={4}
                      style={{ flex: 1 }}
                    />
                    <button className="btn-primary" type="button" onClick={handleSend} disabled={!messageInput.trim()}>
                      Send ↵
                    </button>
                  </div>

                  {transparency.length > 0 && (
                    <div className="alert">
                      <div className="alert-title">Transparency events</div>
                      <div className="alert-body" style={{ maxHeight: 220, overflowY: "auto" }}>
                        {transparency.map((event) => (
                          <div key={event.eventId} className="mono" style={{ fontSize: 10, marginBottom: 10 }}>
                            <div>{event.type} · {new Date(event.createdAt).toLocaleString()}</div>
                            <div>{event.hash}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ flex: 1 }}>
                  <div className="kicker"><span>— V2 ready —</span></div>
                  <h3>Select a conversation</h3>
                  <p>
                    Start a direct chat by user id, or create a sender-key group from the left panel.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
