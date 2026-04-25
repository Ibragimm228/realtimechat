import { handle } from "@upstash/realtime"
import { AUTH_COOKIE_NAME, requireActiveMember, type ChatScope } from "@/lib/membership"
import { realtime } from "@/lib/realtime"

type ChannelTarget = {
  scope: ChatScope
  id: string
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie")
  if (!raw) return null

  const pairs = raw.split(";")
  for (const pair of pairs) {
    const [cookieName, ...valueParts] = pair.trim().split("=")
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="))
    }
  }

  return null
}

function parseChannel(channel: string): ChannelTarget | null {
  if (!channel || channel === "default") return null

  if (channel.startsWith("ch:")) {
    const id = channel.slice(3)
    return id ? { scope: "channel", id } : null
  }

  if (channel.startsWith("grp:")) {
    const id = channel.slice(4)
    return id ? { scope: "group", id } : null
  }

  return { scope: "room", id: channel }
}

export const GET = handle({
  realtime,
  middleware: async ({ request, channels }) => {
    const token = readCookie(request, AUTH_COOKIE_NAME)
    if (!token) {
      return new Response("Unauthorized", { status: 401 })
    }

    for (const channel of channels) {
      const target = parseChannel(channel)
      if (!target) continue

      const connected = await requireActiveMember(target.scope, target.id, token)
      if (!connected) {
        return new Response("Forbidden", { status: 403 })
      }
    }
  },
})