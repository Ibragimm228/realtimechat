import Elysia from "elysia"
import {
  AUTH_COOKIE_NAME,
  requireActiveMember,
} from "@/lib/membership"

export class AuthError extends Error {
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
    const token = cookie[AUTH_COOKIE_NAME]?.value as string | undefined

    if (!roomId || !token) {
      throw new AuthError("Missing roomId or token.")
    }

    if (roomId.length > 64 || token.length > 128) {
      throw new AuthError("Invalid roomId or token format.")
    }

    const connected = await requireActiveMember("room", roomId, token)

    if (!connected) {
      throw new AuthError("Invalid token")
    }

    return { auth: { roomId, token, connected } }
  })
