"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RealtimeProvider } from "@upstash/realtime/client"
import { useState } from "react"

import { ThemeProvider } from "./theme-provider"
import { ToastProvider } from "./toast"
import { useServiceWorker } from "@/hooks/use-service-worker"

function ServiceWorkerInit() {
  useServiceWorker()
  return null
}

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ThemeProvider>
      <RealtimeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ServiceWorkerInit />
            {children}
          </ToastProvider>
        </QueryClientProvider>
      </RealtimeProvider>
    </ThemeProvider>
  )
}
