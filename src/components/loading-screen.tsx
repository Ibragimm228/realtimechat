"use client"

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background z-[100] flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary animate-pulse">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background animate-pulse" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-black tracking-tight text-primary">{">"}private_chat</h2>
        <p className="text-xs text-muted-foreground font-medium">Establishing secure connection...</p>
      </div>
      <div className="flex gap-1.5">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  )
}
