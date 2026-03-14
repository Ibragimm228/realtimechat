import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

const ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/
const MW_RATE_LIMIT_WINDOW = 60
const MW_RATE_LIMIT_MAX = 30

const ADD_USER_SCRIPT = `
local key = KEYS[1]
local token = ARGV[1]
local capacity = tonumber(ARGV[2])

local raw = redis.call('HGET', key, 'connected')
if not raw then 
  return 'room-not-found'
end

local connected = cjson.decode(raw)

for i, t in ipairs(connected) do
  if t == token then 
    return 'already-connected'
  end
end

if #connected >= capacity then 
  return 'room-full'
end

table.insert(connected, token)
redis.call('HSET', key, 'connected', cjson.encode(connected))
return 'success'
`

function ensureToken(req: NextRequest): { token: string; response?: NextResponse } {
  const existingToken = req.cookies.get("x-auth-token")?.value
  if (existingToken) return { token: existingToken }

  const newToken = nanoid()
  const response = NextResponse.redirect(req.url)
  response.cookies.set("x-auth-token", newToken, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 86400,
  })
  return { token: newToken, response }
}

async function handleRoom(req: NextRequest, roomId: string) {
  if (!ID_REGEX.test(roomId)) {
    return NextResponse.redirect(new URL("/?error=invalid-room", req.url))
  }

  const { token, response } = ensureToken(req)
  if (response) return response

  const meta = await redis.hgetall(
    `meta:${roomId}`
  ) as { connected: string | string[]; createdAt: number; capacity?: number } | null

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
  }

  const capacity = meta.capacity || 2

  try {
    const result = await redis.eval(
      ADD_USER_SCRIPT,
      [`meta:${roomId}`],
      [token, capacity.toString()]
    ) as string

    if (result === 'already-connected' || result === 'success') {
      return NextResponse.next()
    }

    if (result === 'room-full') {
      return NextResponse.redirect(new URL("/?error=room-full", req.url))
    }

    if (result === 'room-not-found') {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  } catch (error) {
    console.error("Redis error:", error)
    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  }
}

async function handleChannel(req: NextRequest, channelId: string) {
  if (!ID_REGEX.test(channelId)) {
    return NextResponse.redirect(new URL("/?error=invalid-room", req.url))
  }

  const { token, response } = ensureToken(req)
  if (response) return response

  const meta = await redis.hgetall(
    `meta:channel:${channelId}`
  ) as { connected: string | string[]; capacity?: number } | null

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
  }

  const capacity = Number(meta.capacity) || 1000

  try {
    const result = await redis.eval(
      ADD_USER_SCRIPT,
      [`meta:channel:${channelId}`],
      [token, capacity.toString()]
    ) as string

    if (result === 'already-connected' || result === 'success') {
      return NextResponse.next()
    }

    if (result === 'room-full') {
      return NextResponse.redirect(new URL("/?error=room-full", req.url))
    }

    if (result === 'room-not-found') {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  } catch (error) {
    console.error("Redis error:", error)
    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  }
}

async function handleGroup(req: NextRequest, groupId: string) {
  if (!ID_REGEX.test(groupId)) {
    return NextResponse.redirect(new URL("/?error=invalid-room", req.url))
  }

  const { token, response } = ensureToken(req)
  if (response) return response

  const meta = await redis.hgetall(
    `meta:group:${groupId}`
  ) as { connected: string | string[]; capacity?: number } | null

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
  }

  const capacity = Number(meta.capacity) || 500

  try {
    const result = await redis.eval(
      ADD_USER_SCRIPT,
      [`meta:group:${groupId}`],
      [token, capacity.toString()]
    ) as string

    if (result === 'already-connected' || result === 'success') {
      return NextResponse.next()
    }

    if (result === 'room-full') {
      return NextResponse.redirect(new URL("/?error=room-full", req.url))
    }

    if (result === 'room-not-found') {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  } catch (error) {
    console.error("Redis error:", error)
    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  }
}

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + (process.env.IP_SALT || "private-chat-salt"))
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const hashed = await hashIp(ip)
  const key = `mw-rl:${hashed}`
  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, MW_RATE_LIMIT_WINDOW)
  }
  return current <= MW_RATE_LIMIT_MAX
}

export const middleware = async (req: NextRequest) => {
  if (req.headers.get("x-middleware-subrequest")) {
    return new NextResponse(null, { status: 403 })
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1"
  const allowed = await checkRateLimit(ip)
  if (!allowed) {
    return new NextResponse("Too Many Requests", { status: 429 })
  }

  const pathname = req.nextUrl.pathname

  const roomMatch = pathname.match(/^\/room\/([^/]+)$/)
  if (roomMatch) {
    const response = await handleRoom(req, roomMatch[1])
    return stripHeaders(response)
  }

  const channelMatch = pathname.match(/^\/channel\/([^/]+)$/)
  if (channelMatch) {
    const response = await handleChannel(req, channelMatch[1])
    return stripHeaders(response)
  }

  const groupMatch = pathname.match(/^\/group\/([^/]+)$/)
  if (groupMatch) {
    const response = await handleGroup(req, groupMatch[1])
    return stripHeaders(response)
  }

  return NextResponse.redirect(new URL("/", req.url))
}

function stripHeaders(response: NextResponse): NextResponse {
  response.headers.delete("x-powered-by")
  response.headers.delete("server")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}

export const config = {
  matcher: ["/room/:path*", "/channel/:path*", "/group/:path*"],
}