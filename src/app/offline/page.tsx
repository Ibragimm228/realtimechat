"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">No Connection</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You&apos;re offline. Messages will be sent when connection is restored.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all active:scale-95"
        >
          RETRY
        </button>
      </div>
    </div>
  )
}
