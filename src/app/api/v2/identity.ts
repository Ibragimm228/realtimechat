import { Elysia, t } from "elysia"

import { v2AuthMiddleware } from "./auth"
import {
  bootstrapV2Identity,
  createLinkToken,
  getMe,
  getPublicDevices,
  claimPreKeyBundles,
  refreshDevicePrekeys,
  revokeDevice,
} from "@/lib/v2/server-store"

const publicBundleSchema = t.Object({
  registrationId: t.Number({ minimum: 1, maximum: 2147483647 }),
  identityKey: t.String({ minLength: 16, maxLength: 4096 }),
  signedPreKey: t.Object({
    id: t.Number({ minimum: 1, maximum: 2147483647 }),
    publicKey: t.String({ minLength: 16, maxLength: 4096 }),
    signature: t.String({ minLength: 16, maxLength: 4096 }),
  }),
  kyberPreKey: t.Object({
    id: t.Number({ minimum: 1, maximum: 2147483647 }),
    publicKey: t.String({ minLength: 16, maxLength: 8192 }),
    signature: t.String({ minLength: 16, maxLength: 4096 }),
  }),
  oneTimePreKeys: t.Array(
    t.Object({
      id: t.Number({ minimum: 1, maximum: 2147483647 }),
      publicKey: t.String({ minLength: 16, maxLength: 4096 }),
    }),
    { maxItems: 200 },
  ),
})

export const identityV2 = new Elysia({ prefix: "/identity" })
  .post(
    "/bootstrap",
    async ({ body, set }) => {
      try {
        return await bootstrapV2Identity(body)
      } catch (error) {
        set.status = 403
        return {
          error: error instanceof Error ? error.message : "Failed to bootstrap identity",
        }
      }
    },
    {
      body: t.Object({
        userId: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
        linkToken: t.Optional(t.String({ minLength: 8, maxLength: 128 })),
        profileName: t.String({ minLength: 1, maxLength: 64 }),
        deviceLabel: t.String({ minLength: 1, maxLength: 64 }),
        bundle: publicBundleSchema,
      }),
    },
  )
  .use(v2AuthMiddleware)
  .get("/me", async ({ v2Auth, set }) => {
    const me = await getMe(v2Auth.userId)
    if (!me) {
      set.status = 404
      return { error: "Profile not found" }
    }
    return me
  })
  .post(
    "/prekeys/refresh",
    async ({ v2Auth, body }) => {
      await refreshDevicePrekeys(v2Auth.userId, v2Auth.deviceId, body.bundle)
      return { ok: true }
    },
    {
      body: t.Object({
        bundle: publicBundleSchema,
      }),
    },
  )
  .post("/devices/link-token", async ({ v2Auth }) => {
    const token = await createLinkToken(v2Auth.userId, v2Auth.deviceId)
    return token
  })
  .post(
    "/devices/revoke",
    async ({ v2Auth, body, set }) => {
      if (body.targetDeviceId === v2Auth.deviceId) {
        set.status = 400
        return { error: "Use another trusted device to revoke the current one" }
      }

      const revoked = await revokeDevice(v2Auth.userId, body.targetDeviceId)
      if (!revoked) {
        set.status = 404
        return { error: "Device not found" }
      }

      return { ok: true }
    },
    {
      body: t.Object({
        targetDeviceId: t.Number({ minimum: 1, maximum: 127 }),
      }),
    },
  )
  .get(
    "/users/:userId/devices",
    async ({ params, set }) => {
      const devices = await getPublicDevices(params.userId)
      if (devices.length === 0) {
        set.status = 404
        return { error: "No devices found" }
      }

      return { devices }
    },
    {
      params: t.Object({
        userId: t.String({ minLength: 1, maxLength: 128 }),
      }),
    },
  )
  .get(
    "/users/:userId/bundles",
    async ({ params, query, set }) => {
      const bundles = await claimPreKeyBundles(params.userId, query.excludeDeviceId)
      if (bundles.length === 0) {
        set.status = 404
        return { error: "User not found" }
      }

      return { bundles }
    },
    {
      params: t.Object({
        userId: t.String({ minLength: 1, maxLength: 128 }),
      }),
      query: t.Object({
        excludeDeviceId: t.Optional(t.Number({ minimum: 1, maximum: 127 })),
      }),
    },
  )
