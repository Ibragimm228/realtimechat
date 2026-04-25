import { Elysia, t } from "elysia"

import { getMe, getTransparencyEvents } from "@/lib/v2/server-store"

export const transparencyV2 = new Elysia({ prefix: "/transparency" })
  .get(
    "/:userId",
    async ({ params, set }) => {
      const me = await getMe(params.userId)
      if (!me) {
        set.status = 404
        return { error: "User not found" }
      }

      return {
        head: me.transparencyHead,
        events: await getTransparencyEvents(params.userId),
      }
    },
    {
      params: t.Object({
        userId: t.String({ minLength: 1, maxLength: 128 }),
      }),
    },
  )
