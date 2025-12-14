import { redis } from "@/lib/redis"
import { Elysia, t } from "elysia"
import { nanoid } from "nanoid"
import { authMiddleware } from "./auth"
import { z } from "zod"
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
    const { success } = await ratelimit.limit(ip)
    if (!success) {
      set.status = 429
      throw new Error("Rate limit exceeded")
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
    { query: z.object({ roomId: z.string() }) }
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
      ])
    },
    { query: z.object({ roomId: z.string() }) }
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

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      }

      await redis.rpush(`messages:${roomId}`, { ...message, token: auth.token })
      await realtime.channel(roomId).emit("chat.message", message)

      const remaining = await redis.ttl(`meta:${roomId}`)

      await redis.expire(`messages:${roomId}`, remaining)
      await redis.expire(`history:${roomId}`, remaining)
      await redis.expire(roomId, remaining)
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100),
        text: z.string().max(5000),
      }),
    }
  )
  .post(
    "/typing",
    async ({ body, auth }) => {
      const { isTyping, username } = body
      await realtime.channel(auth.roomId).emit("chat.typing", {
        roomId: auth.roomId,
        token: auth.token,
        username,
        isTyping,
        timestamp: Date.now(),
      })
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        username: z.string(),
        isTyping: z.boolean(),
      }),
    }
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)

      return {
        messages: messages.map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      }
    },
    { query: z.object({ roomId: z.string() }) }
  )

const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages)

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch

export type App = typeof app
