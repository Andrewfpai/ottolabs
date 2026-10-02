"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { syncClock } from "@/lib/time/clock";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Timer and task data is personal and low-volume; refetching on every
        // window focus is cheap and keeps a second tab from showing stale state.
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

/**
 * Aligns the browser clock with the server's before the first timer paints.
 * Without it, a laptop whose clock is minutes off shows a nonsense elapsed time
 * the instant a session starts. See `lib/time/clock.ts`.
 */
function ClockSync() {
  useEffect(() => {
    const controller = new AbortController();

    void syncClock(controller.signal).catch(() => {
      // Non-fatal: we fall back to an offset of zero, which is correct for the
      // overwhelming majority of machines. Nothing here is worth a toast.
    });

    // Re-sync on wake. A laptop resuming from sleep is exactly when its clock
    // is most likely to have drifted.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncClock(controller.signal).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Held in state so React does not build a fresh client on every render.
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <ClockSync />
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
