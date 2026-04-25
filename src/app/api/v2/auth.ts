import Elysia from "elysia"

import { authenticateDevice } from "@/lib/v2/server-store"

export class V2AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "V2AuthError"
  }
}

export const v2AuthMiddleware = new Elysia({ name: "v2-auth" })
  .error({ V2AuthError })
  .onError(({ code, set }) => {
    if (code === "V2AuthError") {
      set.status = 401
      return { error: "Unauthorized device" }
    }
  })
  .derive({ as: "scoped" }, async ({ headers }) => {
    const userId = headers["x-v2-user-id"]
    const deviceIdRaw = headers["x-v2-device-id"]
    const authToken = headers["x-v2-device-token"]

    if (!userId || !deviceIdRaw || !authToken) {
      throw new V2AuthError("Missing v2 auth headers")
    }

    const deviceId = Number.parseInt(String(deviceIdRaw), 10)
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      throw new V2AuthError("Invalid device id")
    }

    const device = await authenticateDevice(String(userId), deviceId, String(authToken))
    if (!device) {
      throw new V2AuthError("Invalid device token")
    }

    return {
      v2Auth: {
        userId: String(userId),
        deviceId,
        device,
      },
    }
  })
