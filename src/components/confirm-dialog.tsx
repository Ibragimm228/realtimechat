"use client"

import { useEffect, useRef } from "react"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "default"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 space-y-2">
          <h3 className="text-lg font-black tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <div className="flex gap-3 p-4 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold bg-muted hover:bg-muted/80 text-foreground transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg ${
              variant === "danger"
                ? "bg-destructive text-white hover:bg-destructive/90 shadow-destructive/20"
                : "bg-primary text-primary-foreground hover:opacity-90 shadow-primary/20"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
