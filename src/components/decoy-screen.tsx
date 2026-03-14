"use client"

import { useState, useEffect } from "react"

type DecoyType = "google" | "calculator" | "notes"

interface DecoyScreenProps {
  type: DecoyType
  onUnlock: (pin: string) => void
  maxAttempts: number
  attemptsUsed: number
}

function GoogleDecoy() {
  const [query, setQuery] = useState("")
  return (
    <div className="min-h-screen bg-white flex flex-col items-center pt-[30vh]">
      <div className="text-[92px] font-normal leading-none mb-6">
        <span className="text-[#4285f4]">G</span><span className="text-[#ea4335]">o</span><span className="text-[#fbbc05]">o</span><span className="text-[#4285f4]">g</span><span className="text-[#34a853]">l</span><span className="text-[#ea4335]">e</span>
      </div>
      <div className="w-full max-w-[584px] px-4">
        <div className="flex items-center border border-gray-200 rounded-full px-5 py-3 shadow-sm hover:shadow-md transition-shadow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9AA0A6" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 ml-3 outline-none text-base text-gray-800" placeholder="" />
        </div>
        <div className="flex justify-center gap-3 mt-8">
          <button className="bg-[#f8f9fa] text-[#3c4043] text-sm px-4 py-2 rounded border border-[#f8f9fa] hover:border-gray-300">Google Search</button>
          <button className="bg-[#f8f9fa] text-[#3c4043] text-sm px-4 py-2 rounded border border-[#f8f9fa] hover:border-gray-300">I&apos;m Feeling Lucky</button>
        </div>
      </div>
    </div>
  )
}

function CalculatorDecoy() {
  const [display, setDisplay] = useState("0")
  const press = (v: string) => setDisplay((d) => d === "0" ? v : d + v)
  return (
    <div className="min-h-screen bg-[#202124] flex items-center justify-center">
      <div className="w-80 bg-[#303134] rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6 text-right text-white text-4xl font-light min-h-[80px] flex items-end justify-end">{display}</div>
        <div className="grid grid-cols-4 gap-px bg-[#202124]">
          {["C","±","%","÷","7","8","9","×","4","5","6","−","1","2","3","+","0","0",".","="].map((b, i) => (
            <button key={i} onClick={() => press(b)} className={`p-5 text-xl font-medium transition-colors ${i % 4 === 3 ? "bg-[#f69906] text-white" : i < 3 ? "bg-[#505050] text-white" : "bg-[#303134] text-white hover:bg-[#404040]"}`}>{b}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotesDecoy() {
  const [text, setText] = useState("Shopping list:\n- Milk\n- Bread\n- Eggs\n- Coffee")
  return (
    <div className="min-h-screen bg-[#fff9c4] p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-[#5d4037] mb-4">Notes</h1>
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full h-[70vh] bg-transparent text-[#5d4037] text-lg outline-none resize-none leading-relaxed" />
      </div>
    </div>
  )
}

export function DecoyScreen({ type, onUnlock, maxAttempts, attemptsUsed }: DecoyScreenProps) {
  const [pin, setPin] = useState("")
  const [showInput, setShowInput] = useState(false)

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowInput((p) => !p)
    }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [])

  return (
    <div className="fixed inset-0 z-[200]">
      {type === "google" && <GoogleDecoy />}
      {type === "calculator" && <CalculatorDecoy />}
      {type === "notes" && <NotesDecoy />}

      {showInput && (
        <div className="fixed bottom-4 right-4 z-[300] bg-black/90 p-4 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <input
            autoFocus
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { onUnlock(pin); setPin("") } }}
            placeholder="PIN"
            className="bg-white/10 text-white text-center w-24 py-2 rounded-lg outline-none text-lg tracking-widest"
          />
          <p className="text-[9px] text-white/30 mt-1 text-center">{Math.max(0, maxAttempts - attemptsUsed)} left</p>
        </div>
      )}
    </div>
  )
}

export const DECOY_OPTIONS: { type: DecoyType; label: string }[] = [
  { type: "google", label: "Google Search" },
  { type: "calculator", label: "Calculator" },
  { type: "notes", label: "Notes" },
]
