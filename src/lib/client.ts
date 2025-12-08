import { treaty } from "@elysiajs/eden"
import type { App } from "../app/api/[[...slugs]]/route"

export const client = treaty<App>(
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
).api
