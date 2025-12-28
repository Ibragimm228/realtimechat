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
    const { ttl = 600, capacity = 2 } = body
    const roomId = nanoid()

    await redis.hset(`meta:${roomId}`, {
      connected: JSON.stringify([]),
      capacity,
      createdAt: Date.now(),
    })

    await redis.expire(`meta:${roomId}`, ttl)

    return { roomId }
  }, {
    body: t.Object({
      ttl: t.Optional(t.Number()),
      capacity: t.Optional(t.Number())
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
        roomId: t.String() 
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
        roomId: t.String() 
      }) 
    }
  )

const messages = new Elysia({ prefix: "/messages" })
  .use(rateLimitMiddleware)
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const { sender, text } = body
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

      const message: Message = {
        id: nanoid(),
        sender: finalSender,
        text,
        timestamp: Date.now(),
        roomId,
      }

      await redis.rpush(`messages:${roomId}`, { ...message, token: auth.token })
      await realtime.channel(roomId).emit("chat.message", message)

      const remaining = await redis.ttl(`meta:${roomId}`)

      if (remaining > 0) {
        await redis.expire(`messages:${roomId}`, remaining)
        await redis.expire(`history:${roomId}`, remaining)
        await redis.expire(roomId, remaining)
      }
    },
    {
      query: t.Object({ 
        roomId: t.String() 
      }),
      body: t.Object({
        sender: t.String({ maxLength: 100 }),
        text: t.String({ maxLength: 5000 }),
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
        roomId: t.String() 
      }),
      body: t.Object({
        username: t.String(),
        isTyping: t.Boolean(),
      }),
    }
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)

      return {
        messages: (messages || []).map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      }
    },
    { 
      query: t.Object({ 
        roomId: t.String() 
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
        roomId: t.String(),
        messageId: t.String(),
      })
    }
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

export const GET = (req: Request) => app.handle(req)
export const POST = (req: Request) => app.handle(req)
export const DELETE = (req: Request) => app.handle(req)

export type App = typeof app
