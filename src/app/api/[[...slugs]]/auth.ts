import { redis } from "@/lib/redis"
import Elysia from "elysia"

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthError"
  }
}

export const authMiddleware = new Elysia({ name: "auth" })
  .error({ AuthError })
  .onError(({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401
      return { error: "Unauthorized" }
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const roomId = query.roomId
    const token = cookie["x-auth-token"].value as string | undefined

    if (!roomId || !token) {
      throw new AuthError("Missing roomId or token.")
    }

    if (roomId.length > 50 || token.length > 100) {
      throw new AuthError("Invalid roomId or token format.")
    }

    const rawConnected = await redis.hget<string | string[]>(`meta:${roomId}`, "connected")
    
    let connected: string[] = []
    if (typeof rawConnected === "string") {
      try {
        connected = JSON.parse(rawConnected)
      } catch (e) {
        console.error("Failed to parse connected users:", e)
        connected = []
      }
    } else if (Array.isArray(rawConnected)) {
      connected = rawConnected
    } else {
      connected = []
    }

    if (!connected.includes(token)) {
      throw new AuthError("Invalid token")
    }

    return { auth: { roomId, token, connected } }
  })
