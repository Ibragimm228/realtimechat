import { treaty } from "@elysiajs/eden"

import type { AppV2 } from "@/app/api/v2/[[...slugs]]/route"

export const v2Client = treaty<AppV2>(
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
).api.v2
