export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  if (typeof btoa === "function") {
    return btoa(binary)
  }

  return Buffer.from(binary, "binary").toString("base64")
}

export function base64ToBytes(value: string): Uint8Array {
  const binary =
    typeof atob === "function"
      ? atob(value)
      : Buffer.from(value, "base64").toString("binary")

  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

export function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function bytesToUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value)
}
