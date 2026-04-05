"use client"

import { generateKey } from "@/lib/crypto"
import { client } from "@/lib/client"
import { ThemeSelector } from "@/components/theme-selector"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"

const Page = () => {
  const params = useParams()
  const handle = params.handle as string
  const [isJoining, setIsJoining] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["handle-resolve", handle],
    queryFn: async () => {
      const res = await client.handle.resolve.get({ query: { handle } })
      return res.data
    },
  })

  const handleJoin = async () => {
    if (!data || "error" in data) return
    setIsJoining(true)
    try {
      const key = await generateKey()
      const prefix = data.type === "group" ? "/group" : "/channel"
      window.location.href = `${window.location.origin}${prefix}/${data.id}#${key}`
    } catch {
      setIsJoining(false)
    }
  }

  const isGroup = data && "type" in data && data.type === "group"
  const found = data && !("error" in data)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 relative bg-background text-foreground">
      <div className="absolute top-4 right-4 z-50">
        <ThemeSelector />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {">"}private_chat
          </h1>
          <p className="text-muted-foreground text-sm">Join via @handle</p>
        </div>

        <div className="border border-border bg-card p-6 backdrop-blur-md rounded-xl shadow-2xl">
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-pulse text-muted-foreground text-sm">
                Resolving @{handle}...
              </div>
            </div>
          )}

          {!isLoading && !found && (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-destructive font-bold text-sm">Handle not found</p>
              <p className="text-muted-foreground text-xs">
                @{handle} does not exist or has expired.
              </p>
              <Link href="/" className="inline-block text-primary text-xs font-bold hover:underline mt-2">
                Go Home
              </Link>
            </div>
          )}

          {!isLoading && found && data && !("error" in data) && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ${
                  isGroup
                    ? "bg-gradient-to-br from-emerald-400 to-teal-600"
                    : "bg-gradient-to-br from-[#50a2e3] to-[#2481cc]"
                }`}>
                  {data.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg truncate">{data.name}</h2>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isGroup
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-blue-500/10 text-blue-600"
                    }`}>
                      {data.type}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs font-mono">@{handle}</p>
                </div>
              </div>

              {data.description && (
                <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
                  {data.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span className="font-bold">{data.members}</span> {isGroup ? "members" : "subscribers"}
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-bold text-foreground">Note:</span> A new encryption key will be generated for your session.
                  For fully secure E2EE communication, request an invite link with a shared key from an existing member.
                </p>
              </div>

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className={`w-full py-3.5 text-sm font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 text-white ${
                  isGroup
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                    : "bg-[#2481cc] hover:bg-[#28a1ff] shadow-[#2481cc]/20"
                }`}
              >
                {isJoining ? "Joining..." : `Join ${isGroup ? "Group" : "Channel"}`}
              </button>

              <Link href="/" className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                Back to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default Page
