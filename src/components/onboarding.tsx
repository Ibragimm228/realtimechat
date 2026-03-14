"use client"

import { useState, useEffect } from "react"

const STORAGE_KEY = "onboarding_completed"

const STEPS = [
  {
    title: "End-to-End Encrypted",
    description: "All messages are encrypted with AES-GCM-256. The encryption key is in the URL hash — never sent to the server.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    ),
  },
  {
    title: "Panic Mode",
    description: "Press Alt+P or Escape to instantly hide the chat. A decoy screen disguises it as Google or Calculator.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4"/><path d="m3.34 19 8.66-15 8.66 15H3.34Z"/><path d="m12 14-4-4"/></svg>
    ),
  },
  {
    title: "Self-Destructing",
    description: "Rooms auto-delete after the set timer expires. Use /b to send burn messages that disappear in 15 seconds.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
    ),
  },
  {
    title: "Special Commands",
    description: "/w whisper (auto-expires) · /b burn (self-destructs) · /code snippet · /ink invisible text",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
    ),
  },
]

export function Onboarding() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true)
  }, [])

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-primary">
            {STEPS[step].icon}
          </div>
          <h2 className="text-xl font-black tracking-tight">{STEPS[step].title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{STEPS[step].description}</p>
        </div>

        <div className="flex justify-center gap-1.5 pb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-primary w-6" : "bg-muted-foreground/20"}`} />
          ))}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <button onClick={complete} className="flex-1 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            Skip
          </button>
          <button
            onClick={() => { if (step < STEPS.length - 1) setStep(step + 1); else complete() }}
            className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-all text-sm"
          >
            {step < STEPS.length - 1 ? "Next" : "Get Started"}
          </button>
        </div>
      </div>
    </div>
  )
}
