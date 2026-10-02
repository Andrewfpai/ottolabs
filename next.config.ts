import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep pages you visited in the last 30 seconds in the browser, so going
    // back and forth between them is instant. Saving anything (a task, a
    // session, a setting) calls revalidatePath, which clears that page from
    // this memory, so your own changes always show. Changes made on another
    // device can take up to 30 seconds to appear here.
    staleTimes: { dynamic: 30 },
  },

  // The service worker (notifications only) must never be cached, so a fix
  // reaches every device on its next visit, and may only run our own code.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
