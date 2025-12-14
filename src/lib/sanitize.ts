const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
}

export function sanitizeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, (char) => ESCAPE_MAP[char] || char)
}

export function sanitizeUsername(name: string): string {
  return sanitizeHtml(name.trim()).slice(0, 100)
}

export function validateRoomId(roomId: string): boolean {
  return /^[a-zA-Z0-9_-]{10,64}$/.test(roomId)
}
