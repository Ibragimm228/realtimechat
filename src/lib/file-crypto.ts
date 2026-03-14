const MAX_FILE_SIZE = 5 * 1024 * 1024

export interface FileMetadata {
  name: string
  type: string
  size: number
}

export async function encryptFile(file: File, key: CryptoKey): Promise<string> {
  if (file.size > MAX_FILE_SIZE) throw new Error("File too large (max 5MB)")

  const buffer = await file.arrayBuffer()
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer)

  const meta: FileMetadata = { name: file.name, type: file.type, size: file.size }
  const metaStr = JSON.stringify(meta)
  const metaBytes = new TextEncoder().encode(metaStr)
  const metaLen = new Uint8Array(2)
  metaLen[0] = (metaBytes.length >> 8) & 0xff
  metaLen[1] = metaBytes.length & 0xff

  const encArr = new Uint8Array(encrypted)
  const payload = new Uint8Array(2 + metaBytes.length + iv.length + encArr.length)
  payload.set(metaLen, 0)
  payload.set(metaBytes, 2)
  payload.set(iv, 2 + metaBytes.length)
  payload.set(encArr, 2 + metaBytes.length + iv.length)

  return btoa(String.fromCharCode(...payload))
}

export async function decryptFile(data: string, key: CryptoKey): Promise<{ blob: Blob; meta: FileMetadata }> {
  const raw = atob(data)
  const payload = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) payload[i] = raw.charCodeAt(i)

  const metaLen = (payload[0] << 8) | payload[1]
  const metaBytes = payload.slice(2, 2 + metaLen)
  const meta: FileMetadata = JSON.parse(new TextDecoder().decode(metaBytes))

  const iv = payload.slice(2 + metaLen, 2 + metaLen + 12)
  const encData = payload.slice(2 + metaLen + 12)

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encData)
  return { blob: new Blob([decrypted], { type: meta.type }), meta }
}

export function isImageType(type: string): boolean {
  return type.startsWith("image/")
}

export function isAudioType(type: string): boolean {
  return type.startsWith("audio/")
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
