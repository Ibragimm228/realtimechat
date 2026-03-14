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
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`
              pointer-events-auto cursor-pointer px-4 py-3 rounded-xl text-sm font-bold shadow-2xl backdrop-blur-md
              animate-in slide-in-from-right-full fade-in duration-300
              border max-w-xs
              ${t.type === "success" ? "bg-green-500/90 text-white border-green-400/30" : ""}
              ${t.type === "error" ? "bg-destructive/90 text-white border-destructive/30" : ""}
              ${t.type === "info" ? "bg-primary/90 text-primary-foreground border-primary/30" : ""}
              ${t.type === "warning" ? "bg-amber-500/90 text-white border-amber-400/30" : ""}
            `}
          >
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">
                {t.type === "success" && "\u2713"}
                {t.type === "error" && "\u2717"}
                {t.type === "info" && "\u2139"}
                {t.type === "warning" && "\u26A0"}
              </span>
              <span>{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}
