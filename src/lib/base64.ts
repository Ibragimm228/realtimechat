function bytesToBinary(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ""

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return binary
}

export function bytesToBase64(bytes: Uint8Array): string {
  const binary = bytesToBinary(bytes)

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
