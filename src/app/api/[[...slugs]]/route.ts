import { redis } from "@/lib/redis"
import { Elysia, t } from "elysia"
import { nanoid } from "nanoid"
import { authMiddleware } from "./auth"
import { Message, realtime } from "@/lib/realtime"
import { Ratelimit } from "@upstash/ratelimit"

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
})

const MAX_TTL = 86400 // 24 hours
const MIN_TTL = 60    // 1 minute
const MAX_CAPACITY = 50
const MIN_CAPACITY = 2
const MAX_MESSAGES = 200

const rateLimitMiddleware = new Elysia({ name: "ratelimit" })
  .derive(async ({ request, set }) => {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1"
    try {
      const { success } = await ratelimit.limit(ip)
      if (!success) {
        set.status = 429
        throw new Error("Rate limit exceeded")
      }
    } catch (e) {
      console.error("Ratelimit error:", e)
    }
  })

const rooms = new Elysia({ prefix: "/room" })
  .use(rateLimitMiddleware)
  .post("/create", async ({ body }) => {
    const { ttl = 600, capacity = 2, inactivityTtl } = body
    const roomId = nanoid()

    await redis.hset(`meta:${roomId}`, {
      connected: JSON.stringify([]),
      capacity,
      createdAt: Date.now(),
      ...(inactivityTtl ? { inactivityTtl } : {}),
    })

    await redis.expire(`meta:${roomId}`, ttl)

    if (inactivityTtl) {
      await redis.set(`activity:${roomId}`, "1", { ex: inactivityTtl * 60 })
    }

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
      inactivityTtl: t.Optional(t.Number({ minimum: 1, maximum: 1440 })),
    })
  })
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`)
      return { ttl: ttl > 0 ? ttl : 0 }
    },
    { 
      query: t.Object({ 
        roomId: t.String({ maxLength: 50 }) 
      }) 
    }
  )
  .delete(
    "/",
    async ({ auth }) => {
      await realtime.channel(auth.roomId).emit("chat.destroy", { 
        isDestroyed: true, 
        roomId: auth.roomId, 
        timestamp: Date.now() 
      })

      await Promise.all([
        redis.del(auth.roomId),
        redis.del(`meta:${auth.roomId}`),
        redis.del(`messages:${auth.roomId}`),
        redis.del(`history:${auth.roomId}`),
        redis.del(`users:${auth.roomId}`),
      ])
    },
    { 
      query: t.Object({ 
        roomId: t.String({ maxLength: 50 }) 
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

      const roomExists = await redis.exists(`meta:${roomId}`)

      if (!roomExists) {
        throw new Error("Room does not exist")
      }

      const userKey = `users:${roomId}`
      let finalSender = sender
      
      const storedName = await redis.hget<string>(userKey, auth.token)
      if (storedName) {
        finalSender = storedName
      } else {
        await redis.hset(userKey, { [auth.token]: sender })
        const remaining = await redis.ttl(`meta:${roomId}`)
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

      const remaining = await redis.ttl(`meta:${roomId}`)

      if (remaining > 0) {
        await redis.expire(`messages:${roomId}`, remaining)
        await redis.expire(`history:${roomId}`, remaining)
        await redis.expire(roomId, remaining)
      }

      const meta = await redis.hgetall(`meta:${roomId}`) as Record<string, unknown> | null
      if (meta?.inactivityTtl) {
        await redis.set(`activity:${roomId}`, "1", { ex: Number(meta.inactivityTtl) * 60 })
      }
    },
    {
      query: t.Object({ 
        roomId: t.String({ maxLength: 50 }) 
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
        roomId: t.String({ maxLength: 50 }) 
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
      const allMessages = await redis.lrange<Message & { burnAfter?: number }>(`messages:${auth.roomId}`, 0, -1)

      const expired: Message[] = []
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
        const freshMessages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)
        return {
          messages: (freshMessages || []).map((m) => ({
            ...m,
            token: m.token === auth.token ? auth.token : undefined,
          })),
        }
      }

      return {
        messages: (allMessages || []).map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      }
    },
    { 
      query: t.Object({ 
        roomId: t.String({ maxLength: 50 }) 
      }) 
    }
  )
  .delete(
    "/",
    async ({ query, auth }) => {
      const { messageId } = query
      const messages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)
      const messageIndex = messages.findIndex((m) => m.id === messageId)

      if (messageIndex !== -1) {
        const messageToDelete = messages[messageIndex]
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
        roomId: t.String({ maxLength: 50 }),
        messageId: t.String({ maxLength: 50 }),
      })
    }
  )
  .post(
    "/pin",
    async ({ body, auth }) => {
      const { messageId, action } = body
      const pinKey = `pinned:${auth.roomId}`

      if (action === "pin") {
        const msgs = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)
        const target = msgs.find((m) => m.id === messageId)
        if (!target) throw new Error("Message not found")

        const storedName = await redis.hget<string>(`users:${auth.roomId}`, auth.token)
        const pinnedBy = storedName || "Unknown"

        await redis.hset(pinKey, { [messageId]: JSON.stringify({ sender: target.sender, text: target.text, pinnedBy, timestamp: Date.now() }) })
        const remaining = await redis.ttl(`meta:${auth.roomId}`)
        if (remaining > 0) await redis.expire(pinKey, remaining)

        await realtime.channel(auth.roomId).emit("chat.pin", {
          messageId, sender: target.sender, text: target.text,
          action: "pin", pinnedBy, roomId: auth.roomId, timestamp: Date.now(),
        })
      } else {
        await redis.hdel(pinKey, messageId)

        await realtime.channel(auth.roomId).emit("chat.pin", {
          messageId, sender: "", text: "",
          action: "unpin", pinnedBy: "", roomId: auth.roomId, timestamp: Date.now(),
        })
      }
    },
    {
      query: t.Object({ roomId: t.String({ maxLength: 50 }) }),
      body: t.Object({
        messageId: t.String({ maxLength: 50 }),
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
    { query: t.Object({ roomId: t.String({ maxLength: 50 }) }) }
  )
  .post(
    "/react",
    async ({ body, auth }) => {
      const { messageId, emoji, action } = body
      const key = `reactions:room:${auth.roomId}:${messageId}`
      const current = await redis.hget<string[]>(key, emoji) || []

      if (action === "add" && !current.includes(auth.token)) {
        await redis.hset(key, { [emoji]: JSON.stringify([...current, auth.token]) })
      } else if (action === "remove") {
        await redis.hset(key, { [emoji]: JSON.stringify(current.filter((t: string) => t !== auth.token)) })
      }

      const remaining = await redis.ttl(`meta:${auth.roomId}`)
      if (remaining > 0) await redis.expire(key, remaining)

      await realtime.channel(auth.roomId).emit("chat.react", {
        messageId, emoji, token: auth.token, action,
        roomId: auth.roomId, timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ roomId: t.String({ maxLength: 50 }) }),
      body: t.Object({
        messageId: t.String({ maxLength: 50 }),
        emoji: t.String({ maxLength: 8 }),
        action: t.Union([t.Literal("add"), t.Literal("remove")]),
      }),
    }
  )

const channelAuthMiddleware = new Elysia({ name: "channel-auth" })
  .error({ AuthError: class extends Error { constructor(m: string) { super(m); this.name = "AuthError" } } })
  .onError(({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401
      return { error: "Unauthorized" }
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const channelId = query.channelId
    const token = cookie["x-auth-token"].value as string | undefined

    if (!channelId || !token) {
      throw new Error("Missing channelId or token.")
    }

    return { channelAuth: { channelId, token } }
  })

const MAX_CHANNEL_CAPACITY = 1000
const MAX_CHANNEL_MESSAGES = 500

const channels = new Elysia({ prefix: "/channel" })
  .use(rateLimitMiddleware)
  .post("/create", async ({ body, cookie }) => {
    const { name, ttl, description, handle } = body
    const channelId = nanoid()

    let ownerToken = cookie["x-auth-token"].value as string | undefined
    if (!ownerToken) {
      ownerToken = nanoid()
      cookie["x-auth-token"].set({
        value: ownerToken,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 86400,
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

    await redis.hset(`meta:channel:${channelId}`, data)

    if (ttl && ttl > 0) {
      await redis.expire(`meta:channel:${channelId}`, ttl)
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
  .use(channelAuthMiddleware)
  .get(
    "/info",
    async ({ channelAuth }) => {
      const meta = await redis.hgetall(`meta:channel:${channelAuth.channelId}`) as Record<string, unknown> | null
      if (!meta) return { error: "Channel not found" }

      let connected: string[] = []
      if (typeof meta.connected === "string") {
        try { connected = JSON.parse(meta.connected) } catch { connected = [] }
      } else if (Array.isArray(meta.connected)) {
        connected = meta.connected
      }

      if (!connected.includes(channelAuth.token)) {
        connected.push(channelAuth.token)
        await redis.hset(`meta:channel:${channelAuth.channelId}`, { connected: JSON.stringify(connected) })
      }

      const ttl = await redis.ttl(`meta:channel:${channelAuth.channelId}`)

      return {
        name: meta.name as string,
        description: meta.description as string || "",
        handle: meta.handle as string || "",
        members: connected.length,
        ttl: ttl > 0 ? ttl : null,
        isAdmin: meta.ownerToken === channelAuth.token,
      }
    },
    { query: t.Object({ channelId: t.String({ maxLength: 50 }) }) }
  )
  .patch(
    "/",
    async ({ body, channelAuth, set }) => {
      const { name, description } = body
      const { channelId, token } = channelAuth

      const meta = await redis.hgetall(`meta:channel:${channelId}`)
      if (!meta) throw new Error("Channel not found")

      if (meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can update settings")
      }

      const updates: Record<string, string> = {}
      if (name) updates.name = name
      if (description !== undefined) updates.description = description

      await redis.hset(`meta:channel:${channelId}`, updates)
      
      return { success: true }
    },
    {
      query: t.Object({ channelId: t.String({ maxLength: 50 }) }),
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
      const meta = await redis.hgetall(`meta:channel:${channelId}`) as Record<string, unknown> | null
      if (meta && meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can delete the channel")
      }

      const handle = meta?.handle as string
      await Promise.all([
        redis.del(`meta:channel:${channelId}`),
        redis.del(`messages:channel:${channelId}`),
        redis.del(`users:channel:${channelId}`),
        ...(handle ? [redis.del(`handle:${handle}`)] : []),
      ])
      return { success: true }
    },
    { query: t.Object({ channelId: t.String({ maxLength: 50 }) }) }
  )

const channelMessages = new Elysia({ prefix: "/channel-messages" })
  .use(rateLimitMiddleware)
  .use(channelAuthMiddleware)
  .post(
    "/",
    async ({ body, channelAuth, set }) => {
      const { sender, text, burnAfter } = body
      const { channelId, token } = channelAuth

      const meta = await redis.hgetall(`meta:channel:${channelId}`)
      if (!meta) throw new Error("Channel does not exist")

      if (meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only admins can post to this channel")
      }

      const userKey = `users:channel:${channelId}`
      let finalSender = sender

      const storedName = await redis.hget<string>(userKey, token)
      if (storedName) {
        finalSender = storedName
      } else {
        await redis.hset(userKey, { [token]: sender })
        const remaining = await redis.ttl(`meta:channel:${channelId}`)
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

      const remaining = await redis.ttl(`meta:channel:${channelId}`)
      if (remaining > 0) {
        await redis.expire(`messages:channel:${channelId}`, remaining)
      }
    },
    {
      query: t.Object({ channelId: t.String({ maxLength: 50 }) }),
      body: t.Object({
        sender: t.String({ maxLength: 100 }),
        text: t.String({ maxLength: 5000 }),
        burnAfter: t.Optional(t.Number({ minimum: 1, maximum: 300 })),
      }),
    }
  )
  .post(
    "/typing",
    async ({ body, channelAuth, set }) => {
      const { isTyping, username } = body
      const { channelId, token } = channelAuth

      const meta = await redis.hgetall(`meta:channel:${channelId}`)
      if (meta && meta.ownerToken !== token) {
        return
      }

      const storedName = await redis.hget<string>(`users:channel:${channelId}`, token)
      const finalUsername = storedName || username

      await realtime.channel(`ch:${channelId}`).emit("channel.typing", {
        roomId: channelId,
        token,
        username: finalUsername,
        isTyping,
        timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ channelId: t.String({ maxLength: 50 }) }),
      body: t.Object({
        username: t.String({ maxLength: 100 }),
        isTyping: t.Boolean(),
      }),
    }
  )
  .get(
    "/",
    async ({ channelAuth }) => {
      const msgs = await redis.lrange<Message & { burnAfter?: number }>(`messages:channel:${channelAuth.channelId}`, 0, -1)

      const expired: Message[] = []
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
        ? await redis.lrange<Message>(`messages:channel:${channelAuth.channelId}`, 0, -1)
        : msgs

      return {
        messages: (final || []).map((m) => ({
          ...m,
          token: m.token === channelAuth.token ? channelAuth.token : undefined,
        })),
      }
    },
    { query: t.Object({ channelId: t.String({ maxLength: 50 }) }) }
  )
  .delete(
    "/",
    async ({ query, channelAuth, set }) => {
      const { messageId } = query
      const { channelId, token } = channelAuth

      const meta = await redis.hgetall(`meta:channel:${channelId}`)
      if (meta && meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only admins can delete messages")
      }

      const msgs = await redis.lrange<Message>(`messages:channel:${channelId}`, 0, -1)
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
        channelId: t.String({ maxLength: 50 }),
        messageId: t.String({ maxLength: 50 }),
      })
    }
  )
  .delete(
    "/channel",
    async ({ query, channelAuth, set }) => {
      const { channelId, token } = channelAuth
      const meta = await redis.hgetall(`meta:channel:${channelId}`)
      if (meta && meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can delete the channel")
      }

      await Promise.all([
        redis.del(`meta:channel:${channelId}`),
        redis.del(`messages:channel:${channelId}`),
        redis.del(`users:channel:${channelId}`),
      ])
      return { success: true }
    },
    { query: t.Object({ channelId: t.String({ maxLength: 50 }) }) }
  )


const HANDLE_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/
const MAX_GROUP_CAPACITY = 500
const MAX_GROUP_MESSAGES = 500

const groupAuthMiddleware = new Elysia({ name: "group-auth" })
  .error({ AuthError: class extends Error { constructor(m: string) { super(m); this.name = "AuthError" } } })
  .onError(({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401
      return { error: "Unauthorized" }
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const groupId = query.groupId
    const token = cookie["x-auth-token"].value as string | undefined

    if (!groupId || !token) {
      throw new Error("Missing groupId or token.")
    }

    return { groupAuth: { groupId, token } }
  })

const groups = new Elysia({ prefix: "/group" })
  .use(rateLimitMiddleware)
  .post("/create", async ({ body, cookie }) => {
    const { name, description, handle, ttl, capacity = 500 } = body
    const groupId = nanoid()

    let ownerToken = cookie["x-auth-token"].value as string | undefined
    if (!ownerToken) {
      ownerToken = nanoid()
      cookie["x-auth-token"].set({
        value: ownerToken,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 86400,
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

    await redis.hset(`meta:group:${groupId}`, data)

    if (ttl && ttl > 0) {
      await redis.expire(`meta:group:${groupId}`, ttl)
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
  .use(groupAuthMiddleware)
  .get(
    "/info",
    async ({ groupAuth }) => {
      const meta = await redis.hgetall(`meta:group:${groupAuth.groupId}`) as Record<string, unknown> | null
      if (!meta) return { error: "Group not found" }

      let connected: string[] = []
      if (typeof meta.connected === "string") {
        try { connected = JSON.parse(meta.connected) } catch { connected = [] }
      } else if (Array.isArray(meta.connected)) {
        connected = meta.connected
      }

      if (!connected.includes(groupAuth.token)) {
        connected.push(groupAuth.token)
        await redis.hset(`meta:group:${groupAuth.groupId}`, { connected: JSON.stringify(connected) })
      }

      const ttl = await redis.ttl(`meta:group:${groupAuth.groupId}`)

      return {
        name: meta.name as string,
        description: meta.description as string || "",
        handle: meta.handle as string || "",
        members: connected.length,
        ttl: ttl > 0 ? ttl : null,
        isAdmin: meta.ownerToken === groupAuth.token,
      }
    },
    { query: t.Object({ groupId: t.String({ maxLength: 50 }) }) }
  )
  .patch(
    "/",
    async ({ body, groupAuth, set }) => {
      const { name, description } = body
      const { groupId, token } = groupAuth

      const meta = await redis.hgetall(`meta:group:${groupId}`)
      if (!meta) throw new Error("Group not found")

      if (meta.ownerToken !== token) {
        set.status = 403
        throw new Error("Only owner can update settings")
      }

      const updates: Record<string, string> = {}
      if (name) updates.name = name
      if (description !== undefined) updates.description = description

      await redis.hset(`meta:group:${groupId}`, updates)
      return { success: true }
    },
    {
      query: t.Object({ groupId: t.String({ maxLength: 50 }) }),
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
      const meta = await redis.hgetall(`meta:group:${groupId}`) as Record<string, unknown> | null
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
        redis.del(`meta:group:${groupId}`),
        redis.del(`messages:group:${groupId}`),
        redis.del(`users:group:${groupId}`),
        ...(handle ? [redis.del(`handle:${handle}`)] : []),
      ])
      return { success: true }
    },
    { query: t.Object({ groupId: t.String({ maxLength: 50 }) }) }
  )

const groupMessages = new Elysia({ prefix: "/group-messages" })
  .use(rateLimitMiddleware)
  .use(groupAuthMiddleware)
  .post(
    "/",
    async ({ body, groupAuth }) => {
      const { sender, text, burnAfter } = body
      const { groupId, token } = groupAuth

      const meta = await redis.hgetall(`meta:group:${groupId}`)
      if (!meta) throw new Error("Group does not exist")

      const userKey = `users:group:${groupId}`
      let finalSender = sender

      const storedName = await redis.hget<string>(userKey, token)
      if (storedName) {
        finalSender = storedName
      } else {
        await redis.hset(userKey, { [token]: sender })
        const remaining = await redis.ttl(`meta:group:${groupId}`)
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

      const remaining = await redis.ttl(`meta:group:${groupId}`)
      if (remaining > 0) {
        await redis.expire(`messages:group:${groupId}`, remaining)
      }
    },
    {
      query: t.Object({ groupId: t.String({ maxLength: 50 }) }),
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
      const finalUsername = storedName || username

      await realtime.channel(`grp:${groupId}`).emit("group.typing", {
        roomId: groupId,
        token,
        username: finalUsername,
        isTyping,
        timestamp: Date.now(),
      })
    },
    {
      query: t.Object({ groupId: t.String({ maxLength: 50 }) }),
      body: t.Object({
        username: t.String({ maxLength: 100 }),
        isTyping: t.Boolean(),
      }),
    }
  )
  .get(
    "/",
    async ({ groupAuth }) => {
      const msgs = await redis.lrange<Message & { burnAfter?: number }>(`messages:group:${groupAuth.groupId}`, 0, -1)

      const expired: Message[] = []
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
        ? await redis.lrange<Message>(`messages:group:${groupAuth.groupId}`, 0, -1)
        : msgs

      return {
        messages: (final || []).map((m) => ({
          ...m,
          token: m.token === groupAuth.token ? groupAuth.token : undefined,
        })),
      }
    },
    { query: t.Object({ groupId: t.String({ maxLength: 50 }) }) }
  )
  .delete(
    "/",
    async ({ query, groupAuth, set }) => {
      const { messageId } = query
      const { groupId, token } = groupAuth

      const msgs = await redis.lrange<Message>(`messages:group:${groupId}`, 0, -1)
      const target = msgs.find((m) => m.id === messageId)

      if (target) {
        const meta = await redis.hgetall(`meta:group:${groupId}`) as Record<string, unknown> | null
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
        groupId: t.String({ maxLength: 50 }),
        messageId: t.String({ maxLength: 50 }),
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
        const meta = await redis.hgetall(`meta:group:${id}`) as Record<string, unknown> | null
        if (!meta) return { error: "Group not found" }
        let connected: string[] = []
        try { connected = JSON.parse(meta.connected as string) } catch { connected = [] }
        return { type: "group", id, name: meta.name as string, description: (meta.description as string) || "", members: connected.length }
      }
      if (type === "channel") {
        const meta = await redis.hgetall(`meta:channel:${id}`) as Record<string, unknown> | null
        if (!meta) return { error: "Channel not found" }
        let connected: string[] = []
        try { connected = JSON.parse(meta.connected as string) } catch { connected = [] }
        return { type: "channel", id, name: meta.name as string, description: (meta.description as string) || "", members: connected.length }
      }
      return { error: "Unknown handle type" }
    },
    { query: t.Object({ handle: t.String({ minLength: 1, maxLength: 30 }) }) }
  )

const app = new Elysia({ prefix: "/api" })
  .onError(({ code, error, set }) => {
    console.error(`API Error (${code}):`, error)
    set.status = 500
    const message = error instanceof Error 
      ? error.message 
      : (error && typeof error === "object" && "message" in error)
        ? (error as any).message
        : String(error)
    return { error: "Internal Server Error", message }
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
