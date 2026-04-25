"use client"

import { useRef } from "react"

interface FileAttachProps {
  onFile: (file: File) => void
}

export function FileAttach({ onFile }: FileAttachProps) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={ref}
        type="file"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", left: -9999, top: -9999 }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          if (ref.current) ref.current.value = ""
        }}
      />
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          ref.current?.click()
        }}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        title="Attach file (max 1MB, SVG/HTML blocked)"
        type="button"
        style={{ position: "relative", zIndex: 2 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
    </>
  )
}
