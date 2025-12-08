"use client"

import { generateKey } from "@/lib/crypto"
import { useUsername } from "@/hooks/use-username"
import { client } from "@/lib/client"
import { ThemeSelector } from "@/components/theme-selector"
import { useMutation } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

const Page = () => {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  )
}

export default Page

function Lobby() {
  const { username } = useUsername()
  const router = useRouter()

  const searchParams = useSearchParams()
  const wasDestroyed = searchParams.get("destroyed") === "true"
  const error = searchParams.get("error")

  const { mutate: createRoom } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post()
      const key = await generateKey()

      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}#${key}`)
      }
    },
  })

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 relative bg-background text-foreground transition-colors duration-300">
      <div className="absolute top-4 right-4 z-50">
        <ThemeSelector />
      </div>
      <div className="w-full max-w-md space-y-8">
        {wasDestroyed && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">ROOM DESTROYED</p>
            <p className="text-muted-foreground text-xs mt-1">
              All messages were permanently deleted.
            </p>
          </div>
        )}
        {error === "room-not-found" && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">ROOM NOT FOUND</p>
            <p className="text-muted-foreground text-xs mt-1">
              This room may have expired or never existed.
            </p>
          </div>
        )}
        {error === "room-full" && (
          <div className="bg-destructive/10 border border-destructive/50 p-4 text-center rounded-lg">
            <p className="text-destructive text-sm font-bold">ROOM FULL</p>
            <p className="text-muted-foreground text-xs mt-1">
              This room is at maximum capacity.
            </p>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {">"}private_chat
          </h1>
          <p className="text-muted-foreground text-sm">A private, self-destructing chat room.</p>
          
          <a 
            href="https://t.me/FrontendMania" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-xs font-medium rounded-full transition-colors border border-border"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.29-.48.79-.74 3.08-1.34 5.15-2.23 6.21-2.66 2.95-1.23 3.56-1.43 3.97-1.43.09 0 .28.02.4.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
            @FrontendMania
          </a>
        </div>

        <div className="border border-border bg-card p-6 backdrop-blur-md rounded-xl shadow-2xl">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-muted-foreground text-xs uppercase font-bold tracking-wider">Your Identity</label>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted border border-input p-3 text-sm text-foreground font-mono rounded-md">
                  {username}
                </div>
              </div>
            </div>

            <button
              onClick={() => createRoom()}
              className="w-full bg-primary text-primary-foreground p-3 text-sm font-bold hover:opacity-90 transition-all mt-2 cursor-pointer disabled:opacity-50 rounded-md shadow-lg shadow-primary/20"
            >
              CREATE SECURE ROOM
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
