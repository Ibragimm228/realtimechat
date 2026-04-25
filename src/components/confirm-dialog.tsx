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
    <div className="modal-backdrop" style={{ zIndex: 150 }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-3)" }}>
            {description}
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="btn-primary"
            style={
              variant === "danger"
                ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }
                : undefined
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
