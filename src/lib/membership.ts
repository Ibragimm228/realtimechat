import { redis } from "@/lib/redis"

export const AUTH_COOKIE_NAME = "x-auth-token"
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
export const MEMBER_TTL_SECONDS = AUTH_COOKIE_MAX_AGE_SECONDS

export type ChatScope = "room" | "channel" | "group"

const ADMIT_MEMBER_SCRIPT = `
local metaKey = KEYS[1]
local token = ARGV[1]
local capacity = tonumber(ARGV[2])
local memberPrefix = ARGV[3]
local memberTtl = tonumber(ARGV[4])

local raw = redis.call('HGET', metaKey, 'connected')
if not raw then
  return 'room-not-found'
end

local ok, connected = pcall(cjson.decode, raw)
if not ok or type(connected) ~= 'table' then
  connected = {}
end

local active = {}
local seen = {}
local alreadyConnected = false

for _, existingToken in ipairs(connected) do
  if type(existingToken) == 'string' and seen[existingToken] == nil then
    local sessionKey = memberPrefix .. existingToken
    if redis.call('EXISTS', sessionKey) == 1 then
      table.insert(active, existingToken)
      seen[existingToken] = true
      if existingToken == token then
        alreadyConnected = true
      end
    end
  end
end

if alreadyConnected then
  redis.call('HSET', metaKey, 'connected', cjson.encode(active))
  redis.call('SET', memberPrefix .. token, '1', 'EX', memberTtl)
  return 'already-connected'
end

if #active >= capacity then
  redis.call('HSET', metaKey, 'connected', cjson.encode(active))
  return 'room-full'
end

table.insert(active, token)
redis.call('HSET', metaKey, 'connected', cjson.encode(active))
redis.call('SET', memberPrefix .. token, '1', 'EX', memberTtl)
return 'success'
`

export function getMetaKey(scope: ChatScope, id: string): string {
  switch (scope) {
    case "room":
      return `meta:${id}`
    case "channel":
      return `meta:channel:${id}`
    case "group":
      return `meta:group:${id}`
  }
}

export function getMemberSessionKey(scope: ChatScope, id: string, token: string): string {
  return `session:${scope}:${id}:${token}`
}

function getMemberSessionPrefix(scope: ChatScope, id: string): string {
  return `session:${scope}:${id}:`
}

export function parseConnected(rawConnected: string | string[] | null | undefined): string[] {
  if (typeof rawConnected === "string") {
    try {
      const parsed = JSON.parse(rawConnected)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : []
    } catch {
      return []
    }
  }

  if (Array.isArray(rawConnected)) {
    return rawConnected.filter((item): item is string => typeof item === "string")
  }

  return []
}

export async function touchMemberSession(scope: ChatScope, id: string, token: string) {
  await redis.set(getMemberSessionKey(scope, id, token), "1", { ex: MEMBER_TTL_SECONDS })
}

export async function readActiveConnected(scope: ChatScope, id: string): Promise<string[]> {
  const rawConnected = await redis.hget<string | string[]>(getMetaKey(scope, id), "connected")
  const connected = parseConnected(rawConnected)

  if (connected.length === 0) {
    return []
  }

  const activityChecks = await Promise.all(
    connected.map((token) => redis.exists(getMemberSessionKey(scope, id, token)))
  )

  const activeConnected = connected.filter((_, index) => Boolean(activityChecks[index]))

  if (activeConnected.length !== connected.length) {
    await redis.hset(getMetaKey(scope, id), {
      connected: JSON.stringify(activeConnected),
    })
  }

  return activeConnected
}

export async function requireActiveMember(scope: ChatScope, id: string, token: string) {
  const connected = await readActiveConnected(scope, id)

  if (!connected.includes(token)) {
    return null
  }

  await touchMemberSession(scope, id, token)
  return connected
}

export async function admitMember(scope: ChatScope, id: string, token: string, capacity: number) {
  return await redis.eval(
    ADMIT_MEMBER_SCRIPT,
    [getMetaKey(scope, id)],
    [token, capacity.toString(), getMemberSessionPrefix(scope, id), MEMBER_TTL_SECONDS.toString()]
  ) as string
}

function extractFirstIp(value: string | null | undefined) {
  if (!value) return null
  const first = value.split(",")[0]?.trim()
  return first || null
}

export function getClientIp(headers: Pick<Headers, "get">): string {
  return (
    extractFirstIp(headers.get("cf-connecting-ip")) ||
    extractFirstIp(headers.get("x-real-ip")) ||
    extractFirstIp(headers.get("x-forwarded-for")) ||
    "127.0.0.1"
  )
}
