"use client"

import { useMemo } from "react"

interface CanaryBadgeProps {
  roomId: string
  token: string
}

function generateCanary(roomId: string, token: string): string {
  let hash = 0
  const combined = `${roomId}:${token}`
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0").toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

export function CanaryBadge({ roomId, token }: CanaryBadgeProps) {
  const canary = useMemo(() => generateCanary(roomId, token), [roomId, token])

  return (
    <span
      className="text-[8px] font-mono text-muted-foreground/20 select-all tracking-widest"
      title="Unique session watermark — if leaked, identifies the source"
    >
      {canary}
    </span>
  )
}
