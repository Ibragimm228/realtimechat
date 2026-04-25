function base64urlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const b64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64urlDecode(str: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) return null
  const pad = str.length % 4 === 2 ? "==" : str.length % 4 === 3 ? "=" : ""
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad
  try {
    const binary = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary")
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

type JwkLike = {
  alg?: string
  ext?: boolean
  k?: string
  key_ops?: string[]
  kty?: string
}

function keyJwkToBytes(keyJwk: string): Uint8Array | null {
  try {
    const json = typeof atob === "function" ? atob(keyJwk) : Buffer.from(keyJwk, "base64").toString("binary")
    const jwk = JSON.parse(json) as JwkLike
    if (!jwk || typeof jwk.k !== "string") return null
    const bytes = base64urlDecode(jwk.k)
    if (!bytes || bytes.length !== 32) return null
    return bytes
  } catch {
    return null
  }
}

function bytesToKeyJwk(bytes: Uint8Array): string {
  const jwk = {
    alg: "A256GCM",
    ext: true,
    k: base64urlEncode(bytes),
    key_ops: ["encrypt", "decrypt"],
    kty: "oct",
  }
  const json = JSON.stringify(jwk)
  return typeof btoa === "function" ? btoa(json) : Buffer.from(json, "binary").toString("base64")
}

const SEPARATOR = "."
const CODE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function encodeInviteCode(roomId: string, keyJwk: string): string | null {
  if (!roomId || !keyJwk) return null
  const bytes = keyJwkToBytes(keyJwk)
  if (!bytes) return null
  return `${roomId}${SEPARATOR}${base64urlEncode(bytes)}`
}

export function decodeInviteCode(input: string): { roomId: string; key: string } | null {
  const cleaned = parseLooseCode(input)
  if (!cleaned) return null
  const idx = cleaned.indexOf(SEPARATOR)
  if (idx <= 0 || idx === cleaned.length - 1) return null
  const roomId = cleaned.slice(0, idx)
  const keyPart = cleaned.slice(idx + 1)
  const bytes = base64urlDecode(keyPart)
  if (!bytes || bytes.length !== 32) return null
  return { roomId, key: bytesToKeyJwk(bytes) }
}

export function parseLooseCode(input: string): string | null {
  if (!input) return null
  const stripped = input.replace(/\s+/g, "")
  if (!stripped) return null
  if (!CODE_PATTERN.test(stripped)) return null
  return stripped
}

export function looksLikeInviteCode(input: string): boolean {
  return parseLooseCode(input) !== null
}

export function formatCodeDisplay(code: string, groupSize = 5): string {
  const clean = parseLooseCode(code) ?? code.replace(/\s+/g, "")
  const [roomId, key] = clean.split(SEPARATOR)
  if (!key) return chunk(clean, groupSize)
  return `${chunk(roomId, groupSize)}${SEPARATOR}${chunk(key, groupSize)}`
}

function chunk(s: string, n: number): string {
  if (n <= 0) return s
  const out: string[] = []
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n))
  return out.join("\u2009")
}
