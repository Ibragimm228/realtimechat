"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface VoiceRecorderProps {
  onSend: (file: File) => void
}

export function VoiceRecorder({ onSend }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop()
    }
    setIsRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" })
      chunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: recorder.mimeType })
        onSend(file)
      }

      recorderRef.current = recorder
      recorder.start(100)
      setIsRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => {
        if (d >= 59) { stopRecording(); return 60 }
        return d + 1
      }), 1000)
    } catch {}
  }, [onSend, stopRecording])

  const cancelRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.ondataavailable = null
      recorderRef.current.onstop = null
      recorderRef.current.stop()
      recorderRef.current.stream.getTracks().forEach((t) => t.stop())
    }
    chunksRef.current = []
    setIsRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const formatDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 animate-in fade-in duration-200">
        <button onClick={cancelRecording} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Cancel">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div className="flex items-center gap-2 text-destructive text-sm font-bold">
          <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          {formatDur(duration)}
        </div>
        <button onClick={stopRecording} className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all" title="Send">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    )
  }

  return (
    <button onClick={startRecording} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted" title="Voice message" type="button">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    </button>
  )
}
