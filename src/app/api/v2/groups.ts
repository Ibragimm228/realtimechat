import { Elysia, t } from "elysia"

import { v2AuthMiddleware } from "./auth"
import {
  createGroupRecord,
  getGroupMembers,
  getGroupRecord,
  listGroupsForUser,
  mutateGroupMembership,
  queueEnvelopes,
} from "@/lib/v2/server-store"

export const groupsV2 = new Elysia({ prefix: "/groups" })
  .use(v2AuthMiddleware)
  .post(
    "/create",
    async ({ v2Auth, body }) => {
      const group = await createGroupRecord({
        title: body.title,
        createdByUserId: v2Auth.userId,
        createdByDeviceId: v2Auth.deviceId,
        memberUserIds: body.memberUserIds,
      })

      return { group }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 80 }),
        memberUserIds: t.Array(t.String({ minLength: 1, maxLength: 128 }), {
          maxItems: 128,
        }),
      }),
    },
  )
  .get("/mine", async ({ v2Auth }) => {
    return { groups: await listGroupsForUser(v2Auth.userId) }
  })
  .get(
    "/:groupId",
    async ({ params, set }) => {
      const group = await getGroupRecord(params.groupId)
      if (!group) {
        set.status = 404
        return { error: "Group not found" }
      }

      return {
        group,
        members: await getGroupMembers(params.groupId),
      }
    },
    {
      params: t.Object({
        groupId: t.String({ minLength: 1, maxLength: 128 }),
      }),
    },
  )
  .post(
    "/members/add",
    async ({ v2Auth, body }) => {
      const group = await mutateGroupMembership({
        actorUserId: v2Auth.userId,
        groupId: body.groupId,
        addUserIds: body.userIds,
      })

      return { group }
    },
    {
      body: t.Object({
        groupId: t.String({ minLength: 1, maxLength: 128 }),
        userIds: t.Array(t.String({ minLength: 1, maxLength: 128 }), {
          minItems: 1,
          maxItems: 128,
        }),
      }),
    },
  )
  .post(
    "/members/remove",
    async ({ v2Auth, body }) => {
      const group = await mutateGroupMembership({
        actorUserId: v2Auth.userId,
        groupId: body.groupId,
        removeUserIds: body.userIds,
      })

      return { group }
    },
    {
      body: t.Object({
        groupId: t.String({ minLength: 1, maxLength: 128 }),
        userIds: t.Array(t.String({ minLength: 1, maxLength: 128 }), {
          minItems: 1,
          maxItems: 128,
        }),
      }),
    },
  )
  .post(
    "/send",
    async ({ v2Auth, body, set }) => {
      if (body.senderUserId !== v2Auth.userId || body.senderDeviceId !== v2Auth.deviceId) {
        set.status = 403
        return { error: "Sender does not match authenticated device" }
      }

      const members = await getGroupMembers(body.groupId)
      if (!members.some((member) => member.userId === v2Auth.userId)) {
        set.status = 403
        return { error: "Only active group members can send" }
      }

      const envelopes = body.envelopes.map((envelope) => ({
        ...envelope,
        groupId: body.groupId,
        epoch: body.epoch,
      }))

      const queued = await queueEnvelopes(envelopes)
      return { queued }
    },
    {
      body: t.Object({
        senderUserId: t.String({ minLength: 1, maxLength: 128 }),
        senderDeviceId: t.Number({ minimum: 1, maximum: 127 }),
        groupId: t.String({ minLength: 1, maxLength: 128 }),
        epoch: t.Number({ minimum: 1, maximum: 2147483647 }),
        envelopes: t.Array(
          t.Object({
            kind: t.Union([t.Literal("group-message"), t.Literal("group-key")]),
            distributionId: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
            senderUserId: t.String({ minLength: 1, maxLength: 128 }),
            senderDeviceId: t.Number({ minimum: 1, maximum: 127 }),
            recipientUserId: t.String({ minLength: 1, maxLength: 128 }),
            recipientDeviceId: t.Number({ minimum: 1, maximum: 127 }),
            ciphertextType: t.Union([t.Literal("sender-key"), t.Literal("whisper")]),
            ciphertext: t.String({ minLength: 8, maxLength: 131072 }),
            sentAt: t.Number({ minimum: 0 }),
            clientMessageId: t.String({ minLength: 1, maxLength: 128 }),
          }),
          { minItems: 1, maxItems: 512 },
        ),
      }),
    },
  )
