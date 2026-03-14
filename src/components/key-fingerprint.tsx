"use client"

import { generateKeyFingerprint, generateEmojiFingerprint } from "@/lib/pfs"
import { useEffect, useState } from "react"

interface KeyFingerprintProps {
  publicKey: CryptoKey | null
}

export function KeyFingerprint({ publicKey }: KeyFingerprintProps) {
  const [numeric, setNumeric] = useState("")
  const [emoji, setEmoji] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!publicKey) return
    generateKeyFingerprint(publicKey).then(setNumeric)
    generateEmojiFingerprint(publicKey).then(setEmoji)
  }, [publicKey])

  if (!publicKey || !numeric) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-[10px] text-green-500 font-mono hover:underline cursor-pointer"
        title="Verify encryption key"
      >
        {emoji.slice(0, 4)}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-xs rounded-2xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
              </div>
              <h3 className="text-base font-black uppercase tracking-wider">Key Fingerprint</h3>
              <p className="text-[11px] text-muted-foreground">Compare with your contact to verify encryption</p>
            </div>

            <div className="text-center text-3xl tracking-wider py-2">{emoji}</div>

            <div className="bg-muted p-3 rounded-xl font-mono text-xs text-center leading-relaxed tracking-wider break-all">
              {numeric}
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-all text-sm"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  )
}
