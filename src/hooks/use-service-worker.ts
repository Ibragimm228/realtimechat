"use client"

import { useEffect } from "react"

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/sw.js").catch(() => {})

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_MESSAGES") {
        window.dispatchEvent(new CustomEvent("sw-sync"))
      }
    })
  }, [])
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  const result = await Notification.requestPermission()
  return result === "granted"
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) return sub

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return null

    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    })
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
}
