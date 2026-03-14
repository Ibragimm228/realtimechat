"use client"

import { useCallback, useRef } from "react"
import { useSyncExternalStore } from "react"

const STORAGE_KEY = "chat_sound_enabled"

let listeners: Array<() => void> = []

function emitChange() {
  for (const listener of listeners) listener()
}

function getEnabled(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(STORAGE_KEY) !== "false"
}

const getSnapshot = () => {
  if (typeof window === "undefined") return "true"
  return localStorage.getItem(STORAGE_KEY) ?? "true"
}

const getServerSnapshot = () => "true"

const subscribe = (callback: () => void) => {
  listeners.push(callback)
  return () => {
    listeners = listeners.filter((l) => l !== callback)
  }
}

export function useSound() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const enabled = raw !== "false"
  const audioCtxRef = useRef<AudioContext | null>(null)

  const toggle = useCallback(() => {
    const next = !getEnabled()
    localStorage.setItem(STORAGE_KEY, String(next))
    emitChange()
  }, [])

  const playNotification = useCallback(() => {
    if (!getEnabled()) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
      osc.type = "sine"

      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }, [])

  return { enabled, toggle, playNotification }
}
