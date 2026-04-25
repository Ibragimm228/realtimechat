"use client"

import { useState } from "react"

const STORAGE_KEY = "onboarding_completed"

const STEPS = [
  {
    kicker: "01 / 04",
    title: "End-to-end encrypted",
    description:
      "All messages are encrypted with AES-GCM-256 in your browser. The key lives in the URL hash — the server never sees it.",
  },
  {
    kicker: "02 / 04",
    title: "Panic mode",
    description:
      "Press Alt+P or Escape to hide the chat instantly. A decoy screen disguises the room as Google, a calculator or notes.",
  },
  {
    kicker: "03 / 04",
    title: "Self-destructing",
    description:
      "Rooms auto-delete after the timer expires. Use /b to send burn messages that vanish 15 seconds after being read.",
  },
  {
    kicker: "04 / 04",
    title: "Special commands",
    description:
      "/w whisper · /b burn · /code snippet · /ink invisible — prefix any message to send it in a special mode.",
  },
]

export function Onboarding() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false
    return !localStorage.getItem(STORAGE_KEY)
  })
  const [step, setStep] = useState(0)

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    setShow(false)
  }

  if (!show) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="modal-backdrop" style={{ zIndex: 150 }}>
      <div className="modal">
        <div className="modal-head">
          <div className="kicker">
            <span className="num">{current.kicker}</span>
            <span>— Welcome</span>
          </div>
        </div>
        <div className="modal-body">
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 36,
              letterSpacing: "-0.01em",
              lineHeight: 1.05,
              color: "var(--ink)",
              fontWeight: 400,
            }}
          >
            {current.title}
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-3)" }}>
            {current.description}
          </p>

          <div style={{ display: "flex", gap: 6, justifyContent: "center", paddingTop: 6 }}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === step ? 28 : 8,
                  height: 4,
                  background: i === step ? "var(--ink)" : "var(--rule-soft)",
                  transition: "all .2s",
                  borderRadius: "var(--radius)",
                }}
              />
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={complete}>
            Skip
          </button>
          <button
            className="btn-primary"
            onClick={() => (isLast ? complete() : setStep(step + 1))}
          >
            {isLast ? "Start ↵" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  )
}
