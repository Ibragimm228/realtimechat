"use client"

import { useEffect, useState } from "react"
import { generateQRDataURL } from "@/lib/qr"
import { useToast } from "./toast"

interface ShareModalProps {
  open: boolean
  url: string
  title?: string
  onClose: () => void
}

export function ShareModal({ open, url, title = "Share Link", onClose }: ShareModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && url) {
      try {
        const dataUrl = generateQRDataURL(url, 280)
        setQrDataUrl(dataUrl)
      } catch {
        setQrDataUrl(null)
      }
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast("Link copied!", "success")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast("Failed to copy", "error")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-black uppercase tracking-wider">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-5">
          {qrDataUrl ? (
            <div className="bg-white p-3 rounded-xl shadow-inner">
              <img src={qrDataUrl} alt="QR Code" className="w-[256px] h-[256px]" draggable={false} />
            </div>
          ) : (
            <div className="w-[256px] h-[256px] bg-muted rounded-xl flex items-center justify-center">
              <span className="text-muted-foreground text-xs">Generating QR...</span>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center uppercase tracking-wider font-bold">
            Scan to join with encryption key
          </p>

          <div className="w-full flex gap-2">
            <div className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-xs font-mono text-muted-foreground truncate border border-input">
              {url.length > 60 ? url.slice(0, 60) + "..." : url}
            </div>
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {copied ? "COPIED" : "COPY"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
