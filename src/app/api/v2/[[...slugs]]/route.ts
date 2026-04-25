import { Elysia } from "elysia"

import { identityV2 } from "../identity"
import { directV2 } from "../direct"
import { groupsV2 } from "../groups"
import { transparencyV2 } from "../transparency"

const app = new Elysia({ prefix: "/api/v2" })
  .onError(({ code, error, set }) => {
    console.error(`V2 API Error (${code}):`, error)

    if (code === "VALIDATION") {
      set.status = 400
      return { error: "Invalid request" }
    }

    if (Number(set.status) >= 400) {
      return { error: error instanceof Error ? error.message : "Request failed" }
    }

    set.status = 500
    return { error: "Internal Server Error" }
  })
  .use(identityV2)
  .use(directV2)
  .use(groupsV2)
  .use(transparencyV2)

export const GET = (req: Request) => app.handle(req)
export const POST = (req: Request) => app.handle(req)
export const PATCH = (req: Request) => app.handle(req)
export const DELETE = (req: Request) => app.handle(req)

export type AppV2 = typeof app
