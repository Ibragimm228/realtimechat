import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

export const middleware = async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname

  const roomMatch = pathname.match(/^\/room\/([^/]+)$/)
  if (!roomMatch) return NextResponse.redirect(new URL("/", req.url))

  const roomId = roomMatch[1]

  const meta = await redis.hgetall(
    `meta:${roomId}`
  ) as { connected: string | string[]; createdAt: number } | null

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
  }

  // Parse connected array if it comes back as a string (Upstash behavior)
  const connected: string[] = typeof meta.connected === "string" 
    ? JSON.parse(meta.connected) 
    : meta.connected || []

  const existingToken = req.cookies.get("x-auth-token")?.value

  if (existingToken && connected.includes(existingToken)) {
    return NextResponse.next()
  }

  if (connected.length >= 2) {
    return NextResponse.redirect(new URL("/?error=room-full", req.url))
  }

  const response = NextResponse.next()

  const token = nanoid()

  response.cookies.set("x-auth-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  })

  await redis.hset(`meta:${roomId}`, {
    connected: JSON.stringify([...connected, token]),
  })

  return response
}

export const config = {
  matcher: "/room/:path*",
}
