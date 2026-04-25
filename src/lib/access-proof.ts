function base64urlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64")

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64urlDecode(str: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) return null

  const pad = str.length % 4 === 2 ? "==" : str.length % 4 === 3 ? "=" : ""
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad

  try {
    const binary =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("binary")

    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    return bytes
  } catch {
    return null
  }
}

function keyJwkToBytes(keyJwk: string): Uint8Array {
  try {
    const json =
      typeof atob === "function"
        ? atob(keyJwk)
        : Buffer.from(keyJwk, "base64").toString("binary")

    const jwk = JSON.parse(json) as { k?: string }
    if (!jwk?.k) throw new Error("Missing key data")

    const bytes = base64urlDecode(jwk.k)
    if (!bytes || bytes.length !== 32) throw new Error("Invalid key length")

    return bytes
  } catch {
    throw new Error("Invalid encryption key")
  }
}

export async function deriveAccessProof(keyJwk: string): Promise<string> {
  const keyBytes = keyJwkToBytes(keyJwk)
  const source = new Uint8Array(keyBytes.byteLength)
  source.set(keyBytes)
  const digest = await crypto.subtle.digest("SHA-256", source)
  return base64urlEncode(new Uint8Array(digest))
}
