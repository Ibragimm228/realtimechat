import { redis } from "@/lib/redis"
import { Elysia, t } from "elysia"
import { nanoid } from "nanoid"
import { authMiddleware, AuthError } from "./auth"
import { Message, realtime } from "@/lib/realtime"
import { Ratelimit } from "@upstash/ratelimit"
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  admitMember,
  getClientIp,
  getMetaKey,
  readActiveConnected,
  requireActiveMember,
} from "@/lib/membership"

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
})

const MAX_TTL = 86400
const MIN_TTL = 60
const MAX_CAPACITY = 50
const MIN_CAPACITY = 2
const MAX_MESSAGES = 200
const AUTH_TOKEN_MAX_LENGTH = 128

type MessageWithMeta = Message & { burnAfter?: number; token?: string }
type ReactionState = Record<string, Record<string, { count: number; hasReacted: boolean }>>

function normalizeSenderName(sender: string) {
  const normalized = sender.replace(/\s+/g, " ").trim().slice(0, 100)
  return normalized || "Anonymous"
}

function parseReactionTokens(rawValue: string | string[] | null | undefined): string[] {
  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : []
    } catch {
      return []
    }
  }

  if (Array.isArray(rawValue)) {
    return rawValue.filter((item): item is string => typeof item === "string")
  }

  return []
}

async function buildReactions(scope: "room" | "channel" | "group", id: string, messages: MessageWithMeta[], currentToken: string): Promise<ReactionState> {
  const reactions = await Promise.all(
    messages.map(async (message) => {
      const raw = await redis.hgetall(`reactions:${scope}:${id}:${message.id}`) as Record<string, string> | null
      if (!raw) {
        return [message.id, {}] as const
      }

      const messageReactions = Object.entries(raw).reduce((acc, [emoji, value]) => {
        const tokens = parseReactionTokens(value)
        if (tokens.length > 0) {
          acc[emoji] = {
            count: tokens.length,
            hasReacted: tokens.includes(currentToken),
          }
        }
        return acc
      }, {} as Record<string, { count: number; hasReacted: boolean }>)

      return [message.id, messageReactions] as const
    })
  )

  return reactions.reduce((acc, [messageId, messageReactions]) => {
    if (Object.keys(messageReactions).length > 0) {
      acc[messageId] = messageReactions
    }
    return acc
  }, {} as ReactionState)
}

const rateLimitMiddleware = new Elysia({ name: "ratelimit" })
  .derive(async ({ request, set }) => {
    const ip = getClientIp(request.headers)
    try {
      const result = await ratelimit.limit(ip)
      if (!result.success) {
        set.status = 429
        throw new Error("Rate limit exceeded")
      }
    } catch (e) {
      console.error("Ratelimit error:", e)
      if (Number(set.status) === 429) {
        throw e
      }
      if (!set.status || Number(set.status) < 400) {
        set.status = 503
      }
      throw new Error("Rate limit unavailable")
    }
  })

const rooms = new Elysia({ prefix: "/room" })
  .use(rateLimitMiddleware)
  .post("/create", async ({ body, cookie }) => {
    const { ttl = 600, capacity = 2 } = body
    const roomId = nanoid()
    let ownerToken = cookie[AUTH_COOKIE_NAME]?.value as string | undefined

    if (!ownerToken) {
      ownerToken = nanoid()
      cookie[AUTH_COOKIE_NAME].set({
        value: ownerToken,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
      })
    }

    await redis.hset(getMetaKey("room", roomId), {
      connected: JSON.stringify([ownerToken]),
      capacity,
      createdAt: Date.now(),
      ownerToken,
    })

    await redis.expire(getMetaKey("room", roomId), ttl)
    await admitMember("room", roomId, ownerToken, capacity)

    return { roomId }
  }, {
    body: t.Object({
      ttl: t.Optional(t.Number({ 
        minimum: MIN_TTL, 
        maximum: MAX_TTL,
        default: 600
      })),
      capacity: t.Optional(t.Number({ 
        minimum: MIN_CAPACITY, 
        maximum: MAX_CAPACITY,
        default: 2
      })),
    })
  })
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const [ttl, meta] = await Promise.all([
        redis.ttl(getMetaKey("room", auth.roomId)),
        redis.hgetall(getMetaKey("room", auth.roomId)) as Promise<Record<string, unknown> | null>,
      ])

      return {
        ttl: ttl > 0 ? ttl : 0,
        isOwner: meta?.ownerToken === auth.token,
      }
    },
    { 
      query: t.Object({ 
        roomId: t.String({ maxLength: 64 }) 
      }) 
    }
  )
  .delete(
    "/",
    async ({ auth, set }) => {
      const meta = await redis.hgetall(getMetaKey("room", auth.roomId)) as Record<string, unknown> | null
      if (!meta) {
        set.status = 404
        throw new Error("Room not found")
      }

      if (meta.ownerToken !== auth.token) {
        set.status = 403
        throw new Error("Only the room owner can destroy the room")
      }

      await realtime.channel(auth.roomId).emit("chat.destroy", { 
        isDestroyed: true, 
        roomId: auth.roomId, 
        timestamp: Date.now() 
      })

      await Promise.all([
        redis.del(getMetaKey("room", auth.roomId)),
        redis.del(`messages:${auth.roomId}`),
        redis.del(`users:${auth.roomId}`),
        redis.del(`pinned:${auth.roomId}`),
      ])
    },
    { 
      query: t.Object({ 
        roomId: t.String({ maxLength: 64 }) 
      }) 
    }
  )

const messages = new Elysia({ prefix: "/messages" })
  .use(rateLimitMiddleware)
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const { sender, text, burnAfter } = body
      const { roomId } = auth

      const roomExists = await redis.exists(getMetaKey("room", roomId))

      if (!roomExists) {
        throw new Error("Room does not exist")
      }

      const userKey = `users:${roomId}`
      let finalSender = normalizeSenderName(sender)
      
      const storedName = await redis.hget<string>(userKey, auth.token)
      if (storedName) {
        finalSender = storedName
      } else {
        await redis.hset(userKey, { [auth.token]: finalSender })
        const remaining = await redis.ttl(getMetaKey("room", roomId))
        if (remaining > 0) await redis.expire(userKey, remaining)
      }

      const messageId = nanoid()

      const message: Message = {
        id: messageId,
        sender: finalSender,
        text,
        timestamp: Date.now(),
        roomId,
      }

      const stored = burnAfter && burnAfter > 0
        ? { ...message, token: auth.token, burnAfter }
        : { ...message, token: auth.token }
      await redis.rpush(`messages:${roomId}`, stored)
      await redis.ltrim(`messages:${roomId}`, -MAX_MESSAGES, -1)
      await realtime.channel(roomId).emit("chat.message", message)

      if (burnAfter && burnAfter > 0) {
        await redis.set(`burn:${roomId}:${messageId}`, "1", { ex: burnAfter })
      }

      const remaining = await redis.ttl(getMetaKey("room", roomId))

      if (remaining > 0) {
        await redis.expire(`messages:${roomId}`, remaining)
      }
    },
    {
      query: t.Object({ 
        roomId: t.String({ maxLength: 64 }) 
      }),
      body: t.Object({
        sender: t.String({ maxLength: 100 }),
        text: t.String({ maxLength: 5000 }),
        burnAfter: t.Optional(t.Number({ minimum: 1, maximum: 300 })),
      }),
    }
  )
  .post(
    "/typing",
    async ({ body, auth }) => {
      const { isTyping, username } = body
      const { roomId, token } = auth

      const storedName = await redis.hget<string>(`users:${roomId}`, token)
      const finalUsername = storedName || username

      await realtime.channel(roomId).emit("chat.typing", {
        roomId,
        token,
        username: finalUsername,
        isTyping,
        timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ 
        roomId: t.String({ maxLength: 64 }) 
      }),
      body: t.Object({
        username: t.String({ maxLength: 100 }),
        isTyping: t.Boolean(),
      }),
    }
  )
  .get(
    "/",
    async ({ auth }) => {
      const allMessages = await redis.lrange<MessageWithMeta>(`messages:${auth.roomId}`, 0, -1)

      const expired: MessageWithMeta[] = []
      for (const m of allMessages || []) {
        if (m.burnAfter && m.burnAfter > 0) {
          const alive = await redis.exists(`burn:${auth.roomId}:${m.id}`)
          if (!alive) {
            expired.push(m)
          }
        }
      }

      for (const m of expired) {
        await redis.lrem(`messages:${auth.roomId}`, 1, m)
        await realtime.channel(auth.roomId).emit("chat.delete", {
          messageId: m.id,
          roomId: auth.roomId,
          timestamp: Date.now(),
        })
      }

      if (expired.length > 0) {
        const freshMessages = await redis.lrange<MessageWithMeta>(`messages:${auth.roomId}`, 0, -1)
        const safeMessages = (freshMessages || []).map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        }))

        return {
          messages: safeMessages,
          reactions: await buildReactions("room", auth.roomId, freshMessages || [], auth.token),
        }
      }

      const safeMessages = (allMessages || []).map((m) => ({
        ...m,
        token: m.token === auth.token ? auth.token : undefined,
      }))

      return {
        messages: safeMessages,
        reactions: await buildReactions("room", auth.roomId, allMessages || [], auth.token),
      }
    },
    { 
      query: t.Object({ 
        roomId: t.String({ maxLength: 64 }) 
      }) 
    }
  )
  .delete(
    "/",
    async ({ query, auth, set }) => {
      const { messageId } = query
      const messages = await redis.lrange<MessageWithMeta>(`messages:${auth.roomId}`, 0, -1)
      const messageIndex = messages.findIndex((m) => m.id === messageId)

      if (messageIndex !== -1) {
        const messageToDelete = messages[messageIndex]
        const meta = await redis.hgetall(getMetaKey("room", auth.roomId)) as Record<string, unknown> | null
        const isOwner = meta?.ownerToken === auth.token
        const isAuthor = messageToDelete.token === auth.token

        if (!isOwner && !isAuthor) {
          set.status = 403
          throw new Error("Only the author or room owner can delete messages")
        }

        await redis.lrem(`messages:${auth.roomId}`, 1, messageToDelete)
        await realtime.channel(auth.roomId).emit("chat.delete", { 
          messageId, 
          roomId: auth.roomId,
          timestamp: Date.now()
        })
      }
    },
    {
      query: t.Object({
        roomId: t.String({ maxLength: 64 }),
        messageId: t.String({ maxLength: 64 }),
      })
    }
  )
  .post(
    "/pin",
    async ({ body, auth, set }) => {
      const { messageId, action } = body
      const pinKey = `pinned:${auth.roomId}`

      if (action === "pin") {
        const msgs = await redis.lrange<MessageWithMeta>(`messages:${auth.roomId}`, 0, -1)
        const target = msgs.find((m) => m.id === messageId)
        if (!target) throw new Error("Message not found")

        const storedName = await redis.hget<string>(`users:${auth.roomId}`, auth.token)
        const pinnedBy = storedName || "Unknown"

        await redis.hset(pinKey, { [messageId]: JSON.stringify({ sender: target.sender, text: target.text, pinnedBy, pinnedByToken: auth.token, timestamp: Date.now() }) })
        const remaining = await redis.ttl(getMetaKey("room", auth.roomId))
        if (remaining > 0) await redis.expire(pinKey, remaining)

        await realtime.channel(auth.roomId).emit("chat.pin", {
          messageId, sender: target.sender, text: target.text,
          action: "pin", pinnedBy, roomId: auth.roomId, timestamp: Date.now(),
        })
      } else {
        const rawPin = await redis.hget<string>(pinKey, messageId)
        const meta = await redis.hgetall(getMetaKey("room", auth.roomId)) as Record<string, unknown> | null

        if (rawPin) {
          const parsedPin = JSON.parse(rawPin) as { pinnedByToken?: string }
          const isOwner = meta?.ownerToken === auth.token
          const isPinner = parsedPin.pinnedByToken === auth.token

          if (!isOwner && !isPinner) {
            set.status = 403
            throw new Error("Only the room owner or the user who pinned the message can unpin it")
          }
        }

        await redis.hdel(pinKey, messageId)

        await realtime.channel(auth.roomId).emit("chat.pin", {
          messageId, sender: "", text: "",
          action: "unpin", pinnedBy: "", roomId: auth.roomId, timestamp: Date.now(),
        })
      }
    },
    {
      query: t.Object({ roomId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        messageId: t.String({ maxLength: 64 }),
        action: t.Union([t.Literal("pin"), t.Literal("unpin")]),
      }),
    }
  )
  .get(
    "/pinned",
    async ({ auth }) => {
      const pinKey = `pinned:${auth.roomId}`
      const all = await redis.hgetall(pinKey) as Record<string, string> | null
      if (!all) return { pinned: [] }

      const pinned = Object.entries(all).map(([id, raw]) => {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw
        return { id, sender: data.sender, text: data.text, pinnedBy: data.pinnedBy, timestamp: data.timestamp }
      })

      return { pinned: pinned.sort((a, b) => b.timestamp - a.timestamp) }
    },
    { query: t.Object({ roomId: t.String({ maxLength: 64 }) }) }
  )
  .post(
    "/react",
    async ({ body, auth }) => {
      const { messageId, emoji, action } = body
      const key = `reactions:room:${auth.roomId}:${messageId}`
      const current = parseReactionTokens(await redis.hget<string | string[]>(key, emoji))

      if (action === "add" && !current.includes(auth.token)) {
        await redis.hset(key, { [emoji]: JSON.stringify([...current, auth.token]) })
      } else if (action === "remove") {
        const nextTokens = current.filter((token) => token !== auth.token)
        if (nextTokens.length > 0) {
          await redis.hset(key, { [emoji]: JSON.stringify(nextTokens) })
        } else {
          await redis.hdel(key, emoji)
        }
      }

      const remaining = await redis.ttl(getMetaKey("room", auth.roomId))
      if (remaining > 0) await redis.expire(key, remaining)

      await realtime.channel(auth.roomId).emit("chat.react", {
        messageId, emoji, token: auth.token, action,
        roomId: auth.roomId, timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ roomId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        messageId: t.String({ maxLength: 64 }),
        emoji: t.String({ maxLength: 8 }),
        action: t.Union([t.Literal("add"), t.Literal("remove")]),
      }),
    }
  )

const channelCookieMiddleware = new Elysia({ name: "channel-cookie-auth" })
  .error({ AuthError })
  .onError(({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401
      return { error: "Unauthorized" }
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const channelId = query.channelId
    const token = cookie[AUTH_COOKIE_NAME]?.value as string | undefined

    if (!channelId || !token) {
      throw new AuthError("Missing channelId or token.")
    }

    if (channelId.length > 64 || token.length > AUTH_TOKEN_MAX_LENGTH) {
      throw new AuthError("Invalid channelId or token format.")
    }

    return { channelAuth: { channelId, token } }
  })

const channelMemberMiddleware = new Elysia({ name: "channel-member-auth" })
  .use(channelCookieMiddleware)
  .derive({ as: "scoped" }, async ({ channelAuth }) => {
    if (!channelAuth) {
      throw new AuthError("Missing channel auth context")
    }

    const connected = await requireActiveMember("channel", channelAuth.channelId, channelAuth.token)
    if (!connected) {
      throw new AuthError("Invalid token")
    }

    return { channelAuth: { ...channelAuth, connected } }
  })

const MAX_CHANNEL_CAPACITY = 1000
const MAX_CHANNEL_MESSAGES = 500

const channels = new Elysia({ prefix: "/channel" })
  .use(rateLimitMiddleware)
  .post("/create", async ({ body, cookie }) => {
    const { name, ttl, description, handle } = body
    const channelId = nanoid()

    let ownerToken = cookie[AUTH_COOKIE_NAME]?.value as string | undefined
    if (!ownerToken) {
      ownerToken = nanoid()
      cookie[AUTH_COOKIE_NAME].set({
        value: ownerToken,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
      })
    }

    if (handle) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{2,29}$/.test(handle)) {
        throw new Error("Invalid handle format")
      }
      const exists = await redis.exists(`handle:${handle.toLowerCase()}`)
      if (exists) throw new Error("Handle already taken")
      await redis.set(`handle:${handle.toLowerCase()}`, `channel:${channelId}`)
    }

    const data: Record<string, unknown> = {
      connected: JSON.stringify([ownerToken]),
      name,
      description: description || "",
      handle: handle ? handle.toLowerCase() : "",
      capacity: MAX_CHANNEL_CAPACITY,
      createdAt: Date.now(),
      ownerToken,
    }

    await redis.hset(getMetaKey("channel", channelId), data)
    await admitMember("channel", channelId, ownerToken, MAX_CHANNEL_CAPACITY)

    if (ttl && ttl > 0) {
      await redis.expire(getMetaKey("channel", channelId), ttl)
      if (handle) await redis.expire(`handle:${handle.toLowerCase()}`, ttl)
    }

    return { channelId }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 64 }),
      description: t.Optional(t.String({ maxLength: 256 })),
      handle: t.Optional(t.String({ minLength: 3, maxLength: 30 })),
      ttl: t.Optional(t.Number({ minimum: 0, maximum: 604800 })),
    })
  })
  .use(channelCookieMiddleware)
  .get(
    "/info",
    async ({ channelAuth, set }) => {
      const meta = await redis.hgetall(getMetaKey("channel", channelAuth.channelId)) as Record<string, unknown> | null
      if (!meta) return { error: "Channel not found" }

      const capacity = Number(meta.capacity) || MAX_CHANNEL_CAPACITY
      const joinResult = await admitMember("channel", channelAuth.channelId, channelAuth.token, capacity)
      if (joinResult === "room-full") {
        set.status = 403
        throw new Error("Channel is full")
      }

      const connected = await requireActiveMember("channel", channelAuth.channelId, channelAuth.token)
      if (!connected) {
        set.status = 401
        throw new Error("Unable to join channel")
      }

      const ttl = await redis.ttl(getMetaKey("channel", channelAuth.channelId))

      return {
        name: meta.name as string,
        description: meta.description as string || "",
        handle: meta.handle as string || "",
        members: connected.length,
        ttl: ttl > 0 ? ttl : null,
        isAdmin: meta.ownerToken === channelAuth.token,
      }
    },
    { query: t.Object({ channelId: t.String({ maxLength: 64 }) }) }
  )
  .patch(
    "/",
    async ({ body, channelAuth, set }) => {
      const { name, description } = body
      const { channelId, token } = channelAuth

      const meta = await redis.hgetall(getMetaKey("channel", channelId))
      if (!meta) throw new Error("Channel not found")

      if (meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can update settings")
      }

      const updates: Record<string, string> = {}
      if (name) updates.name = name
      if (description !== undefined) updates.description = description

      await redis.hset(getMetaKey("channel", channelId), updates)
      
      return { success: true }
    },
    {
      query: t.Object({ channelId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
        description: t.Optional(t.String({ maxLength: 256 })),
      })
    }
  )
  .delete(
    "/",
    async ({ channelAuth, set }) => {
      const { channelId, token } = channelAuth
      const meta = await redis.hgetall(getMetaKey("channel", channelId)) as Record<string, unknown> | null
      if (meta && meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can delete the channel")
      }

      const handle = meta?.handle as string
      await Promise.all([
        redis.del(getMetaKey("channel", channelId)),
        redis.del(`messages:channel:${channelId}`),
        redis.del(`users:channel:${channelId}`),
        ...(handle ? [redis.del(`handle:${handle}`)] : []),
      ])
      return { success: true }
    },
    { query: t.Object({ channelId: t.String({ maxLength: 64 }) }) }
  )

const channelMessages = new Elysia({ prefix: "/channel-messages" })
  .use(rateLimitMiddleware)
  .use(channelMemberMiddleware)
  .post(
    "/",
    async ({ body, channelAuth, set }) => {
      const { sender, text, burnAfter } = body
      const { channelId, token } = channelAuth

      const meta = await redis.hgetall(getMetaKey("channel", channelId))
      if (!meta) throw new Error("Channel does not exist")

      if (meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only admins can post to this channel")
      }

      const userKey = `users:channel:${channelId}`
      let finalSender = normalizeSenderName(sender)

      const storedName = await redis.hget<string>(userKey, token)
      if (storedName) {
        finalSender = storedName
      } else {
        await redis.hset(userKey, { [token]: finalSender })
        const remaining = await redis.ttl(getMetaKey("channel", channelId))
        if (remaining > 0) await redis.expire(userKey, remaining)
      }

      const msgId = nanoid()
      const msg: Message = {
        id: msgId,
        sender: finalSender,
        text,
        timestamp: Date.now(),
        roomId: channelId,
      }

      const stored = burnAfter && burnAfter > 0
        ? { ...msg, token, burnAfter }
        : { ...msg, token }
      await redis.rpush(`messages:channel:${channelId}`, stored)
      await redis.ltrim(`messages:channel:${channelId}`, -MAX_CHANNEL_MESSAGES, -1)
      await realtime.channel(`ch:${channelId}`).emit("channel.message", msg)

      if (burnAfter && burnAfter > 0) {
        await redis.set(`burn:${channelId}:${msgId}`, "1", { ex: burnAfter })
      }

      const remaining = await redis.ttl(getMetaKey("channel", channelId))
      if (remaining > 0) {
        await redis.expire(`messages:channel:${channelId}`, remaining)
      }
    },
    {
      query: t.Object({ channelId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        sender: t.String({ maxLength: 100 }),
        text: t.String({ maxLength: 5000 }),
        burnAfter: t.Optional(t.Number({ minimum: 1, maximum: 300 })),
      }),
    }
  )
  .post(
    "/typing",
    async ({ body, channelAuth }) => {
      const { isTyping, username } = body
      const { channelId, token } = channelAuth

      const meta = await redis.hgetall(getMetaKey("channel", channelId))
      if (meta && meta.ownerToken !== token) {
        return
      }

      const storedName = await redis.hget<string>(`users:channel:${channelId}`, token)
      const finalUsername = storedName || normalizeSenderName(username)

      await realtime.channel(`ch:${channelId}`).emit("channel.typing", {
        roomId: channelId,
        token,
        username: finalUsername,
        isTyping,
        timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ channelId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        username: t.String({ maxLength: 100 }),
        isTyping: t.Boolean(),
      }),
    }
  )
  .get(
    "/",
    async ({ channelAuth }) => {
      const msgs = await redis.lrange<MessageWithMeta>(`messages:channel:${channelAuth.channelId}`, 0, -1)

      const expired: MessageWithMeta[] = []
      for (const m of msgs || []) {
        if (m.burnAfter && m.burnAfter > 0) {
          const alive = await redis.exists(`burn:${channelAuth.channelId}:${m.id}`)
          if (!alive) expired.push(m)
        }
      }

      for (const m of expired) {
        await redis.lrem(`messages:channel:${channelAuth.channelId}`, 1, m)
        await realtime.channel(`ch:${channelAuth.channelId}`).emit("channel.delete", {
          messageId: m.id,
          roomId: channelAuth.channelId,
          timestamp: Date.now(),
        })
      }

      const final = expired.length > 0
        ? await redis.lrange<MessageWithMeta>(`messages:channel:${channelAuth.channelId}`, 0, -1)
        : msgs

      const safeMessages = (final || []).map((m) => ({
        ...m,
        token: m.token === channelAuth.token ? channelAuth.token : undefined,
      }))

      return {
        messages: safeMessages,
        reactions: await buildReactions("channel", channelAuth.channelId, final || [], channelAuth.token),
      }
    },
    { query: t.Object({ channelId: t.String({ maxLength: 64 }) }) }
  )
  .post(
    "/react",
    async ({ body, channelAuth }) => {
      const { messageId, emoji, action } = body
      const key = `reactions:channel:${channelAuth.channelId}:${messageId}`
      const current = parseReactionTokens(await redis.hget<string | string[]>(key, emoji))

      if (action === "add" && !current.includes(channelAuth.token)) {
        await redis.hset(key, { [emoji]: JSON.stringify([...current, channelAuth.token]) })
      } else if (action === "remove") {
        const nextTokens = current.filter((token) => token !== channelAuth.token)
        if (nextTokens.length > 0) {
          await redis.hset(key, { [emoji]: JSON.stringify(nextTokens) })
        } else {
          await redis.hdel(key, emoji)
        }
      }

      const remaining = await redis.ttl(getMetaKey("channel", channelAuth.channelId))
      if (remaining > 0) await redis.expire(key, remaining)

      await realtime.channel(`ch:${channelAuth.channelId}`).emit("channel.react", {
        messageId,
        emoji,
        token: channelAuth.token,
        action,
        roomId: channelAuth.channelId,
        timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ channelId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        messageId: t.String({ maxLength: 64 }),
        emoji: t.String({ maxLength: 8 }),
        action: t.Union([t.Literal("add"), t.Literal("remove")]),
      }),
    }
  )
  .delete(
    "/",
    async ({ query, channelAuth, set }) => {
      const { messageId } = query
      const { channelId, token } = channelAuth

      const meta = await redis.hgetall(getMetaKey("channel", channelId))
      if (meta && meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only admins can delete messages")
      }

      const msgs = await redis.lrange<MessageWithMeta>(`messages:channel:${channelId}`, 0, -1)
      const target = msgs.find((m) => m.id === messageId)

      if (target) {
        await redis.lrem(`messages:channel:${channelId}`, 1, target)
        await realtime.channel(`ch:${channelId}`).emit("channel.delete", {
          messageId,
          roomId: channelId,
          timestamp: Date.now(),
        })
      }
    },
    {
      query: t.Object({
        channelId: t.String({ maxLength: 64 }),
        messageId: t.String({ maxLength: 64 }),
      })
    }
  )
  .delete(
    "/channel",
    async ({ channelAuth, set }) => {
      const { channelId, token } = channelAuth
      const meta = await redis.hgetall(getMetaKey("channel", channelId))
      if (meta && meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can delete the channel")
      }

      await Promise.all([
        redis.del(getMetaKey("channel", channelId)),
        redis.del(`messages:channel:${channelId}`),
        redis.del(`users:channel:${channelId}`),
      ])
      return { success: true }
    },
    { query: t.Object({ channelId: t.String({ maxLength: 64 }) }) }
  )


const HANDLE_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/
const MAX_GROUP_CAPACITY = 500
const MAX_GROUP_MESSAGES = 500

const groupCookieMiddleware = new Elysia({ name: "group-cookie-auth" })
  .error({ AuthError })
  .onError(({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401
      return { error: "Unauthorized" }
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const groupId = query.groupId
    const token = cookie[AUTH_COOKIE_NAME]?.value as string | undefined

    if (!groupId || !token) {
      throw new AuthError("Missing groupId or token.")
    }

    if (groupId.length > 64 || token.length > AUTH_TOKEN_MAX_LENGTH) {
      throw new AuthError("Invalid groupId or token format.")
    }

    return { groupAuth: { groupId, token } }
  })

const groupMemberMiddleware = new Elysia({ name: "group-member-auth" })
  .use(groupCookieMiddleware)
  .derive({ as: "scoped" }, async ({ groupAuth }) => {
    if (!groupAuth) {
      throw new AuthError("Missing group auth context")
    }

    const connected = await requireActiveMember("group", groupAuth.groupId, groupAuth.token)
    if (!connected) {
      throw new AuthError("Invalid token")
    }

    return { groupAuth: { ...groupAuth, connected } }
  })

const groups = new Elysia({ prefix: "/group" })
  .use(rateLimitMiddleware)
  .post("/create", async ({ body, cookie }) => {
    const { name, description, handle, ttl, capacity = 500 } = body
    const groupId = nanoid()

    let ownerToken = cookie[AUTH_COOKIE_NAME]?.value as string | undefined
    if (!ownerToken) {
      ownerToken = nanoid()
      cookie[AUTH_COOKIE_NAME].set({
        value: ownerToken,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
      })
    }

    if (handle) {
      if (!HANDLE_REGEX.test(handle)) {
        throw new Error("Invalid handle format. Use 3-30 chars: letters, digits, underscores. Must start with a letter.")
      }
      const exists = await redis.exists(`handle:${handle.toLowerCase()}`)
      if (exists) {
        throw new Error("Handle already taken")
      }
      await redis.set(`handle:${handle.toLowerCase()}`, `group:${groupId}`)
    }

    const data: Record<string, unknown> = {
      connected: JSON.stringify([ownerToken]),
      name,
      description: description || "",
      handle: handle ? handle.toLowerCase() : "",
      capacity: Math.min(capacity, MAX_GROUP_CAPACITY),
      createdAt: Date.now(),
      ownerToken,
    }

    await redis.hset(getMetaKey("group", groupId), data)
    await admitMember("group", groupId, ownerToken, Math.min(capacity, MAX_GROUP_CAPACITY))

    if (ttl && ttl > 0) {
      await redis.expire(getMetaKey("group", groupId), ttl)
      if (handle) await redis.expire(`handle:${handle.toLowerCase()}`, ttl)
    }

    return { groupId }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 64 }),
      description: t.Optional(t.String({ maxLength: 256 })),
      handle: t.Optional(t.String({ minLength: 3, maxLength: 30 })),
      ttl: t.Optional(t.Number({ minimum: 0, maximum: 604800 })),
      capacity: t.Optional(t.Number({ minimum: 2, maximum: 500 })),
    })
  })
  .use(groupCookieMiddleware)
  .get(
    "/info",
    async ({ groupAuth, set }) => {
      const meta = await redis.hgetall(getMetaKey("group", groupAuth.groupId)) as Record<string, unknown> | null
      if (!meta) return { error: "Group not found" }

      const capacity = Number(meta.capacity) || MAX_GROUP_CAPACITY
      const joinResult = await admitMember("group", groupAuth.groupId, groupAuth.token, capacity)
      if (joinResult === "room-full") {
        set.status = 403
        throw new Error("Group is full")
      }

      const connected = await requireActiveMember("group", groupAuth.groupId, groupAuth.token)
      if (!connected) {
        set.status = 401
        throw new Error("Unable to join group")
      }

      const ttl = await redis.ttl(getMetaKey("group", groupAuth.groupId))

      return {
        name: meta.name as string,
        description: meta.description as string || "",
        handle: meta.handle as string || "",
        members: connected.length,
        ttl: ttl > 0 ? ttl : null,
        isAdmin: meta.ownerToken === groupAuth.token,
      }
    },
    { query: t.Object({ groupId: t.String({ maxLength: 64 }) }) }
  )
  .patch(
    "/",
    async ({ body, groupAuth, set }) => {
      const { name, description } = body
      const { groupId, token } = groupAuth

      const meta = await redis.hgetall(getMetaKey("group", groupId))
      if (!meta) throw new Error("Group not found")

      if (meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can update settings")
      }

      const updates: Record<string, string> = {}
      if (name) updates.name = name
      if (description !== undefined) updates.description = description

      await redis.hset(getMetaKey("group", groupId), updates)
      return { success: true }
    },
    {
      query: t.Object({ groupId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
        description: t.Optional(t.String({ maxLength: 256 })),
      })
    }
  )
  .delete(
    "/",
    async ({ groupAuth, set }) => {
      const { groupId, token } = groupAuth
      const meta = await redis.hgetall(getMetaKey("group", groupId)) as Record<string, unknown> | null
      if (meta && meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can delete the group")
      }

      await realtime.channel(`grp:${groupId}`).emit("group.destroy", {
        isDestroyed: true,
        roomId: groupId,
        timestamp: Date.now(),
      })

      const handle = meta?.handle as string
      await Promise.all([
        redis.del(getMetaKey("group", groupId)),
        redis.del(`messages:group:${groupId}`),
        redis.del(`users:group:${groupId}`),
        ...(handle ? [redis.del(`handle:${handle}`)] : []),
      ])
      return { success: true }
    },
    { query: t.Object({ groupId: t.String({ maxLength: 64 }) }) }
  )

const groupMessages = new Elysia({ prefix: "/group-messages" })
  .use(rateLimitMiddleware)
  .use(groupMemberMiddleware)
  .post(
    "/",
    async ({ body, groupAuth }) => {
      const { sender, text, burnAfter } = body
      const { groupId, token } = groupAuth

      const meta = await redis.hgetall(getMetaKey("group", groupId))
      if (!meta) throw new Error("Group does not exist")

      const userKey = `users:group:${groupId}`
      let finalSender = normalizeSenderName(sender)

      const storedName = await redis.hget<string>(userKey, token)
      if (storedName) {
        finalSender = storedName
      } else {
        await redis.hset(userKey, { [token]: finalSender })
        const remaining = await redis.ttl(getMetaKey("group", groupId))
        if (remaining > 0) await redis.expire(userKey, remaining)
      }

      const msgId = nanoid()
      const msg: Message = {
        id: msgId,
        sender: finalSender,
        text,
        timestamp: Date.now(),
        roomId: groupId,
      }

      const stored = burnAfter && burnAfter > 0
        ? { ...msg, token, burnAfter }
        : { ...msg, token }
      await redis.rpush(`messages:group:${groupId}`, stored)
      await redis.ltrim(`messages:group:${groupId}`, -MAX_GROUP_MESSAGES, -1)
      await realtime.channel(`grp:${groupId}`).emit("group.message", msg)

      if (burnAfter && burnAfter > 0) {
        await redis.set(`burn:${groupId}:${msgId}`, "1", { ex: burnAfter })
      }

      const remaining = await redis.ttl(getMetaKey("group", groupId))
      if (remaining > 0) {
        await redis.expire(`messages:group:${groupId}`, remaining)
      }
    },
    {
      query: t.Object({ groupId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        sender: t.String({ maxLength: 100 }),
        text: t.String({ maxLength: 5000 }),
        burnAfter: t.Optional(t.Number({ minimum: 1, maximum: 300 })),
      }),
    }
  )
  .post(
    "/typing",
    async ({ body, groupAuth }) => {
      const { isTyping, username } = body
      const { groupId, token } = groupAuth

      const storedName = await redis.hget<string>(`users:group:${groupId}`, token)
      const finalUsername = storedName || normalizeSenderName(username)

      await realtime.channel(`grp:${groupId}`).emit("group.typing", {
        roomId: groupId,
        token,
        username: finalUsername,
        isTyping,
        timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ groupId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        username: t.String({ maxLength: 100 }),
        isTyping: t.Boolean(),
      }),
    }
  )
  .get(
    "/",
    async ({ groupAuth }) => {
      const msgs = await redis.lrange<MessageWithMeta>(`messages:group:${groupAuth.groupId}`, 0, -1)

      const expired: MessageWithMeta[] = []
      for (const m of msgs || []) {
        if (m.burnAfter && m.burnAfter > 0) {
          const alive = await redis.exists(`burn:${groupAuth.groupId}:${m.id}`)
          if (!alive) expired.push(m)
        }
      }

      for (const m of expired) {
        await redis.lrem(`messages:group:${groupAuth.groupId}`, 1, m)
        await realtime.channel(`grp:${groupAuth.groupId}`).emit("group.delete", {
          messageId: m.id,
          roomId: groupAuth.groupId,
          timestamp: Date.now(),
        })
      }

      const final = expired.length > 0
        ? await redis.lrange<MessageWithMeta>(`messages:group:${groupAuth.groupId}`, 0, -1)
        : msgs

      const safeMessages = (final || []).map((m) => ({
        ...m,
        token: m.token === groupAuth.token ? groupAuth.token : undefined,
      }))

      return {
        messages: safeMessages,
        reactions: await buildReactions("group", groupAuth.groupId, final || [], groupAuth.token),
      }
    },
    { query: t.Object({ groupId: t.String({ maxLength: 64 }) }) }
  )
  .post(
    "/react",
    async ({ body, groupAuth }) => {
      const { messageId, emoji, action } = body
      const key = `reactions:group:${groupAuth.groupId}:${messageId}`
      const current = parseReactionTokens(await redis.hget<string | string[]>(key, emoji))

      if (action === "add" && !current.includes(groupAuth.token)) {
        await redis.hset(key, { [emoji]: JSON.stringify([...current, groupAuth.token]) })
      } else if (action === "remove") {
        const nextTokens = current.filter((token) => token !== groupAuth.token)
        if (nextTokens.length > 0) {
          await redis.hset(key, { [emoji]: JSON.stringify(nextTokens) })
        } else {
          await redis.hdel(key, emoji)
        }
      }

      const remaining = await redis.ttl(getMetaKey("group", groupAuth.groupId))
      if (remaining > 0) await redis.expire(key, remaining)

      await realtime.channel(`grp:${groupAuth.groupId}`).emit("group.react", {
        messageId,
        emoji,
        token: groupAuth.token,
        action,
        roomId: groupAuth.groupId,
        timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ groupId: t.String({ maxLength: 64 }) }),
      body: t.Object({
        messageId: t.String({ maxLength: 64 }),
        emoji: t.String({ maxLength: 8 }),
        action: t.Union([t.Literal("add"), t.Literal("remove")]),
      }),
    }
  )
  .delete(
    "/",
    async ({ query, groupAuth, set }) => {
      const { messageId } = query
      const { groupId, token } = groupAuth

      const msgs = await redis.lrange<MessageWithMeta>(`messages:group:${groupId}`, 0, -1)
      const target = msgs.find((m) => m.id === messageId)

      if (target) {
        const meta = await redis.hgetall(getMetaKey("group", groupId)) as Record<string, unknown> | null
        const isAdmin = meta?.ownerToken === token
        const isAuthor = target.token === token
        if (!isAdmin && !isAuthor) {
          set.status = 403
          throw new Error("Only author or admin can delete messages")
        }
        await redis.lrem(`messages:group:${groupId}`, 1, target)
        await realtime.channel(`grp:${groupId}`).emit("group.delete", {
          messageId,
          roomId: groupId,
          timestamp: Date.now(),
        })
      }
    },
    {
      query: t.Object({
        groupId: t.String({ maxLength: 64 }),
        messageId: t.String({ maxLength: 64 }),
      })
    }
  )


const handles = new Elysia({ prefix: "/handle" })
  .use(rateLimitMiddleware)
  .get(
    "/resolve",
    async ({ query }) => {
      const { handle } = query
      const val = await redis.get<string>(`handle:${handle.toLowerCase()}`)
      if (!val) return { error: "Handle not found" }

      const [type, id] = val.split(":")
      if (type === "group") {
        const meta = await redis.hgetall(getMetaKey("group", id)) as Record<string, unknown> | null
        if (!meta) return { error: "Group not found" }
        const connected = await readActiveConnected("group", id)
        return { type: "group", id, name: meta.name as string, description: (meta.description as string) || "", members: connected.length }
      }
      if (type === "channel") {
        const meta = await redis.hgetall(getMetaKey("channel", id)) as Record<string, unknown> | null
        if (!meta) return { error: "Channel not found" }
        const connected = await readActiveConnected("channel", id)
        return { type: "channel", id, name: meta.name as string, description: (meta.description as string) || "", members: connected.length }
      }
      return { error: "Unknown handle type" }
    },
    { query: t.Object({ handle: t.String({ minLength: 1, maxLength: 30 }) }) }
  )

const app = new Elysia({ prefix: "/api" })
  .onError(({ code, error, set }) => {
    console.error(`API Error (${code}):`, error)
    const explicitStatus = Number(set.status) || 0

    if (code === "VALIDATION") {
      set.status = 400
      return { error: "Invalid request" }
    }

    if (explicitStatus >= 400 && explicitStatus < 500) {
      return { error: error instanceof Error ? error.message : "Request failed" }
    }

    set.status = 500
    return { error: "Internal Server Error" }
  })
  .use(rooms)
  .use(messages)
  .use(channels)
  .use(channelMessages)
  .use(groups)
  .use(groupMessages)
  .use(handles)

export const GET = (req: Request) => app.handle(req)
export const POST = (req: Request) => app.handle(req)
export const PATCH = (req: Request) => app.handle(req)
export const DELETE = (req: Request) => app.handle(req)

export type App = typeof app
