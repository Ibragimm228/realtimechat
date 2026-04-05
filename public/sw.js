const CACHE_NAME = "private-chat-v2"
const OFFLINE_URL = "/offline"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, "/icon-192.svg", "/icon-512.svg"])
    )
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    )
    return
  }

  if (url.pathname.match(/\.(js|css|png|svg|woff2?|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          return res
        })
      )
    )
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then((c) => c.put(request, clone))
        return res
      })
      .catch(() => caches.match(request).then((c) => c || caches.match(OFFLINE_URL)))
  )
})

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || "New Message", {
      body: data.body || "You have a new encrypted message",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: data.tag || "message",
      data: { url: data.url || "/" },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  let url = "/"

  try {
    const target = new URL(event.notification.data?.url || "/", self.location.origin)
    if (target.origin === self.location.origin) {
      url = `${target.pathname}${target.search}${target.hash}`
    }
  } catch {}

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const fullUrl = new URL(url, self.location.origin).href
      for (const c of clients) {
        if (c.url === fullUrl && "focus" in c) return c.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener("sync", (event) => {
  if (event.tag === "send-messages") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        for (const c of clients) c.postMessage({ type: "SYNC_MESSAGES" })
      })
    )
  }
})
