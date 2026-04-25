import { Elysia, t } from "elysia"

import { v2AuthMiddleware } from "./auth"
import { ackInbox, fetchInbox, queueEnvelopes } from "@/lib/v2/server-store"

export const directV2 = new Elysia({ prefix: "/direct" })
  .use(v2AuthMiddleware)
  .post(
    "/send",
    async ({ v2Auth, body, set }) => {
      if (body.senderUserId !== v2Auth.userId || body.senderDeviceId !== v2Auth.deviceId) {
        set.status = 403
        return { error: "Sender does not match authenticated device" }
      }

      const envelopes = body.envelopes.map((envelope) => ({
        ...envelope,
        kind: "direct" as const,
      }))

      const queued = await queueEnvelopes(envelopes)
      return { queued }
    },
    {
      body: t.Object({
        senderUserId: t.String({ minLength: 1, maxLength: 128 }),
        senderDeviceId: t.Number({ minimum: 1, maximum: 127 }),
        recipientUserId: t.String({ minLength: 1, maxLength: 128 }),
        envelopes: t.Array(
          t.Object({
            conversationId: t.String({ minLength: 1, maxLength: 256 }),
            peerUserId: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
            senderUserId: t.String({ minLength: 1, maxLength: 128 }),
            senderDeviceId: t.Number({ minimum: 1, maximum: 127 }),
            recipientUserId: t.String({ minLength: 1, maxLength: 128 }),
            recipientDeviceId: t.Number({ minimum: 1, maximum: 127 }),
            ciphertextType: t.Union([t.Literal("prekey"), t.Literal("whisper")]),
            ciphertext: t.String({ minLength: 8, maxLength: 131072 }),
            sentAt: t.Number({ minimum: 0 }),
            clientMessageId: t.String({ minLength: 1, maxLength: 128 }),
          }),
          { minItems: 1, maxItems: 64 },
        ),
      }),
    },
  )
  .get(
    "/inbox",
    async ({ v2Auth, query }) => {
      const envelopes = await fetchInbox(v2Auth.userId, v2Auth.deviceId, query.limit)
      return { envelopes }
    },
    {
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 200, default: 50 })),
      }),
    },
  )
  .post(
    "/ack",
    async ({ v2Auth, body }) => {
      await ackInbox(v2Auth.userId, v2Auth.deviceId, body.envelopeIds)
      return { ok: true }
    },
    {
      body: t.Object({
        envelopeIds: t.Array(t.String({ minLength: 1, maxLength: 64 }), {
          minItems: 1,
          maxItems: 200,
        }),
      }),
    },
  )
