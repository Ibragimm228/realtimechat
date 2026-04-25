"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { generateQRDataURL } from "@/lib/qr"
import { encodeInviteCode, formatCodeDisplay } from "@/lib/invite-code"
import { useToast } from "./toast"

interface ShareModalProps {
  open: boolean
  url: string
  title?: string
  onClose: () => void
}

function splitUrl(url: string): { roomId: string; key: string } | null {
  try {
    const u = new URL(url)
    const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash
    if (!hash) return null
    const parts = u.pathname.split("/").filter(Boolean)
    if (parts.length < 2) return null
    const id = parts[parts.length - 1]
    if (!id) return null
    return { roomId: id, key: hash }
  } catch {
    return null
  }
}

export function ShareModal({ open, url, title = "Share room", onClose }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const { toast } = useToast()

  const parsed = useMemo(() => (open ? splitUrl(url) : null), [open, url])
  const code = useMemo(() => {
    if (!parsed) return null
    return encodeInviteCode(parsed.roomId, parsed.key)
  }, [parsed])
  const displayCode = useMemo(() => (code ? formatCodeDisplay(code, 5) : ""), [code])

  const qrDataUrl = useMemo(() => {
    if (!open || !url) return null
    try {
      return generateQRDataURL(url, 220)
    } catch {
      return null
    }
  }, [open, url])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  const copy = async (value: string, which: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(value)
      if (which === "link") {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 1800)
        toast("Link copied!", "success")
      } else {
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 1800)
        toast("Code copied!", "success")
      }
    } catch {
      toast("Failed to copy", "error")
    }
  }

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 150 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal" style={{ maxWidth: 620 }}>
        <div
          className="modal-head"
          style={{ flexDirection: "column", alignItems: "stretch", gap: 10, padding: "20px 24px 14px" }}
        >
          <div className="kicker" style={{ width: "100%" }}>
            <span className="num">★</span>
            <span>— SHARE</span>
            <button
              className="icon-btn"
              onClick={onClose}
              aria-label="Close"
              style={{ marginLeft: "auto" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <h3
            className="modal-hero-title"
            dangerouslySetInnerHTML={{
              __html: title.toLowerCase().includes("group")
                ? "Share <em>this group</em>."
                : title.toLowerCase().includes("channel")
                ? "Share <em>this channel</em>."
                : "Share <em>this room</em>.",
            }}
          />
          <p className="modal-hero-sub">
            One code carries both the room id and the encryption key. Anyone with
            it can join and read the messages — only share with people you trust.
          </p>
        </div>

        <div className="modal-body" style={{ gap: 22, padding: "6px 24px 22px" }}>
          {code && (
            <div>
              <div className="pill-label">
                <span className="num">01</span>
                <span>— INVITE CODE</span>
              </div>
              <div
                className="code-display"
                tabIndex={0}
                onClick={(e) => {
                  const range = document.createRange()
                  range.selectNodeContents(e.currentTarget)
                  const sel = window.getSelection()
                  sel?.removeAllRanges()
                  sel?.addRange(range)
                }}
                title="Copy code"
              >
                {displayCode}
              </div>
            </div>
          )}

          <div className="copy-row">
            {code && (
              <button
                type="button"
                className="btn-primary"
                style={{ padding: "14px 16px" }}
                onClick={() => copy(code, "code")}
              >
                {copiedCode ? "Copied code ✓" : "Copy code"}
              </button>
            )}
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: "14px 16px", justifyContent: "center" }}
              onClick={() => copy(url, "link")}
            >
              {copiedLink ? "Copied link ✓" : "Copy full link"}
            </button>
          </div>

          <div>
            <div className="pill-label">
              <span className="num">02</span>
              <span>— QR · SCAN TO JOIN</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "18px",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                background: "var(--bg)",
              }}
            >
              {qrDataUrl ? (
                <div
                  style={{
                    background: "#ffffff",
                    padding: 10,
                    border: "1px solid var(--rule)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <Image
                    src={qrDataUrl}
                    alt="QR Code"
                    width={196}
                    height={196}
                    unoptimized
                    style={{ width: 196, height: 196, display: "block" }}
                    draggable={false}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: 196,
                    height: 196,
                    border: "1px solid var(--rule-soft)",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <span className="mono text-muted" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    Generating…
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="invite-warning">
            <span className="w-label">! Warning</span>
            <div className="w-body">
              The code IS the key. If someone else has it, they can read every
              message in this room.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
