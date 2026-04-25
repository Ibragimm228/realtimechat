"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"

type ToastType = "success" | "error" | "info" | "warning"

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = String(++counterRef.current)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const accent =
            t.type === "success"
              ? "var(--signal)"
              : t.type === "error"
              ? "var(--danger)"
              : t.type === "warning"
              ? "var(--danger)"
              : "var(--ink)"
          return (
            <div
              key={t.id}
              onClick={() => dismiss(t.id)}
              style={{
                pointerEvents: "auto",
                cursor: "pointer",
                padding: "12px 16px",
                background: "var(--paper)",
                border: "1px solid var(--rule)",
                borderLeft: `3px solid ${accent}`,
                borderRadius: "var(--radius)",
                color: "var(--ink)",
                fontSize: 13,
                minWidth: 220,
                maxWidth: 360,
                display: "flex",
                alignItems: "center",
                gap: 10,
                animation: "slideUp .2s ease",
                boxShadow: "0 12px 30px -12px color-mix(in srgb, var(--ink) 25%, transparent)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: accent,
                  flexShrink: 0,
                }}
              >
                {t.type === "success" && "OK"}
                {t.type === "error" && "ERR"}
                {t.type === "info" && "INFO"}
                {t.type === "warning" && "WARN"}
              </span>
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}
