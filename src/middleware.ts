import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  getClientIp,
  getMetaKey,
} from "@/lib/membership"

const ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/
const MW_RATE_LIMIT_WINDOW = 60
const MW_RATE_LIMIT_MAX = 30

function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  })
}

function ensureToken(req: NextRequest): { token: string; response?: NextResponse } {
  const existingToken = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (existingToken) return { token: existingToken }

  const newToken = nanoid()
  const response = NextResponse.redirect(req.url)
  setAuthCookie(response, newToken)
  return { token: newToken, response }
}

async function handleRoom(req: NextRequest, roomId: string) {
  if (!ID_REGEX.test(roomId)) {
    return NextResponse.redirect(new URL("/?error=invalid-room", req.url))
  }

  const { token, response } = ensureToken(req)
  if (response) return response

  try {
    const meta = await redis.hgetall(getMetaKey("room", roomId)) as Record<string, unknown> | null
    if (!meta) {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }
  } catch (error) {
    console.error("Redis error:", error)
    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  }

  const next = NextResponse.next()
  setAuthCookie(next, token)
  return next
}

async function handleChannel(req: NextRequest, channelId: string) {
  if (!ID_REGEX.test(channelId)) {
    return NextResponse.redirect(new URL("/?error=invalid-room", req.url))
  }

  const { token, response } = ensureToken(req)
  if (response) return response

  try {
    const meta = await redis.hgetall(
      getMetaKey("channel", channelId)
    ) as Record<string, unknown> | null

    if (!meta) {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }
  } catch (error) {
    console.error("Redis error:", error)
    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  }

  const next = NextResponse.next()
  setAuthCookie(next, token)
  return next
}

async function handleGroup(req: NextRequest, groupId: string) {
  if (!ID_REGEX.test(groupId)) {
    return NextResponse.redirect(new URL("/?error=invalid-room", req.url))
  }

  const { token, response } = ensureToken(req)
  if (response) return response

  try {
    const meta = await redis.hgetall(
      getMetaKey("group", groupId)
    ) as Record<string, unknown> | null

    if (!meta) {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }
  } catch (error) {
    console.error("Redis error:", error)
    return NextResponse.redirect(new URL("/?error=server-error", req.url))
  }

  const next = NextResponse.next()
  setAuthCookie(next, token)
  return next
}

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = process.env.IP_SALT || process.env.UPSTASH_REDIS_REST_TOKEN || "private-chat-salt"
  const data = encoder.encode(ip + salt)
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

  const ip = getClientIp(req.headers)
  let allowed = false

  try {
    allowed = await checkRateLimit(ip)
  } catch (error) {
    console.error("Middleware rate limit failed:", error)
    return new NextResponse("Service Unavailable", { status: 503 })
  }

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
  response.headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=(self), payment=()")
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin")
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin")
  return response
}

export const config = {
  matcher: ["/room/:path*", "/channel/:path*", "/group/:path*"],
}