"use client"

import { client } from "@/lib/client"
import { ThemeSelector } from "@/components/theme-selector"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"

const Page = () => {
  const params = useParams()
  const handle = params.handle as string

  const { data, isLoading } = useQuery({
    queryKey: ["handle-resolve", handle],
    queryFn: async () => {
      const res = await client.handle.resolve.get({ query: { handle } })
      return res.data
    },
  })

  const isGroup = data && "type" in data && data.type === "group"
  const found = data && !("error" in data)

  return (
    <div className="frame">
      <header className="rail">
        <div className="brand">
          <Link href="/" className="brand-mark" title="Home">← ANON</Link>
          <div className="brand-word">join<em>.</em>@{handle}</div>
        </div>
        <div className="rail-center" />
        <div className="rail-right">
          <ThemeSelector />
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "48px 20px",
          background: "var(--bg)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div className="kicker" style={{ marginBottom: 20 }}>
            <span className="num">01 / 01</span>
            <span>— Resolve handle</span>
          </div>

          <div className="panel" style={{ background: "var(--paper)" }}>
            <div className="panel-body flex col gap-16">
              {isLoading && (
                <div className="empty-state" style={{ padding: "32px 20px" }}>
                  <div className="kicker"><span>— Resolving —</span></div>
                  <h3>Looking up @{handle}</h3>
                  <div className="typing" style={{ justifyContent: "center" }}>
                    <div className="dots"><span /><span /><span /></div>
                  </div>
                </div>
              )}

              {!isLoading && !found && (
                <div className="empty-state" style={{ padding: "32px 20px" }}>
                  <div className="kicker"><span>— Not found —</span></div>
                  <h3>Handle doesn&apos;t exist</h3>
                  <p>
                    <span className="mono">@{handle}</span> does not exist or has expired.
                  </p>
                  <Link href="/" className="btn-ghost" style={{ marginTop: 12 }}>
                    ← Back home
                  </Link>
                </div>
              )}

              {!isLoading && found && data && !("error" in data) && (
                <>
                  <div className="identity">
                    <div className="glyph">{data.name.slice(0, 1).toUpperCase()}</div>
                    <div className="idmeta">
                      <div className="idlbl">{isGroup ? "Group" : "Channel"}</div>
                      <div className="idnum" title={data.name}>{data.name}</div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--muted)",
                          letterSpacing: "0.06em",
                          marginTop: 2,
                        }}
                      >
                        @{handle}
                      </div>
                    </div>
                    <div className="chip ghost">{isGroup ? "Group" : "Channel"}</div>
                  </div>

                  {data.description && (
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--ink-3)",
                        lineHeight: 1.5,
                        borderLeft: "2px solid var(--rule)",
                        paddingLeft: 14,
                      }}
                    >
                      {data.description}
                    </p>
                  )}

                  <div className="legend">
                    <span>
                      <span className="dash" />
                      <b style={{ color: "var(--ink)", fontWeight: 600 }}>{data.members}</b>
                      &nbsp;{isGroup ? "members" : "subscribers"}
                    </span>
                    <span>
                      <span className="dash" />AES-GCM-256
                    </span>
                  </div>

                  <div className="alert">
                    <div className="alert-title">Private access</div>
                    <div className="alert-body">
                      Public handles only reveal chat metadata. To enter the encrypted chat itself,
                      request a private invite code or share link from an existing member.
                    </div>
                  </div>

                  <Link href="/" className="btn-primary" style={{ textAlign: "center" }}>
                    Use invite code ↵
                  </Link>

                  <Link
                    href="/"
                    style={{
                      textAlign: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--muted)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    ← Back to home
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Page
