export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  )
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key)
  return btoa(String.fromCharCode(...new Uint8Array(exported)))
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const raw = atob(base64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return await crypto.subtle.importKey(
    "raw",
    buf,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  )
}

export async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function generateKeyFingerprint(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key)
  const hash = await crypto.subtle.digest("SHA-256", exported)
  const bytes = new Uint8Array(hash)
  const groups: string[] = []
  for (let i = 0; i < 8; i++) {
    const val = (bytes[i * 2] << 8) | bytes[i * 2 + 1]
    groups.push(val.toString(10).padStart(5, "0"))
  }
  return groups.join(" ")
}

export async function generateEmojiFingerprint(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key)
  const hash = await crypto.subtle.digest("SHA-256", exported)
  const bytes = new Uint8Array(hash)
  const emojis = ["🔒", "🛡️", "🗝️", "🔑", "🔐", "⚡", "🌀", "🎯", "💎", "🔥", "⭐", "🌙", "🎭", "🧬", "🕸️", "🌊"]
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += emojis[bytes[i] % emojis.length]
  }
  return result
}
